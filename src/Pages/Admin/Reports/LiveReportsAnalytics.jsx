import React, { useCallback, useEffect, useState } from 'react'
import { FeedbackState, PageHeader, Surface } from '../../../Common/ui'
import { getAdminDashboard } from '../../../services/api/adminDashboardApiService'
import { listAttendance } from '../../../services/api/attendanceApiService'
import { getFinanceState } from '../../../services/api/financeApiService'
import { listHrCollection } from '../../../services/api/hrApiService'
import { hydrateOpsCollection } from '../../../services/api/opsLiveStore'

const todayIso = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const countBy = (rows, pick) => rows.reduce((acc, row) => {
    const key = pick(row) || 'Unmarked'
    acc[key] = (acc[key] || 0) + 1
    return acc
}, {})

const asArray = (value) => (Array.isArray(value) ? value : [])

const Tile = ({ label, value }) => (
    <div className='rounded-xl border border-[var(--erp-line)] bg-white p-4'>
        <p className='text-xs font-medium text-[var(--erp-slate)]'>{label}</p>
        <p className='mt-1 text-2xl font-semibold text-[var(--erp-ink)]'>{value}</p>
    </div>
)

const Section = ({ title, description, state, tiles }) => (
    <Surface title={title} description={description} contentClassName='p-4 sm:p-5'>
        {state.loading ? (
            <FeedbackState compact kind='loading' title='Loading' description='Fetching live figures…' />
        ) : state.error ? (
            <FeedbackState compact kind='error' title='Unavailable' description={state.error} />
        ) : (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {tiles(state.data).map((tile) => <Tile key={tile.label} {...tile} />)}
            </div>
        )}
    </Surface>
)

const initial = { loading: true, error: '', data: null }
const fail = (res, fallback) => ({ loading: false, error: typeof res?.error === 'string' && res.error ? res.error : fallback, data: null })

/**
 * Admin Reports & Analytics — live figures only (VITE_USE_MOCK=false). No sample report rows.
 */
const LiveReportsAnalytics = () => {
    const [campus, setCampus] = useState(initial)
    const [attendance, setAttendance] = useState(initial)
    const [finance, setFinance] = useState(initial)
    const [operations, setOperations] = useState(initial)
    const [asOf, setAsOf] = useState('')

    const load = useCallback(async () => {
        setCampus(initial)
        setAttendance(initial)
        setFinance(initial)
        setOperations(initial)

        getAdminDashboard().then((res) => {
            setCampus(res.success ? { loading: false, error: '', data: res.data } : fail(res, 'Campus summary could not be loaded.'))
            if (res.success) setAsOf(res.data.asOf || '')
        })

        Promise.all([listAttendance({ date: todayIso() }), listHrCollection('attendance')]).then(([studentRes, staffRes]) => {
            if (!studentRes.success && !staffRes.success) {
                setAttendance(fail(studentRes, 'Attendance could not be loaded.'))
                return
            }
            const students = countBy(asArray(studentRes.data), (row) => row.attendanceStatus || row.status)
            const staffRows = asArray(staffRes.data)
            const staffToday = staffRows.filter((row) => row.date === todayIso())
            const staff = countBy(staffToday.length ? staffToday : [], (row) => row.status)
            setAttendance({ loading: false, error: '', data: { students, staff, studentTotal: asArray(studentRes.data).length, staffTotal: staffToday.length } })
        })

        getFinanceState().then((res) => {
            if (!res.success) {
                setFinance(fail(res, 'Finance figures could not be loaded.'))
                return
            }
            const data = res.data?.data || {}
            const approvals = asArray(data.approvals)
            const transactions = asArray(data.transactions)
            setFinance({
                loading: false,
                error: '',
                data: {
                    transactions: transactions.length,
                    value: transactions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
                    receipts: asArray(data.receipts).length,
                    pendingApprovals: approvals.filter((row) => String(row.status || '').toLowerCase() === 'pending').length,
                },
            })
        })

        Promise.all([
            hydrateOpsCollection('ops:gate-visitors', { force: true }),
            hydrateOpsCollection('ops:gate-incidents', { force: true }),
            hydrateOpsCollection('ops:hostel-assignments', { force: true }),
        ]).then(([visitors, incidents, hostel]) => {
            if (!visitors.success && !incidents.success && !hostel.success) {
                setOperations(fail(visitors, 'Operations figures could not be loaded.'))
                return
            }
            setOperations({
                loading: false,
                error: '',
                data: {
                    visitors: asArray(visitors.rows).length,
                    incidents: asArray(incidents.rows).length,
                    hostel: asArray(hostel.rows).length,
                },
            })
        })
    }, [])

    useEffect(() => {
        load()
    }, [load])

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Reports & analytics'
                description='Campus-wide figures for administration, attendance, finance and operations.'
                context={asOf ? `As of ${asOf}` : undefined}
                actions={(
                    <button type='button' onClick={load} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)] cursor-pointer'>
                        Refresh
                    </button>
                )}
            />

            <Section
                title='Campus'
                description='Directory and workflow totals.'
                state={campus}
                tiles={(d) => [
                    { label: 'Students', value: d.students },
                    { label: 'Employees', value: d.employees },
                    { label: 'Leave requests', value: d.leaveRequests },
                    { label: 'Open escalations', value: d.openEscalations },
                    { label: 'Pending TC requests', value: d.pendingTc },
                    { label: 'Unread notifications', value: d.unreadNotifications },
                    { label: 'Announcements this month', value: d.announcementsThisMonth },
                ]}
            />

            <Section
                title='Attendance today'
                description='Student roll and staff attendance for today.'
                state={attendance}
                tiles={(d) => [
                    { label: 'Student records', value: d.studentTotal },
                    { label: 'Students present', value: d.students.Present || 0 },
                    { label: 'Students absent', value: d.students.Absent || 0 },
                    { label: 'Staff records', value: d.staffTotal },
                    { label: 'Staff present', value: d.staff.Present || 0 },
                    { label: 'Staff late', value: d.staff.Late || 0 },
                    { label: 'Staff on leave', value: d.staff.Leave || 0 },
                    { label: 'Staff absent', value: d.staff.Absent || 0 },
                ]}
            />

            <Section
                title='Finance'
                description='Campus finance ledger totals.'
                state={finance}
                tiles={(d) => [
                    { label: 'Transactions', value: d.transactions },
                    { label: 'Total transaction value', value: `₹ ${d.value.toLocaleString('en-IN')}` },
                    { label: 'Receipts', value: d.receipts },
                    { label: 'Pending approvals', value: d.pendingApprovals },
                ]}
            />

            <Section
                title='Operations'
                description='Gate security and hostel records.'
                state={operations}
                tiles={(d) => [
                    { label: 'Gate visitors', value: d.visitors },
                    { label: 'Gate incidents', value: d.incidents },
                    { label: 'Hostel assignments', value: d.hostel },
                ]}
            />
        </section>
    )
}

export default LiveReportsAnalytics
