import { useCallback, useEffect, useState } from 'react'
import { canUseAcademicsApi } from './academicsApiService.js'
import { getAcademicsLiveStatus, hydrateAcademicsCollection } from './academicsLiveCollection.js'

/**
 * Hydrates a live academics collection on mount. `version` bumps after each
 * hydrate so callers can re-read the sync `getX()` data helpers.
 */
export function useAcademicsLiveCollection(collection, dependency) {
  const live = canUseAcademicsApi()
  const [version, setVersion] = useState(0)
  const [state, setState] = useState(() => (live
    ? { loading: getAcademicsLiveStatus(collection).status !== 'ready', error: '' }
    : { loading: false, error: '' }))

  const load = useCallback(
    async (force = false) => {
      if (!canUseAcademicsApi()) {
        setState({ loading: false, error: '' })
        return
      }
      setState({ loading: true, error: '' })
      const res = await hydrateAcademicsCollection(collection, { force })
      setState({ loading: false, error: res.success ? '' : (res.error || `Could not load ${collection}.`) })
      setVersion((current) => current + 1)
    },
    [collection],
  )

  useEffect(() => {
    let cancelled = false
    if (!canUseAcademicsApi()) {
      return undefined
    }
    ;(async () => {
      setState({ loading: true, error: '' })
      const res = await hydrateAcademicsCollection(collection)
      if (cancelled) return
      setState({ loading: false, error: res.success ? '' : (res.error || `Could not load ${collection}.`) })
      setVersion((current) => current + 1)
    })()
    return () => { cancelled = true }
  }, [collection, dependency])

  return { live, loading: live && state.loading, error: live ? state.error : '', version, reload: load }
}
