import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { RefreshCw, Users, CheckCircle2, Clock, CalendarX, FileText } from 'lucide-react'
import { employeeName, getAttendance, getEmployees, saveAttendance } from '../domain/hrStore'
import { PageIntro, SearchBox, Select, TableWrap } from '../components/HrUi'
import { matches, useFilters, useHrTick } from '../components/hrUiState'
import { DataTable, FeedbackState } from '../../../Common/ui'
import { syncEsslDevices } from '../../../Common/AttendanceAndLeave/esslBiometricEngine'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHrCollection, listPortalEmployees, patchHrItem, replaceHrCollection } from '../../../services/api/hrApiService'

const Attendance = () => {
    const live = isLiveApiEnabled()
    const tick = useHrTick()
    const [rows, setRows] = useState(() => (live ? [] : getAttendance()))
    const [employees, setEmployees] = useState(() => (live ? [] : getEmployees()))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [saving, setSaving] = useState(false)
    const [refreshNonce, setRefreshNonce] = useState(0)
    const { filters, set } = useFilters({ search: '', status: '', date: '' })

    const loadLocal = useCallback(() => {
        void tick
        setRows(getAttendance())
        setEmployees(getEmployees())
        setListSource('local')
        setListError('')
        setListLoading(false)
    }, [tick])

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const [attRes, empRes] = await Promise.all([listHrCollection('attendance'), listPortalEmployees()])
        setListLoading(false)
        if (!attRes.success) {
            setListSource('error')
            setListError(typeof attRes.error === 'string' ? attRes.error : 'Failed to load attendance from the API.')
            setRows([])
            setEmployees([])
            return
        }
        setRows(Array.isArray(attRes.data) ? attRes.data : [])
        setEmployees(empRes.success && Array.isArray(empRes.data) ? empRes.data : [])
        setListSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            loadLocal()
            return
        }
        loadLive()
    }, [loadLive, loadLocal, refreshNonce])

    useEffect(() => {
        if (isLiveApiEnabled()) return undefined
        const handleHrUpdate = () => setRefreshNonce((v) => v + 1)
        window.addEventListener('schoolerp-hr-updated', handleHrUpdate)
        return () => window.removeEventListener('schoolerp-hr-updated', handleHrUpdate)
    }, [])

    const nameFor = useCallback((id) => {
        const hit = employees.find((item) => item.id === id)
        return hit?.name || employeeName(id)
    }, [employees])

    const availableDates = useMemo(() => {
        const dates = Array.from(new Set(rows.map((r) => r.date).filter(Boolean)))
        return dates.sort()
    }, [rows])

    const filtered = useMemo(() => rows.filter((row) => {
        if (filters.status && row.status !== filters.status) return false
        if (filters.date && row.date !== filters.date) return false
        if (filters.search && !matches(`${nameFor(row.employeeId)} ${row.employeeId}`, filters.search)) return false
        return true
    }), [rows, filters, nameFor])

    const kpis = useMemo(() => {
        const targetRows = filters.date ? rows.filter((r) => r.date === filters.date) : rows
        return {
            total: targetRows.length,
            present: targetRows.filter((r) => r.status === 'Present').length,
            late: targetRows.filter((r) => r.status === 'Late').length,
            leave: targetRows.filter((r) => r.status === 'Leave').length,
            absent: targetRows.filter((r) => r.status === 'Absent').length,
        }
    }, [rows, filters.date])

    const changeStatus = async (row, status) => {
        if (row.status === status) return
        const nextRow = {
            ...row,
            previousStatus: row.status,
            status,
            statusChangedBy: 'HR',
            statusChangedAt: new Date().toLocaleDateString('en-GB'),
        }

        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await patchHrItem('attendance', row.id, nextRow)
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the attendance update.')
                return
            }
            setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...res.data } : item)))
            toast.success(`${row.status} changed to ${status} on server.`)
            return
        }

        saveAttendance(getAttendance().map((item) => (item.id === row.id ? nextRow : item)))
        toast.success(`${row.status} changed to ${status}. Payroll uses the saved status.`)
        setRefreshNonce((n) => n + 1)
    }

    const handleSyncBiometric = async () => {
        if (isLiveApiEnabled()) {
            toast.info('eSSL biometric sync is not connected to the live API. Attendance is loaded from GET /hr/attendance only.')
            setRefreshNonce((n) => n + 1)
            return
        }
        const res = syncEsslDevices()
        setRefreshNonce((v) => v + 1)
        toast.success(`eSSL Biometric punches synced successfully (${res.totalPunchesProcessed || 0} punches processed).`)
    }

    const persistAll = async () => {
        if (!isLiveApiEnabled()) return
        setSaving(true)
        const res = await replaceHrCollection('attendance', rows)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not replace attendance collection.')
            return
        }
        setRows(res.data)
        toast.success('Attendance collection saved on server.')
    }

    const columns = [
        {
            key: 'employeeId',
            label: 'Employee',
            required: true,
            render: (row) => (
                <>
                    <span className='font-semibold text-[var(--erp-ink)]'>{nameFor(row.employeeId)}</span>
                    <span className='block text-xs text-[var(--erp-muted)]'>{row.employeeId}</span>
                </>
            ),
        },
        { key: 'date', label: 'Date' },
        { key: 'punchIn', label: 'Punch in', render: (row) => row.punchIn || row.checkIn || '—' },
        { key: 'punchOut', label: 'Punch out', render: (row) => row.punchOut || row.checkOut || '—' },
        {
            key: 'status',
            label: 'Status',
            required: true,
            render: (row) => (
                <>
                    <select
                        aria-label={`Attendance status for ${nameFor(row.employeeId)}`}
                        className={`min-h-9 rounded-md border border-[var(--erp-line-strong)] px-2 text-sm font-medium ${
                            row.status === 'Present'
                                ? 'bg-emerald-50 text-emerald-800'
                                : row.status === 'Late'
                                    ? 'bg-amber-50 text-amber-800'
                                    : row.status === 'Leave'
                                        ? 'bg-blue-50 text-blue-800'
                                        : 'bg-rose-50 text-rose-800'
                        }`}
                        value={row.status}
                        disabled={saving}
                        onChange={(event) => changeStatus(row, event.target.value)}
                    >
                        {['Present', 'Late', 'Leave', 'Absent'].map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                    {row.previousStatus ? <span className='mt-1 block text-xs text-[var(--erp-muted)]'>Was {row.previousStatus}</span> : null}
                </>
            ),
        },
        { key: 'source', label: 'Source', render: (row) => row.source || 'eSSL Biometric' },
    ]

    return (
        <section className='space-y-4'>
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
                <div className='bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs'>
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold uppercase tracking-wider'>Total Staff</span>
                        <Users className='w-4 h-4 text-slate-400' />
                    </div>
                    <div className='mt-1.5 text-2xl font-bold text-slate-900'>{kpis.total}</div>
                </div>
                <div className='bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-2xs'>
                    <div className='flex items-center justify-between text-emerald-700'>
                        <span className='text-xs font-semibold uppercase tracking-wider'>Present</span>
                        <CheckCircle2 className='w-4 h-4 text-emerald-500' />
                    </div>
                    <div className='mt-1.5 text-2xl font-bold text-emerald-800'>{kpis.present}</div>
                </div>
                <div className='bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 shadow-2xs'>
                    <div className='flex items-center justify-between text-amber-700'>
                        <span className='text-xs font-semibold uppercase tracking-wider'>Late Arrival</span>
                        <Clock className='w-4 h-4 text-amber-500' />
                    </div>
                    <div className='mt-1.5 text-2xl font-bold text-amber-800'>{kpis.late}</div>
                </div>
                <div className='bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 shadow-2xs'>
                    <div className='flex items-center justify-between text-blue-700'>
                        <span className='text-xs font-semibold uppercase tracking-wider'>On Leave</span>
                        <FileText className='w-4 h-4 text-blue-500' />
                    </div>
                    <div className='mt-1.5 text-2xl font-bold text-blue-800'>{kpis.leave}</div>
                </div>
                <div className='bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 shadow-2xs'>
                    <div className='flex items-center justify-between text-rose-700'>
                        <span className='text-xs font-semibold uppercase tracking-wider'>Absent</span>
                        <CalendarX className='w-4 h-4 text-rose-500' />
                    </div>
                    <div className='mt-1.5 text-2xl font-bold text-rose-800'>{kpis.absent}</div>
                </div>
            </div>

            <PageIntro text='Review attendance status and exception history before payroll processing.'>
                <div className='grid md:grid-cols-3 gap-4'>
                    <SearchBox value={filters.search} onChange={set('search')} placeholder='Employee Name or ID' />
                    <Select label='Status' value={filters.status} onChange={set('status')} options={['Present', 'Late', 'Leave', 'Absent']} />
                    {availableDates.length > 1 && (
                        <Select label='Date' value={filters.date} onChange={set('date')} options={availableDates} allLabel='All Dates' />
                    )}
                </div>
            </PageIntro>

            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Attendance API unavailable' : 'Live HR attendance'}
                    description={
                        listSource === 'error'
                            ? listError
                            : 'Records load from GET /api/v1/hr/attendance. Status changes PATCH the server. eSSL device sync remains disconnected.'
                    }
                />
            ) : null}
            {listLoading ? <p className='text-sm text-slate-500 py-4'>Loading attendance…</p> : null}
            {listError && !listLoading ? (
                <button type='button' className='text-sm font-semibold text-[#515DEF]' onClick={() => setRefreshNonce((n) => n + 1)}>Retry</button>
            ) : null}

            {!listLoading ? (
                <TableWrap
                    title='HR Attendance Register'
                    action={(
                        <div className='flex flex-wrap gap-2'>
                            {live ? (
                                <button
                                    type='button'
                                    onClick={persistAll}
                                    disabled={saving}
                                    className='inline-flex items-center gap-1.5 bg-[#515DEF] hover:bg-[#3f48d1] text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60'
                                >
                                    Save collection
                                </button>
                            ) : null}
                            <button
                                type='button'
                                onClick={handleSyncBiometric}
                                className='inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-xs transition-colors cursor-pointer'
                                title='Sync punch records from eSSL biometric / RFID devices'
                            >
                                <RefreshCw className='w-3.5 h-3.5' />
                                Sync eSSL Biometric
                            </button>
                        </div>
                    )}
                >
                    <DataTable
                        caption='HR attendance register'
                        rows={filtered}
                        columns={columns}
                        rowKey='id'
                        emptyTitle='No attendance records found'
                        emptyDescription='Change the search or status filter to review other attendance records.'
                    />
                </TableWrap>
            ) : null}
        </section>
    )
}

export default Attendance
