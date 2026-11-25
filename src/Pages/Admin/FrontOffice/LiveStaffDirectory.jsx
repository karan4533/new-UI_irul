import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Download } from 'lucide-react'
import mo_user from '../../../assets/images/no-profile.png'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState, PageHeader } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listPortalEmployees } from '../../../services/api/hrApiService'

const matchesRole = (row, matchers = []) => {
    const hay = `${row.designation || ''} ${row.role || ''} ${row.department || ''}`.toLowerCase()
    return matchers.some((token) => hay.includes(String(token).toLowerCase()))
}

/**
 * Live HR portal directory filtered by designation/role keywords (teachers, librarians, drivers).
 */
const LiveStaffDirectory = ({
    title,
    description,
    matchers,
    employeeDbPath = '/admin/user-management/employee-database',
    addPath = null,
}) => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [exportModal, setExportModal] = useState(false)

    const matcherKey = Array.isArray(matchers) ? matchers.join('|') : ''

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setRows([])
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listPortalEmployees()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load staff directory.')
            setRows([])
            return
        }
        const tokens = matcherKey ? matcherKey.split('|') : []
        const filtered = (res.data || []).filter((row) => matchesRole(row, tokens))
        setRows(filtered)
    }, [matcherKey])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            `${row.id || ''} ${row.name || ''} ${row.email || ''} ${row.designation || ''} ${row.role || ''} ${row.department || ''}`
                .toLowerCase()
                .includes(q),
        )
    }, [rows, search])

    return (
        <section className='space-y-4'>
            <PageHeader
                title={title}
                description={description}
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='inline-flex items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 py-2 text-sm font-semibold text-[var(--erp-ink)] cursor-pointer'
                        >
                            <Download size={16} />
                            Export
                        </button>
                        <NavLink
                            to={employeeDbPath}
                            className='inline-flex items-center rounded-lg border border-[#515DEF] bg-white px-3 py-2 text-sm font-semibold text-[#515DEF]'
                        >
                            Full employee database
                        </NavLink>
                        {addPath ? (
                            <NavLink
                                to={addPath}
                                className='inline-flex items-center rounded-lg bg-[#515DEF] px-3 py-2 text-sm font-semibold text-white'
                            >
                                Add via HR form
                            </NavLink>
                        ) : null}
                    </div>
                )}
            />

            {error ? <FeedbackState kind='error' title='Staff directory unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title={`Loading ${title}`} description='Fetching from HR portal API…' /> : null}

            {!loading && !error ? (
                <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                    <div className='flex flex-col gap-y-2 max-w-md'>
                        <label className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Name, id, email, designation…'
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <FeedbackState
                            kind='empty'
                            title={`No ${title.toLowerCase()} found`}
                            description='No matching employees on the HR portal. Create staff from the employee database / RBAC user flow.'
                        />
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left'>
                                <thead>
                                    <tr className='border-b border-gray-100 text-[11px] font-medium text-gray-400 whitespace-nowrap'>
                                        <th className='pb-2.5 pr-3'>Staff</th>
                                        <th className='pb-2.5 pr-3'>Code</th>
                                        <th className='pb-2.5 pr-3'>Designation</th>
                                        <th className='pb-2.5 pr-3'>Department</th>
                                        <th className='pb-2.5 pr-3'>Email</th>
                                        <th className='pb-2.5 pr-3'>Status</th>
                                        <th className='pb-2.5 text-right'>View</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-50 text-xs'>
                                    {filtered.map((row) => (
                                        <tr key={row.id}>
                                            <td className='py-2.5 pr-3'>
                                                <div className='flex items-center gap-2'>
                                                    <img src={mo_user} alt='' className='w-8 h-8 rounded-full' />
                                                    <span className='font-semibold text-gray-900'>{row.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className='py-2.5 pr-3 text-gray-700'>{row.id || '—'}</td>
                                            <td className='py-2.5 pr-3 text-gray-600'>{row.designation || row.role || '—'}</td>
                                            <td className='py-2.5 pr-3 text-gray-600'>{row.department || '—'}</td>
                                            <td className='py-2.5 pr-3 text-gray-600'>{row.email || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.status || 'Active'}</td>
                                            <td className='py-2.5 text-right'>
                                                <NavLink
                                                    to={`${employeeDbPath}/view/${encodeURIComponent(row.id)}`}
                                                    className='text-[#515DEF] font-semibold hover:underline'
                                                >
                                                    Open
                                                </NavLink>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : null}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} recordCount={filtered.length} />
        </section>
    )
}

export default LiveStaffDirectory
