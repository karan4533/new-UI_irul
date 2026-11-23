import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import FeedbackState from './FeedbackState'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { hydrateOpsCollection, OPS_LIVE_SYNC_FAILED_EVENT, parseCollectionKey } from '../../services/api/opsLiveStore'

/**
 * Loads live ops collections before a workspace renders.
 *
 * - Mock mode (VITE_USE_MOCK !== 'false'): renders children untouched.
 * - Live mode: shows a loading state, then children with API data (empty when the API has none).
 *   If the API fails, shows an error state — never silently falls back to browser mock data.
 * - If a background save fails, the store has already rolled back from the server; this gate toasts
 *   the error and remounts the children so the UI shows the server state.
 *
 * `collections` entries are ops collection names, or `front-office:<name>` for front-office records.
 *
 * @param {{ collections: string[], title: string, children: React.ReactNode }} props
 */
const LiveOpsGate = ({ collections, title, children }) => {
    const live = isLiveApiEnabled()
    const key = useMemo(() => [...new Set(collections)].join('|'), [collections])
    const [status, setStatus] = useState(live ? 'loading' : 'ready')
    const [error, setError] = useState('')
    const [epoch, setEpoch] = useState(0)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        if (!live) return undefined
        let cancelled = false
        const names = key ? key.split('|') : []
        Promise.resolve().then(() => {
            if (!cancelled) {
                setStatus('loading')
                setError('')
            }
        })
        Promise.all(names.map((name) => hydrateOpsCollection(name, { force: true }))).then((results) => {
            if (cancelled) return
            const failure = results.find((result) => !result.success)
            if (failure) {
                setError(failure.error || 'The service could not be reached.')
                setStatus('error')
                return
            }
            setStatus('ready')
        })
        return () => {
            cancelled = true
        }
    }, [live, key, attempt])

    useEffect(() => {
        if (!live) return undefined
        const names = new Set(key ? key.split('|').map((name) => parseCollectionKey(name).key) : [])
        const onFailed = (event) => {
            const detail = event.detail || {}
            if (!names.has(detail.collection)) return
            toast.error(detail.message || 'Changes could not be saved to the server.')
            setEpoch((value) => value + 1)
        }
        window.addEventListener(OPS_LIVE_SYNC_FAILED_EVENT, onFailed)
        return () => window.removeEventListener(OPS_LIVE_SYNC_FAILED_EVENT, onFailed)
    }, [live, key])

    const retry = useCallback(() => setAttempt((value) => value + 1), [])

    if (!live) return children

    if (status === 'loading') {
        return <FeedbackState kind='loading' title={`Loading ${title}`} description='Fetching records from the server…' />
    }

    if (status === 'error') {
        return (
            <FeedbackState
                kind='error'
                title={`${title} unavailable`}
                description={error}
                action={(
                    <button
                        type='button'
                        onClick={retry}
                        className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)]'
                    >
                        Retry
                    </button>
                )}
            />
        )
    }

    return <React.Fragment key={epoch}>{children}</React.Fragment>
}

export default LiveOpsGate
