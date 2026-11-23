import React, { useCallback, useEffect, useState } from 'react'
import { FeedbackState, PageHeader, Surface } from '../../../Common/ui'
import { listAdmissionEnquiries, listAdmissions } from '../../../services/api/admissionsApiService'
import { listFrontOfficeCollection } from '../../../services/api/frontOfficeApiService'
import { listLeaveRequests } from '../../../services/api/leaveApiService'
import { listTcRequests } from '../../../services/api/tcApiService'
import { hydrateOpsCollection } from '../../../services/api/opsLiveStore'

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
const fail = (res, fallback) => ({
    loading: false,
    error: typeof res?.error === 'string' && res.error ? res.error : fallback,
    data: null,
})

/**
 * Front Office Reports & Analytics — live FO figures only (no sample rows / marketing badges).
 */
const LiveFrontOfficeReports = () => {
    const [admissions, setAdmissions] = useState(initial)
    const [campusMovement, setCampusMovement] = useState(initial)
    const [records, setRecords] = useState(initial)
    const [workforce, setWorkforce] = useState(initial)

    const load = useCallback(async () => {
        setAdmissions(initial)
        setCampusMovement(initial)
        setRecords(initial)
        setWorkforce(initial)

        Promise.all([listAdmissionEnquiries(), listAdmissions(), listTcRequests()]).then(
            ([enqRes, admRes, tcRes]) => {
                if (!enqRes.success && !admRes.success && !tcRes.success) {
                    setAdmissions(fail(enqRes, 'Admissions figures could not be loaded.'))
                    return
                }
                const enquiries = asArray(enqRes.data)
                const admissionsRows = asArray(admRes.data)
                const tcRows = asArray(tcRes.data)
                const openEnquiries = enquiries.filter((row) => {
                    const status = String(row.status || '').toLowerCase()
                    return !status || status.includes('open') || status.includes('pending') || status.includes('follow')
                }).length
                const pendingTc = tcRows.filter((row) => {
                    const status = String(row.status || '').toLowerCase()
                    return status.includes('pending') || status.includes('forward')
                }).length
                setAdmissions({
                    loading: false,
                    error: '',
                    data: {
                        enquiries: enquiries.length,
                        openEnquiries,
                        admissions: admissionsRows.length,
                        tcRequests: tcRows.length,
                        pendingTc,
                    },
                })
            },
        )

        Promise.all([
            hydrateOpsCollection('ops:gate-visitors', { force: true }),
            listFrontOfficeCollection('student-gate-passes'),
            listFrontOfficeCollection('hostel-gate-passes'),
            listFrontOfficeCollection('material-gate-passes'),
            listFrontOfficeCollection('goods-received-passes'),
        ]).then(([visitors, studentGp, hostelGp, materialGp, grp]) => {
            if (
                !visitors.success
                && !studentGp.success
                && !hostelGp.success
                && !materialGp.success
                && !grp.success
            ) {
                setCampusMovement(fail(studentGp, 'Campus movement figures could not be loaded.'))
                return
            }
            setCampusMovement({
                loading: false,
                error: '',
                data: {
                    visitors: asArray(visitors.rows).length,
                    studentPasses: asArray(studentGp.data).length,
                    hostelPasses: asArray(hostelGp.data).length,
                    materialPasses: asArray(materialGp.data).length,
                    goodsReceived: asArray(grp.data).length,
                },
            })
        })

        Promise.all([
            listFrontOfficeCollection('student-transfers'),
            listFrontOfficeCollection('student-re-enrollments'),
        ]).then(([transfers, reEnroll]) => {
            if (!transfers.success && !reEnroll.success) {
                setRecords(fail(transfers, 'Transfer and re-enrollment figures could not be loaded.'))
                return
            }
            setRecords({
                loading: false,
                error: '',
                data: {
                    transfers: asArray(transfers.data).length,
                    reEnrollments: asArray(reEnroll.data).length,
                },
            })
        })

        listLeaveRequests().then((res) => {
            if (!res.success) {
                setWorkforce(fail(res, 'Leave figures could not be loaded.'))
                return
            }
            const rows = asArray(res.data)
            const pending = rows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length
            const approved = rows.filter((row) => String(row.status || '').toLowerCase() === 'approved').length
            setWorkforce({
                loading: false,
                error: '',
                data: {
                    myLeave: rows.length,
                    pendingLeave: pending,
                    approvedLeave: approved,
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
                description='Live Front Office figures for admissions, campus movement, transfers and leave.'
                actions={(
                    <button
                        type='button'
                        onClick={load}
                        className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)] cursor-pointer'
                    >
                        Refresh
                    </button>
                )}
            />

            <Section
                title='Admissions funnel'
                description='Enquiries, admissions and TC workload.'
                state={admissions}
                tiles={(d) => [
                    { label: 'Enquiries', value: d.enquiries },
                    { label: 'Open / follow-up', value: d.openEnquiries },
                    { label: 'Admissions', value: d.admissions },
                    { label: 'TC requests', value: d.tcRequests },
                    { label: 'Pending TC', value: d.pendingTc },
                ]}
            />

            <Section
                title='Campus movement'
                description='Visitors and gate / material passes.'
                state={campusMovement}
                tiles={(d) => [
                    { label: 'Visitors', value: d.visitors },
                    { label: 'Student gate passes', value: d.studentPasses },
                    { label: 'Hostel gate passes', value: d.hostelPasses },
                    { label: 'Material gate passes', value: d.materialPasses },
                    { label: 'Goods received passes', value: d.goodsReceived },
                ]}
            />

            <Section
                title='Student records'
                description='Transfers and re-enrollments on file.'
                state={records}
                tiles={(d) => [
                    { label: 'Transfers', value: d.transfers },
                    { label: 'Re-enrollments', value: d.reEnrollments },
                ]}
            />

            <Section
                title='My leave'
                description='Leave requests filed from this Front Office login.'
                state={workforce}
                tiles={(d) => [
                    { label: 'My leave requests', value: d.myLeave },
                    { label: 'Pending', value: d.pendingLeave },
                    { label: 'Approved', value: d.approvedLeave },
                ]}
            />
        </section>
    )
}

export default LiveFrontOfficeReports
