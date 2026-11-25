/**
 * Shared live memory + hydrate/persist for /api/v1/academics/{collection}.
 * Live mode never falls back to localStorage or INITIAL seed rows.
 */

import {
  canUseAcademicsApi,
  listAcademicsCollectionApi,
  replaceAcademicsCollectionApi,
  stripAcademicsMeta,
} from './academicsApiService.js'

const stores = new Map()

function stateFor(collection) {
  if (!stores.has(collection)) {
    stores.set(collection, {
      rows: null,
      status: 'idle',
      error: '',
      hydratePromise: null,
    })
  }
  return stores.get(collection)
}

export function getAcademicsLiveStatus(collection) {
  const state = stateFor(collection)
  return { status: state.status, error: state.error }
}

export async function hydrateAcademicsCollection(collection, { force = false } = {}) {
  if (!canUseAcademicsApi()) {
    return { success: false, error: 'Live academics API is disabled.', data: [] }
  }
  const state = stateFor(collection)
  if (!force && state.status === 'ready' && Array.isArray(state.rows)) {
    return { success: true, data: state.rows }
  }
  if (!force && state.hydratePromise) return state.hydratePromise

  state.status = 'loading'
  state.error = ''
  state.hydratePromise = (async () => {
    try {
      const rows = await listAcademicsCollectionApi(collection)
      state.rows = (Array.isArray(rows) ? rows : []).map(stripAcademicsMeta)
      state.status = 'ready'
      state.error = ''
      return { success: true, data: state.rows }
    } catch (err) {
      state.rows = []
      state.status = 'error'
      state.error = err?.message || `Could not load ${collection}.`
      return { success: false, error: state.error, data: [] }
    } finally {
      state.hydratePromise = null
    }
  })()
  return state.hydratePromise
}

/** Sync read — empty until hydrate completes in live mode. */
export function readAcademicsCollection(collection) {
  if (!canUseAcademicsApi()) return null
  const state = stateFor(collection)
  return Array.isArray(state.rows) ? state.rows.map((row) => ({ ...row })) : []
}

/** Replace in memory and persist (fire-and-forget returns the promise). */
export function writeAcademicsCollection(collection, rows) {
  const list = (Array.isArray(rows) ? rows : []).map(stripAcademicsMeta)
  if (!canUseAcademicsApi()) return Promise.resolve({ success: false, error: 'Live academics API is disabled.' })
  const state = stateFor(collection)
  state.rows = list
  state.status = 'ready'
  return replaceAcademicsCollectionApi(collection, list)
    .then(() => ({ success: true, data: list }))
    .catch((err) => {
      state.error = err?.message || `Could not save ${collection}.`
      return { success: false, error: state.error, data: list }
    })
}

export function resetAcademicsLiveCollections() {
  stores.clear()
}
