import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FeedbackState, PageHeader } from '../../../Common/ui'
import { apiClient } from '../../../services/api/apiClient'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const LiveSubjects = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setError('Live API is disabled.')
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await apiClient.get('/api/v1/masters/subjects', { skipMock: true })
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load subjects.')
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) => `${row.code || ''} ${row.name || ''}`.toLowerCase().includes(q))
    }, [rows, search])

    return (
        <section className='space-y-4'>
            <PageHeader
                title='Subjects'
                description='Subject master from /api/v1/masters/subjects.'
                actions={(
                    <div className='flex gap-2'>
                        <button type='button' onClick={load} className='rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 py-2 text-sm font-semibold cursor-pointer'>
                            Refresh
                        </button>
                        <NavLink
                            to='/admin/class/add-subjects'
                            className='inline-flex items-center gap-2 rounded-lg bg-[#515DEF] px-3 py-2 text-sm font-semibold text-white'
                        >
                            <Plus size={16} />
                            Add subject
                        </NavLink>
                    </div>
                )}
            />

            {error ? <FeedbackState kind='error' title='Subjects API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading subjects' description='Fetching masters subjects…' /> : null}

            {!loading && !error ? (
                <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                    <input
                        type='text'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search code or name…'
                        className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full max-w-md'
                    />
                    {filtered.length === 0 ? (
                        <FeedbackState kind='empty' title='No subjects found' description='Add a subject code and name to seed the catalog.' />
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead>
                                    <tr className='border-b border-gray-100 text-[11px] text-gray-400'>
                                        <th className='pb-2.5 pr-3'>Code</th>
                                        <th className='pb-2.5 pr-3'>Name</th>
                                        <th className='pb-2.5'>Id</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-50'>
                                    {filtered.map((row) => (
                                        <tr key={row.id || row.code}>
                                            <td className='py-2.5 pr-3 font-semibold text-gray-900'>{row.code || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.name || '—'}</td>
                                            <td className='py-2.5 text-gray-500'>{row.id || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : null}
        </section>
    )
}

export default LiveSubjects
