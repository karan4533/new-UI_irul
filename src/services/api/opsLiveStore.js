/**
 * Live-backed record stores for enterprise workspaces (Stores, File Room, Lost & Found, Ticketing, …).
 *
 * The workspace data modules (e.g. storesProcurementData.js) expose synchronous getX / saveX helpers.
 * In live mode (VITE_USE_MOCK=false) those helpers delegate to a store created here:
 *
 *   - read()  returns the in-memory rows hydrated from FastAPI. Nothing is ever seeded from mock data.
 *             Before hydration it is an empty list.
 *   - write() updates memory immediately and persists in the background. Writes are serialised per
 *             collection. If persistence fails the store re-hydrates from the server (rollback) and
 *             emits OPS_LIVE_SYNC_FAILED_EVENT so the workspace can toast + remount.
 *
 * Two backends are supported (collection key is `ops:<name>` or `front-office:<name>`):
 *   - /api/v1/ops/{collection}          whole-collection PUT (same replace pattern as transport/library)
 *   - /api/v1/front-office/{collection} per-record POST / PUT / DELETE (diffed against the server copy)
 *
 * Several logical stores can share one backend collection by passing `kind`: rows are tagged with
 * `recordKind` and each store only sees / replaces its own kind.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

export const OPS_LIVE_SYNC_FAILED_EVENT = 'qmis:ops-live-sync-failed'
export const OPS_LIVE_UPDATED_EVENT = 'qmis:ops-live-updated'

const KIND_FIELD = 'recordKind'

/** key -> { api, collection, rows, server, hydrated, queue, inflight } */
const collections = new Map()

/** Accepts `name` (ops), `ops:name` or `front-office:name` / `campus-audit:name`. */
export function parseCollectionKey(input) {
  const raw = String(input || '')
  const idx = raw.indexOf(':')
  if (idx === -1) return { api: 'ops', collection: raw, key: `ops:${raw}` }
  const api = raw.slice(0, idx)
  const collection = raw.slice(idx + 1)
  return { api, collection, key: `${api}:${collection}` }
}

function apiBase(api) {
  if (api === 'front-office') return '/api/v1/front-office'
  if (api === 'campus-audit') return '/api/v1/campus-audit'
  if (api === 'hr') return '/api/v1/hr'
  return '/api/v1/ops'
}

function stateFor(input) {
  const { api, collection, key } = parseCollectionKey(input)
  if (!collections.has(key)) {
    collections.set(key, {
      key,
      api,
      collection,
      rows: [],
      server: new Map(),
      hydrated: false,
      queue: Promise.resolve(),
      inflight: null,
    })
  }
  return collections.get(key)
}

function errorMessage(res, fallback) {
  if (res && typeof res.error === 'string' && res.error) return res.error
  return fallback
}

function stripMeta(row) {
  const next = {}
  Object.keys(row || {}).forEach((key) => {
    if (key.startsWith('_')) return
    next[key] = row[key]
  })
  return next
}

function emit(name, detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function remember(state, rows) {
  state.rows = rows
  state.server = new Map(rows.map((row) => [String(row.id), JSON.stringify(stripMeta(row))]))
}

async function fetchCollection(state) {
  const res = await apiClient.get(`${apiBase(state.api)}/${state.collection}`, { skipMock: true })
  if (!res.success) {
    return { success: false, error: errorMessage(res, `Could not load ${state.collection}.`) }
  }
  return { success: true, rows: Array.isArray(res.data) ? res.data : [] }
}

export async function hydrateOpsCollection(input, { force = false } = {}) {
  if (!isLiveApiEnabled()) {
    return { success: false, error: 'Live API is disabled. Set VITE_USE_MOCK=false and VITE_API_BASE_URL.' }
  }
  const state = stateFor(input)
  if (state.hydrated && !force) return { success: true, rows: state.rows }
  if (state.inflight && !force) return state.inflight
  state.inflight = fetchCollection(state).then((result) => {
    state.inflight = null
    if (result.success) {
      remember(state, result.rows)
      state.hydrated = true
      emit(OPS_LIVE_UPDATED_EVENT, { collection: state.key })
    }
    return result
  })
  return state.inflight
}

async function persistReplace(state) {
  const latest = state.rows.map(stripMeta)
  const res = await apiClient.put(`${apiBase(state.api)}/${state.collection}`, latest, { skipMock: true })
  if (!res.success) throw new Error(errorMessage(res, `Could not save ${state.collection}.`))
  if (Array.isArray(res.data)) {
    remember(state, res.data)
    emit(OPS_LIVE_UPDATED_EVENT, { collection: state.key })
  }
}

async function persistDiff(state) {
  const base = `${apiBase(state.api)}/${state.collection}`
  const wanted = new Map(state.rows.map((row) => [String(row.id), stripMeta(row)]))

  for (const id of [...state.server.keys()]) {
    if (wanted.has(id)) continue
    const res = await apiClient.delete(`${base}/${encodeURIComponent(id)}`, { skipMock: true })
    if (!res.success) throw new Error(errorMessage(res, `Could not delete ${id}.`))
    state.server.delete(id)
  }
  for (const [id, body] of wanted) {
    const snapshot = JSON.stringify(body)
    if (!state.server.has(id)) {
      const res = await apiClient.post(base, body, { skipMock: true })
      if (!res.success) throw new Error(errorMessage(res, `Could not create ${id}.`))
      state.server.set(id, snapshot)
    } else if (state.server.get(id) !== snapshot) {
      const res = await apiClient.put(`${base}/${encodeURIComponent(id)}`, body, { skipMock: true })
      if (!res.success) throw new Error(errorMessage(res, `Could not update ${id}.`))
      state.server.set(id, snapshot)
    }
  }
}

function pushCollection(state) {
  state.queue = state.queue
    .then(() => (state.api === 'front-office' ? persistDiff(state) : persistReplace(state)))
    .catch(async (err) => {
      await hydrateOpsCollection(state.key, { force: true })
      emit(OPS_LIVE_SYNC_FAILED_EVENT, {
        collection: state.key,
        message: err?.message || `Could not save ${state.collection}.`,
      })
    })
  return state.queue
}

/**
 * @param {{ collection: string, api?: 'ops'|'front-office'|'campus-audit'|'hr', kind?: string, idPrefix?: string, idKeys?: string[] }} config
 *   idKeys: fields (in priority order) used to derive a stable `id` for rows that lack one.
 */
export function createOpsLiveStore({ collection, api = 'ops', kind = null, idPrefix = 'REC', idKeys = [] }) {
  const key = `${api}:${collection}`
  const matches = (row) => (kind ? row?.[KIND_FIELD] === kind : true)

  const ensureId = (row, index) => {
    if (row.id) return String(row.id)
    for (const idKey of idKeys) {
      if (row[idKey]) return String(row[idKey])
    }
    return `${idPrefix}-${Date.now().toString(36)}-${index}`
  }

  return {
    collection,
    key,
    kind,
    /** Rows of this store (a fresh array of shallow copies; callers may mutate freely). */
    read() {
      return stateFor(key).rows.filter(matches).map((row) => ({ ...row }))
    },
    hydrate(options) {
      return hydrateOpsCollection(key, options)
    },
    /** Replace this store's rows and persist. Returns the queue promise. */
    write(rows) {
      const state = stateFor(key)
      const incoming = (Array.isArray(rows) ? rows : []).map((row, index) => {
        const clean = stripMeta(row)
        const next = kind ? { ...clean, [KIND_FIELD]: kind } : clean
        return { ...next, id: ensureId(next, index) }
      })
      const others = kind ? state.rows.filter((row) => !matches(row)) : []
      state.rows = [...incoming, ...others]
      return pushCollection(state)
    },
  }
}

/** Test helper / logout hook: forget everything held in memory. */
export function resetOpsLiveStores() {
  collections.clear()
}
