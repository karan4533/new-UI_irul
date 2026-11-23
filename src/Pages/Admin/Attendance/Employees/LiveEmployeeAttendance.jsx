import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DataTable, DataToolbar, FeedbackState, Pagination, StatusBadge } from '../../../../Common/ui'
import { paginateRows } from '../../../../Common/ui/dataTableState'
import { listHrCollection, listPortalEmployees } from '../../../../services/api/hrApiService'

const STATUS_OPTIONS = ['Present', 'Late', 'Leave', 'Absent']

const LiveEmployeeAttendance = () => {
    const [rows, setRows] = useState([])
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [date, setDate] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        const [attRes, empRes] = await Promise.all([listHrCollection('attendance'), listPortalEmployees()])
        setLoading(false)
        if (!attRes.success) {
            setRows([])
            setError(typeof attRes.error === 'string' ? attRes.error : 'Employee attendance could not be loaded.')
            return
        }
        setRows(Array.isArray(attRes.data) ? attRes.data : [])
        setEmployees(empRes.success && Array.isArray(empRes.data) ? empRes.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const nameFor = useCallback(
        (id) => employees.find((item) => item.id === id || item.employeeId === id)?.name || id || '—',
        [employees],
    )

    const dates = useMemo(() => Array.from(new Set(rows.map((r) => r.date).filter(Boolean))).sort(), [rows])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return rows.filter((row) => {
            if (status && row.status !== status) return false
            if (date && row.date !== date) return false
            if (!q) return true
            return `${nameFor(row.employeeId)} ${row.employeeId || ''}`.toLowerCase().includes(q)
        })
    }, [rows, status, date, search, nameFor])

    const kpis = useMemo(() => {
        const scope = date ? rows.filter((r) => r.date === date) : rows
        const count = (s) => scope.filter((r) => r.status === s).length
        return [
            { label: 'Records', value: scope.length },
            { label: 'Present', value: count('Present') },
            { label: 'Late', value: count('Late') },
            { label: 'On leave', value: count('Leave') },
            { label: 'Absent', value: count('Absent') },
        ]
    }, [rows, date])

    const pagination = paginateRows(filtered, { page, pageSize })

    const columns = [
        { key: 'employeeId', label: 'Employee ID', required: true },
        { key: 'name', label: 'Name', render: (row) => nameFor(row.employeeId) },
        { key: 'date', label: 'Date', render: (row) => row.date || '—' },
        { key: 'checkIn', label: 'Check-in', render: (row) => row.checkIn || row.inTime || '—' },
        { key: 'checkOut', label: 'Check-out', render: (row) => row.checkOut || row.outTime || '—' },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status || 'Unmarked'} /> },
    ]

    if (loading) {
        return <FeedbackState kind='loading' title='Loading employee attendance' description='Fetching attendance records…' />
    }

    if (error) {
        return (
            <FeedbackState
                kind='error'
                title='Unable to load employee attendance'
                description={error}
                action={(
                    <button type='button' onClick={load} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>
                        Retry
                    </button>
                )}
            />
        )
    }

    return (
        <section className='space-y-4'>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
                {kpis.map((kpi) => (
                    <div key={kpi.label} className='rounded-2xl bg-white p-4 shadow-md'>
                        <p className='text-xs font-medium text-[#667085]'>{kpi.label}</p>
                        <p className='mt-1 text-2xl font-semibold text-black'>{kpi.value}</p>
                    </div>
                ))}
            </div>
            <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataToolbar
                    query={search}
                    onQueryChange={(value) => { setSearch(value); setPage(1) }}
                    searchLabel='Search employee attendance'
                    searchPlaceholder='Employee ID or name…'
                    resultCount={filtered.length}
                    onReset={() => { setSearch(''); setStatus(''); setDate(''); setPage(1) }}
                    filters={(
                        <>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All</option>
                                    {STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Date
                                <select value={date} onChange={(event) => { setDate(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All dates</option>
                                    {dates.map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                />
                <DataTable
                    caption='Employee attendance'
                    rows={pagination.rows}
                    columns={columns}
                    rowKey='id'
                    emptyTitle='No employee attendance records'
                    emptyDescription='Change the filters, or no attendance has been recorded yet.'
                />
                <Pagination {...pagination} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} pageSizeOptions={[10, 25, 50]} />
            </div>
        </section>
    )
}

export default LiveEmployeeAttendance
