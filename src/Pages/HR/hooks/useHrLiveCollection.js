import { useCallback, useEffect, useState } from 'react'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { createHrItem, listHrCollection, patchHrItem, replaceHrCollection } from '../../../services/api/hrApiService'

/**
 * Shared live/local loader for HR document-store collections.
 * When live: no seed fallback on API failure. Mutations await server confirmation.
 */
export function useHrLiveCollection(collection, { loadLocal, saveLocal } = {}) {
  const live = isLiveApiEnabled()
  const [rows, setRows] = useState(() => (live ? [] : (loadLocal ? loadLocal() : [])))
  const [listLoading, setListLoading] = useState(Boolean(live))
  const [listError, setListError] = useState('')
  const [listSource, setListSource] = useState(live ? 'backend' : 'local')
  const [saving, setSaving] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const reload = useCallback(async () => {
    if (!isLiveApiEnabled()) {
      setRows(loadLocal ? loadLocal() : [])
      setListSource('local')
      setListError('')
      setListLoading(false)
      return
    }
    setListLoading(true)
    setListError('')
    const res = await listHrCollection(collection)
    setListLoading(false)
    if (!res.success) {
      setListSource('error')
      setListError(typeof res.error === 'string' ? res.error : `Failed to load ${collection} from the API.`)
      setRows([])
      return
    }
    setRows(Array.isArray(res.data) ? res.data : [])
    setListSource('backend')
  }, [collection, loadLocal])

  useEffect(() => {
    reload()
  }, [reload, refreshNonce])

  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), [])

  const replaceAll = useCallback(async (nextRows) => {
    if (!isLiveApiEnabled()) {
      if (saveLocal) saveLocal(nextRows)
      setRows(nextRows)
      return { success: true, data: nextRows }
    }
    setSaving(true)
    const res = await replaceHrCollection(collection, nextRows)
    setSaving(false)
    if (res.success) setRows(Array.isArray(res.data) ? res.data : nextRows)
    return res
  }, [collection, saveLocal])

  const createOne = useCallback(async (body) => {
    if (!isLiveApiEnabled()) {
      const next = [body, ...(loadLocal ? loadLocal() : rows)]
      if (saveLocal) saveLocal(next)
      setRows(next)
      return { success: true, data: body }
    }
    setSaving(true)
    const res = await createHrItem(collection, body)
    setSaving(false)
    if (res.success) {
      await reload()
    }
    return res
  }, [collection, loadLocal, reload, rows, saveLocal])

  const patchOne = useCallback(async (publicId, body) => {
    if (!isLiveApiEnabled()) {
      const current = loadLocal ? loadLocal() : rows
      const next = current.map((row) => (row.id === publicId ? { ...row, ...body } : row))
      if (saveLocal) saveLocal(next)
      setRows(next)
      return { success: true, data: body }
    }
    setSaving(true)
    const res = await patchHrItem(collection, publicId, body)
    setSaving(false)
    if (res.success) {
      setRows((current) => current.map((row) => (row.id === publicId ? { ...row, ...res.data } : row)))
    }
    return res
  }, [collection, loadLocal, rows, saveLocal])

  return {
    live,
    rows,
    setRows,
    listLoading,
    listError,
    listSource,
    saving,
    refresh,
    reload,
    replaceAll,
    createOne,
    patchOne,
  }
}
