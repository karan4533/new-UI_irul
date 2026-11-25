import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable, DataToolbar, FeedbackState, PageHeader, Pagination } from '../../../Common/ui'
import { paginateRows } from '../../../Common/ui/dataTableState'
import { hydrateOpsCollection } from '../../../services/api/opsLiveStore'

const MAX_COLUMNS = 7
const PRIORITY_KEYS = [
    'id', 'passId', 'gatePassId', 'mgpNo', 'name', 'studentName', 'visitorName', 'vendorName', 'title',
    'type', 'category', 'purpose', 'location', 'date', 'status',
]

const prettify = (key) => String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())

const isScalar = (value) => ['string', 'number', 'boolean'].includes(typeof value)

const pickKeys = (rows) => {
    const seen = new Map()
    rows.slice(0, 50).forEach((row) => {
        Object.entries(row || {}).forEach(([key, value]) => {
            if (key.startsWith('_') || key === 'recordKind') return
            if (!isScalar(value) || value === '') return
            seen.set(key, (seen.get(key) || 0) + 1)
        })
    })
    const keys = [...seen.keys()]
    keys.sort((a, b) => {
        const pa = PRIORITY_KEYS.indexOf(a)
        const pb = PRIORITY_KEYS.indexOf(b)
        if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
        return seen.get(b) - seen.get(a)
    })
    return keys.slice(0, MAX_COLUMNS)
}

/**
 * Read-only live browser for FastAPI-backed collections (ops / front-office / hr / campus-audit).
 * Shows loading / error / empty states only — never mock rows.
 *
 * tabs: [{ id, label, collection: 'ops:gate-visitors' | 'front-office:student-gate-passes' }]
 */
const LiveCollectionTabs = ({ title, description, tabs, defaultTab = null }) => {
    const [activeId, setActiveId] = useState(() => {
        if (defaultTab && tabs.some((tab) => tab.id === defaultTab)) return defaultTab
        return tabs[0]?.id
    })
    const active = tabs.find((tab) => tab.id === activeId) || tabs[0]
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const load = useCallback(async () => {
        if (!active) return
        setLoading(true)
        setError('')
        const res = await hydrateOpsCollection(active.collection, { force: true })
        setLoading(false)
        if (!res.success) {
            setRows([])
            setError(typeof res.error === 'string' ? res.error : 'Records could not be loaded.')
            return
        }
        setRows(Array.isArray(res.rows) ? res.rows : [])
    }, [active])

    useEffect(() => {
        setPage(1)
        setSearch('')
        load()
    }, [load])

    const keys = useMemo(() => pickKeys(rows), [rows])
    const columns = useMemo(
        () => keys.map((key, index) => ({
            key,
            label: prettify(key),
            required: index === 0,
            render: (row) => (row[key] === undefined || row[key] === null || row[key] === '' ? '—' : String(row[key])),
        })),
        [keys],
    )
    const keyed = useMemo(() => rows.map((row, index) => ({ ...row, _rowKey: String(row.id ?? `row-${index}`) })), [rows])
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return keyed
        return keyed.filter((row) => keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)))
    }, [keyed, keys, search])
    const pagination = paginateRows(filtered, { page, pageSize })

    return (
        <section className='space-y-5'>
            <PageHeader title={title} description={description} context={loading ? 'Loading…' : `${rows.length} record(s) in ${active?.label}`} />
            <div className='flex gap-2 overflow-x-auto border-b border-[var(--erp-line)]' role='tablist' aria-label={`${title} views`}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={active?.id === tab.id}
                        onClick={() => setActiveId(tab.id)}
                        className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold cursor-pointer ${active?.id === tab.id ? 'border-[var(--erp-indigo)] text-[var(--erp-indigo)]' : 'border-transparent text-[var(--erp-slate)]'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? <FeedbackState kind='loading' title={`Loading ${active?.label?.toLowerCase()}`} description='Fetching records…' /> : null}
            {!loading && error ? (
                <FeedbackState
                    kind='error'
                    title={`Unable to load ${active?.label?.toLowerCase()}`}
                    description={error}
                    action={<button type='button' onClick={load} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>Retry</button>}
                />
            ) : null}
            {!loading && !error ? (
                <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                    <DataToolbar
                        query={search}
                        onQueryChange={(value) => { setSearch(value); setPage(1) }}
                        searchLabel={`Search ${active?.label}`}
                        searchPlaceholder='Search records…'
                        resultCount={filtered.length}
                        onReset={() => { setSearch(''); setPage(1) }}
                    />
                    <DataTable
                        caption={active?.label}
                        rows={pagination.rows}
                        columns={columns}
                        rowKey='_rowKey'
                        emptyTitle={`No ${active?.label?.toLowerCase()} yet`}
                        emptyDescription='Nothing has been recorded for this campus.'
                    />
                    <Pagination {...pagination} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} pageSizeOptions={[10, 25, 50]} />
                </div>
            ) : null}
        </section>
    )
}

export default LiveCollectionTabs
