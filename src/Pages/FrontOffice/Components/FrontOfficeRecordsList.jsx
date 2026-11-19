import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Download, Plus } from 'lucide-react'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listFrontOfficeCollection } from '../../../services/api/frontOfficeApiService'

/**
 * LIVE list for /api/v1/front-office/{collection}.
 * Add/edit forms remain role-local; this surfaces server records with loading/empty/error.
 */
const FrontOfficeRecordsList = ({
    collection,
    title,
    description,
    addPath,
    viewPathPrefix,
    columns,
    searchKeys = ['id'],
    localFallback = [],
}) => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState(() => (live ? [] : localFallback))
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [source, setSource] = useState(live ? 'backend' : 'local')
    const [exportModal, setExportModal] = useState(false)

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listFrontOfficeCollection(collection)
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : `Failed to load ${collection}.`)
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
        setSource('backend')
    }, [collection])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRows(Array.isArray(localFallback) ? localFallback : [])
            setSource('local')
            setLoading(false)
            return
        }
        loadLive()
        // localFallback is mock-only; avoid re-running when parent recreates [] each render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadLive])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)),
        )
    }, [rows, search, searchKeys])

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-semibold text-black'>{title}</h1>
                    {description ? <p className='text-sm text-[#667085] mt-1'>{description}</p> : null}
                </div>
                {addPath ? (
                    <NavLink
                        to={addPath}
                        className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                    >
                        <Plus size={16} />
                        Add
                    </NavLink>
                ) : null}
            </div>

            {source === 'backend' ? (
                <p className='text-xs font-medium text-[#027A48]'>
                    Live · GET /api/v1/front-office/{collection}
                </p>
            ) : null}
            {source === 'error' ? (
                <FeedbackState kind='error' title='Front Office API unavailable' description={error} />
            ) : null}
            {loading ? (
                <FeedbackState kind='loading' title={`Loading ${title}`} description='Fetching campus records…' />
            ) : null}

            {!loading && source !== 'error' ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Search</label>
                                <input
                                    type='text'
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Search records…'
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                />
                            </div>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex justify-between items-center mb-4'>
                            <div>
                                <h2 className='text-xl font-medium text-black'>{title}</h2>
                                <p className='text-sm text-[#667085] mt-1'>
                                    Showing {filtered.length} of {rows.length} records
                                    {source === 'local' ? ' (local mock)' : ''}
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={() => setExportModal(true)}
                                className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr>
                                        {columns.map((col, idx) => (
                                            <th
                                                key={col.key}
                                                className={`px-2 py-3.5 text-[#0C1E5B] font-medium uppercase ${idx === 0 ? 'rounded-s-lg' : ''} ${idx === columns.length - 1 && !viewPathPrefix ? 'rounded-e-lg' : ''}`}
                                            >
                                                {col.label}
                                            </th>
                                        ))}
                                        {viewPathPrefix ? (
                                            <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={columns.length + (viewPathPrefix ? 1 : 0)}
                                                className='px-2 py-8 text-center text-[#667085]'
                                            >
                                                No records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((row) => (
                                            <tr key={row.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                                {columns.map((col) => (
                                                    <td key={col.key} className='px-2 py-3'>
                                                        {col.render ? col.render(row) : (row[col.key] || '—')}
                                                    </td>
                                                ))}
                                                {viewPathPrefix ? (
                                                    <td className='px-2 py-3'>
                                                        <NavLink
                                                            to={`${viewPathPrefix}/${row.id}`}
                                                            className='text-[#515DEF] font-semibold hover:underline'
                                                        >
                                                            View
                                                        </NavLink>
                                                    </td>
                                                ) : null}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <ExportModal exportModal={exportModal} setExportModal={setExportModal} recordCount={filtered.length} />
                </>
            ) : null}
        </section>
    )
}

export default FrontOfficeRecordsList
