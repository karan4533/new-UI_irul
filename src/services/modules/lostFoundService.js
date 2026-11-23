/**
 * Lost & Found Management Domain Service
 * Handles lost and found item posts, photo attachments, custodial storage,
 * claim verification workflows, and handover records.
 */

import { apiClient } from '../api/apiClient.js';
import { generateUniqueId, validateRequired } from '../models/index.js';
import { createErrorResponse } from '../api/responseEnvelope.js';
import { isLiveApiEnabled } from '../api/tokenStore.js';

// Live mode: items live in the FastAPI ops collection `hk-lost-found` (whole-collection GET / PUT).
const LIVE_COLLECTION = '/api/v1/ops/hk-lost-found';

const stripMeta = (row = {}) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_')));

const liveFail = (message) => ({ success: false, data: null, meta: null, error: { message } });

async function liveLoadAll() {
  const res = await apiClient.get(LIVE_COLLECTION, { skipMock: true });
  if (!res.success) {
    return liveFail(typeof res.error === 'string' ? res.error : res.error?.message || 'Could not load lost & found items.');
  }
  return { success: true, data: Array.isArray(res.data) ? res.data : [], error: null };
}

async function liveSaveAll(rows) {
  const res = await apiClient.put(LIVE_COLLECTION, rows.map(stripMeta), { skipMock: true });
  if (!res.success) {
    return liveFail(typeof res.error === 'string' ? res.error : res.error?.message || 'Could not save lost & found items.');
  }
  return { success: true, data: Array.isArray(res.data) ? res.data : rows, error: null };
}

/** Load all rows, apply `mutate(rows) -> row | {error}`, persist, return the changed row. */
async function liveMutate(mutate) {
  const loaded = await liveLoadAll();
  if (!loaded.success) return loaded;
  const rows = loaded.data.map(stripMeta);
  const outcome = mutate(rows);
  if (outcome?.error) return liveFail(outcome.error);
  const saved = await liveSaveAll(rows);
  if (!saved.success) return saved;
  return { success: true, data: outcome.row, meta: null, error: null };
}

export const lostFoundService = {
  // ==========================================================================
  // 1. ITEM POSTS (LOST & FOUND)
  // ==========================================================================

  async getItems(params = {}) {
    if (isLiveApiEnabled()) return liveLoadAll();
    return apiClient.get('/api/v1/lostfound/items', { params });
  },

  async getItemById(id) {
    if (isLiveApiEnabled()) {
      const loaded = await liveLoadAll();
      if (!loaded.success) return loaded;
      const row = loaded.data.find((item) => item.id === id);
      return row ? { success: true, data: row, meta: null, error: null } : liveFail('Item not found.');
    }
    return apiClient.get(`/api/v1/lostfound/items/${id}`);
  },

  async reportItem(itemData = {}) {
    const validation = validateRequired(itemData, [
      'type', // 'LOST' or 'FOUND'
      'title',
      'category',
      'location',
      'dateReported',
      'description',
    ]);
    if (!validation.valid) return createErrorResponse(validation.errors);

    const payload = {
      id: generateUniqueId('LF'),
      status: itemData.type === 'FOUND' ? 'In Custody / Unclaimed' : 'Reported Lost',
      photoUrl: itemData.photoUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
      claimantDetails: null,
      ...itemData,
    };

    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        rows.unshift(payload);
        return { row: payload };
      });
    }

    return apiClient.post('/api/v1/lostfound/items', payload);
  },

  async updateItem(id, itemData = {}) {
    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        const index = rows.findIndex((item) => item.id === id);
        if (index === -1) return { error: 'Item not found.' };
        rows[index] = { ...rows[index], ...itemData, id };
        return { row: rows[index] };
      });
    }
    return apiClient.put(`/api/v1/lostfound/items/${id}`, itemData);
  },

  async deleteItem(id) {
    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        const index = rows.findIndex((item) => item.id === id);
        if (index === -1) return { error: 'Item not found.' };
        const [row] = rows.splice(index, 1);
        return { row };
      });
    }
    return apiClient.delete(`/api/v1/lostfound/items/${id}`);
  },

  // ==========================================================================
  // 2. CLAIMS & HANDOVER VERIFICATION
  // ==========================================================================

  async submitClaim(itemId, claimData = {}) {
    const validation = validateRequired(claimData, [
      'claimantId',
      'claimantName',
      'proofDescription',
    ]);
    if (!validation.valid) return createErrorResponse(validation.errors);

    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        const item = rows.find((row) => row.id === itemId);
        if (!item) return { error: 'Item not found.' };
        item.status = 'Under Review';
        item.claimantDetails = {
          claimId: generateUniqueId('CLM'),
          claimDate: new Date().toISOString().split('T')[0],
          status: 'Under Review',
          ...claimData,
        };
        return { row: item };
      });
    }

    const itemRes = await this.getItemById(itemId);
    if (!itemRes.success || !itemRes.data) return itemRes;

    const item = itemRes.data;
    item.status = 'Under Review';
    item.claimantDetails = {
      claimId: generateUniqueId('CLM'),
      claimDate: new Date().toISOString().split('T')[0],
      status: 'Under Review',
      ...claimData,
    };

    return apiClient.put(`/api/v1/lostfound/items/${itemId}`, item);
  },

  async verifyClaim(itemId, { status, reviewerNotes, verifiedBy }) {
    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        const item = rows.find((row) => row.id === itemId);
        if (!item) return { error: 'Item not found.' };
        if (!item.claimantDetails) return { error: 'No pending claim on this item.' };
        item.claimantDetails = {
          ...item.claimantDetails,
          status,
          reviewerNotes: reviewerNotes || '',
          verifiedBy: verifiedBy || 'Security Custodian',
        };
        if (status === 'Approved') {
          item.status = 'Claim Approved - Ready for Handover';
        } else if (status === 'Rejected') {
          item.status = 'In Custody / Unclaimed';
          item.claimantDetails = null;
        }
        return { row: item };
      });
    }
    const itemRes = await this.getItemById(itemId);
    if (!itemRes.success || !itemRes.data) return itemRes;

    const item = itemRes.data;
    if (!item.claimantDetails) {
      return createErrorResponse('No pending claim on this item.');
    }

    item.claimantDetails.status = status; // 'Approved' | 'Rejected' | 'Proof Required'
    item.claimantDetails.reviewerNotes = reviewerNotes || '';
    item.claimantDetails.verifiedBy = verifiedBy || 'Security Custodian';

    if (status === 'Approved') {
      item.status = 'Claim Approved - Ready for Handover';
    } else if (status === 'Rejected') {
      item.status = 'In Custody / Unclaimed';
      item.claimantDetails = null;
    }

    return apiClient.put(`/api/v1/lostfound/items/${itemId}`, item);
  },

  async handoverItem(itemId, handoverData = {}) {
    if (isLiveApiEnabled()) {
      return liveMutate((rows) => {
        const item = rows.find((row) => row.id === itemId);
        if (!item) return { error: 'Item not found.' };
        item.status = 'Handed Over & Closed';
        item.handoverDetails = {
          handoverDate: new Date().toISOString(),
          handedOverBy: handoverData.custodianName || 'Security Officer',
          receivedBy: item.claimantDetails?.claimantName || handoverData.recipientName,
          remarks: handoverData.remarks || 'Proof of ownership verified and item returned.',
        };
        return { row: item };
      });
    }
    const itemRes = await this.getItemById(itemId);
    if (!itemRes.success || !itemRes.data) return itemRes;

    const item = itemRes.data;
    item.status = 'Handed Over & Closed';
    item.handoverDetails = {
      handoverDate: new Date().toISOString(),
      handedOverBy: handoverData.custodianName || 'Security Officer',
      receivedBy: item.claimantDetails?.claimantName || handoverData.recipientName,
      remarks: handoverData.remarks || 'Proof of ownership verified and item returned.',
    };

    return apiClient.put(`/api/v1/lostfound/items/${itemId}`, item);
  },

  async getLostFoundStats() {
    const res = await this.getItems();
    const items = res.data || [];

    const totalLost = items.filter((i) => i.type === 'LOST').length;
    const totalFound = items.filter((i) => i.type === 'FOUND').length;
    const resolvedCount = items.filter((i) => i.status === 'Handed Over & Closed').length;
    const pendingClaims = items.filter((i) => i.status === 'Under Review').length;

    return {
      success: true,
      data: {
        totalLost,
        totalFound,
        resolvedCount,
        pendingClaims,
      },
      meta: null,
      error: null,
    };
  },
};
