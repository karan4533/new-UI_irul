import { useEffect, useState } from 'react'
import {
    canUseClassDetailsApi,
    loadClassDirectory,
    loadClassTeacherOptions,
} from '../../../../services/api/classDetailsApiService'

const describeLoadError = (error, fallbackForbidden) => (
    error?.status === 403
        ? fallbackForbidden
        : error?.status
            ? error.message || 'Could not load classes.'
            : 'Could not reach the server. Check your connection and try again.'
)

export const useClassDirectory = (academicYearId = '', includeInactive = false) => {
    const apiMode = canUseClassDetailsApi()
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', years: [], records: [], error: '' })
    const requestKey = `${reloadKey}:${academicYearId}:${includeInactive ? 'all' : 'active'}`

    useEffect(() => {
        if (!apiMode) return undefined
        let cancelled = false
        loadClassDirectory({ academicYearId, includeInactive })
            .then(({ years, records }) => {
                if (!cancelled) setResult({ key: requestKey, status: 'ready', years, records, error: '' })
            })
            .catch((error) => {
                if (cancelled) return
                setResult((previous) => ({
                    key: requestKey,
                    status: 'error',
                    years: previous.years,
                    records: [],
                    error: describeLoadError(error, 'You do not have access to class records.'),
                }))
            })
        return () => {
            cancelled = true
        }
    }, [apiMode, academicYearId, includeInactive, requestKey])

    const current = result.key === requestKey
    return {
        apiMode,
        status: !apiMode ? 'idle' : current ? result.status : 'loading',
        years: result.years,
        records: current ? result.records : [],
        error: current ? result.error : '',
        reload: () => setReloadKey((key) => key + 1),
    }
}

export const useClassTeacherOptions = (enabled) => {
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', options: [], error: '' })
    const requestKey = String(reloadKey)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        loadClassTeacherOptions()
            .then((options) => {
                if (!cancelled) setResult({ key: requestKey, status: 'ready', options, error: '' })
            })
            .catch((error) => {
                if (cancelled) return
                setResult({
                    key: requestKey,
                    status: 'error',
                    options: [],
                    error: describeLoadError(error, 'You do not have permission to choose class teachers.'),
                })
            })
        return () => {
            cancelled = true
        }
    }, [enabled, requestKey])

    const current = result.key === requestKey
    return {
        status: !enabled ? 'idle' : current ? result.status : 'loading',
        options: current ? result.options : [],
        error: current ? result.error : '',
        reload: () => setReloadKey((key) => key + 1),
    }
}
