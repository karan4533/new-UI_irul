import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    ACTIVITIES_LIVE_SYNC_FAILED_EVENT,
    ACTIVITIES_LIVE_UPDATED_EVENT,
    getActivitiesLiveState,
    hydrateActivities,
} from './activitiesData'

/**
 * Hydrates live activities from FastAPI and bumps `version` whenever the cache changes.
 * In mock mode it is inert (`live: false`, never loading).
 */
export default function useActivitiesLive() {
    const live = isLiveApiEnabled()
    const [version, setVersion] = useState(0)
    const [state, setState] = useState(() => {
        const snapshot = getActivitiesLiveState()
        return { loading: live && !snapshot.hydrated && !snapshot.error, error: snapshot.error }
    })

    const refresh = useCallback(async () => {
        if (!isLiveApiEnabled()) return
        setState((current) => ({ ...current, loading: true }))
        await hydrateActivities({ force: true })
    }, [])

    useEffect(() => {
        if (!live) return undefined
        const sync = () => {
            const snapshot = getActivitiesLiveState()
            setState({ loading: snapshot.loading, error: snapshot.error })
            setVersion((value) => value + 1)
        }
        const onFailed = (event) => toast.error(event?.detail?.message || 'Activities could not be saved.')
        window.addEventListener(ACTIVITIES_LIVE_UPDATED_EVENT, sync)
        window.addEventListener(ACTIVITIES_LIVE_SYNC_FAILED_EVENT, onFailed)
        hydrateActivities()
        return () => {
            window.removeEventListener(ACTIVITIES_LIVE_UPDATED_EVENT, sync)
            window.removeEventListener(ACTIVITIES_LIVE_SYNC_FAILED_EVENT, onFailed)
        }
    }, [live])

    return { live, version, loading: state.loading, error: state.error, refresh }
}
