import React, { useEffect, useMemo, useState } from 'react'
import { DEPARTMENTS } from '../domain/hrStatus'
import { employeeName, getAdvances, getAttendance, getCandidates, getDisciplinary, getEmployees, getExits, getInterviews, getLeaveBundle, getPerformance, getReferrals, getTraining, salaryRows } from '../domain/hrStore'
import { formatInr } from '../domain/payrollCalculations'
import { HrExport, PageIntro, PrimaryButton } from '../components/HrUi'
import { useHrTick } from '../components/hrUiState'
import { DataTable, FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getHrLeaveBundle,
    getHrPayrollBundle,
    listHrCollection,
    listPortalEmployees,
} from '../../../services/api/hrApiService'
import { buildSalaryRow } from '../domain/payrollCalculations'

const REPORTS = ['Headcount', 'New Joiners', 'Relieved', 'Recruitment', 'Interviews', 'Attendance', 'Leave', 'Training', 'Performance', 'Payroll', 'Salary Advance', 'Referral', 'Disciplinary', 'Exit']

const Reports = () => {
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const [type, setType] = useState('Headcount')
    const [department, setDepartment] = useState('')
    const [exportOpen, setExportOpen] = useState(false)
    const [liveData, setLiveData] = useState(null)
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [refreshNonce, setRefreshNonce] = useState(0)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setLiveData(null)
            setListLoading(false)
            setListError('')
            return
        }
        let cancelled = false
        ;(async () => {
            setListLoading(true)
            setListError('')
            const [
                emp, candidates, interviews, attendance, leave, training, performance,
                payroll, advances, referrals, disciplinary, exits,
            ] = await Promise.all([
                listPortalEmployees(),
                listHrCollection('candidates'),
                listHrCollection('interviews'),
                listHrCollection('attendance'),
                getHrLeaveBundle(),
                listHrCollection('training'),
                listHrCollection('performance'),
                getHrPayrollBundle(),
                listHrCollection('advances'),
                listHrCollection('referrals'),
                listHrCollection('disciplinary'),
                listHrCollection('exits'),
            ])
            if (cancelled) return
            setListLoading(false)
            const failed = [emp, candidates, interviews, attendance, leave, training, performance, payroll, advances, referrals, disciplinary, exits]
                .find((res) => !res.success)
            if (failed) {
                setListError(typeof failed.error === 'string' ? failed.error : 'Failed to load one or more HR report sources.')
                setLiveData(null)
                return
            }
            setLiveData({
                employees: emp.data || [],
                candidates: candidates.data || [],
                interviews: interviews.data || [],
                attendance: attendance.data || [],
                leave: leave.data || { requests: [] },
                training: training.data || [],
                performance: performance.data || [],
                payroll: payroll.data || { months: [] },
                advances: advances.data || [],
                referrals: referrals.data || [],
                disciplinary: disciplinary.data || [],
                exits: exits.data || [],
            })
        })()
        return () => { cancelled = true }
    }, [refreshNonce])

    const rows = useMemo(() => {
        void tick
        if (isLiveApiEnabled()) {
            if (!liveData) return []
            const employees = liveData.employees.filter((item) => !department || item.department === department)
            const nameFor = (id) => employees.find((item) => item.id === id)?.name || id
            const payrollRows = employees.map((employee) => {
                const attendance = (liveData.payroll.months || []).find(
                    (item) => item?.employeeId === employee.id && item.month === 'June' && Number(item.year) === 2026,
                ) || {
                    employeeId: employee.id, month: 'June', year: 2026, workingDays: 26, lates: 0, permission: 0,
                    casualLeave: 0, otherLeave: 0, absent: 0, notPunched: 0, paymentStatus: 'Unpaid',
                }
                return buildSalaryRow({
                    employee,
                    attendance,
                    advances: liveData.advances,
                    disciplinaryActions: liveData.disciplinary,
                    month: 'June',
                    year: 2026,
                })
            })
            const map = {
                Headcount: employees.map((item) => ({ Employee: item.name, Department: item.department, Category: item.category, Status: item.status })),
                'New Joiners': employees.filter((item) => String(item.joiningDate || '').includes('2026')).map((item) => ({ Employee: item.name, Joining: item.joiningDate, Department: item.department })),
                Relieved: employees.filter((item) => item.category === 'Relieved' || item.status === 'Inactive').map((item) => ({ Employee: item.name, Status: item.status })),
                Recruitment: liveData.candidates.map((item) => ({ Candidate: item.name, Position: item.position, Status: item.status })),
                Interviews: liveData.interviews.map((item) => ({ Interview: item.id, Level: item.level, Status: item.status })),
                Attendance: liveData.attendance.map((item) => ({ Employee: nameFor(item.employeeId), Date: item.date, Status: item.status })),
                Leave: (liveData.leave.requests || []).map((item) => ({ Employee: nameFor(item.employeeId), Type: item.leaveType, Status: item.status })),
                Training: liveData.training.map((item) => ({ Title: item.title, Status: item.status, Participants: (item.participantIds || []).length })),
                Performance: liveData.performance.map((item) => ({ Employee: nameFor(item.employeeId), Rating: item.rating, BSC: item.bsc })),
                Payroll: payrollRows.filter((item) => !department || item.department === department).map((item) => ({ Employee: item.employeeName, Net: formatInr(item.netSalary), Category: item.category })),
                'Salary Advance': liveData.advances.map((item) => ({ Request: item.id, Employee: nameFor(item.employeeId), Status: item.status })),
                Referral: liveData.referrals.map((item) => ({ Referral: item.id, Employee: nameFor(item.referrerId), Amount: item.amount, Status: item.status })),
                Disciplinary: liveData.disciplinary.map((item) => ({ Notice: item.id, Employee: nameFor(item.employeeId), Type: item.actionType, Status: item.status })),
                Exit: liveData.exits.map((item) => ({ Employee: nameFor(item.employeeId), Status: item.status, LastWorking: item.lastWorkingDate })),
            }
            return map[type] || []
        }

        const employees = getEmployees().filter((item) => !department || item.department === department)
        const map = {
            Headcount: employees.map((item) => ({ Employee: item.name, Department: item.department, Category: item.category, Status: item.status })),
            'New Joiners': employees.filter((item) => item.joiningDate.includes('2026')).map((item) => ({ Employee: item.name, Joining: item.joiningDate, Department: item.department })),
            Relieved: employees.filter((item) => item.category === 'Relieved' || item.status === 'Inactive').map((item) => ({ Employee: item.name, Status: item.status })),
            Recruitment: getCandidates().map((item) => ({ Candidate: item.name, Position: item.position, Status: item.status })),
            Interviews: getInterviews().map((item) => ({ Interview: item.id, Level: item.level, Status: item.status })),
            Attendance: getAttendance().map((item) => ({ Employee: employeeName(item.employeeId), Date: item.date, Status: item.status })),
            Leave: getLeaveBundle().requests.map((item) => ({ Employee: employeeName(item.employeeId), Type: item.leaveType, Status: item.status })),
            Training: getTraining().map((item) => ({ Title: item.title, Status: item.status, Participants: item.participantIds.length })),
            Performance: getPerformance().map((item) => ({ Employee: employeeName(item.employeeId), Rating: item.rating, BSC: item.bsc })),
            Payroll: salaryRows('June', 2026).filter((item) => !department || item.department === department).map((item) => ({ Employee: item.employeeName, Net: formatInr(item.netSalary), Category: item.category })),
            'Salary Advance': getAdvances().map((item) => ({ Request: item.id, Employee: employeeName(item.employeeId), Status: item.status })),
            Referral: getReferrals().map((item) => ({ Referral: item.id, Employee: employeeName(item.referrerId), Amount: item.amount, Status: item.status })),
            Disciplinary: getDisciplinary().map((item) => ({ Notice: item.id, Employee: employeeName(item.employeeId), Type: item.actionType, Status: item.status })),
            Exit: getExits().map((item) => ({ Employee: employeeName(item.employeeId), Status: item.status, LastWorking: item.lastWorkingDate })),
        }
        return map[type] || []
    }, [tick, type, department, liveData])

    const headers = rows[0] ? Object.keys(rows[0]) : []
    const columns = headers.map((header, index) => ({ key: header, label: header, required: index === 0 }))

    return (
        <section>
            {live ? (
                <FeedbackState
                    tone={listError ? 'danger' : 'info'}
                    title={listError ? 'HR reports API unavailable' : 'Live HR reports'}
                    description={listError || 'Reports are derived reads from verified HR collections (no dedicated /hr/reports endpoint).'}
                />
            ) : (
                <IntegrationNotice state='demo' title='Browser-generated HR reports' description='Reports read local demonstration records. CSV and print output are generated in this browser and are not authoritative regulatory, payroll or personnel reports.' />
            )}
            <PageIntro text='Each report reads the same HR records. Filters apply where the report has a department column or employee list.'>
                <div className='flex flex-wrap gap-2 mb-4'>{REPORTS.map((item) => <button key={item} type='button' onClick={() => setType(item)} className={`text-sm px-3 py-1.5 rounded-md cursor-pointer ${type === item ? 'bg-[#515DEF] text-white' : 'border border-[#515DEF] text-[#515DEF]'}`}>{item}</button>)}</div>
                <select className='border rounded-md px-2 py-2 text-sm' value={department} onChange={(e) => setDepartment(e.target.value)}><option value=''>All departments</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select>
            </PageIntro>
            {listLoading ? <p className='text-sm text-slate-500 py-4'>Loading report sources…</p> : null}
            {listError && !listLoading ? (
                <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={() => setRefreshNonce((n) => n + 1)}>Retry</button>
            ) : null}
            {!listLoading ? (
                <div className='mt-6 overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                    <div className='flex justify-between mb-3'><h2 className='text-xl'>{type}</h2><PrimaryButton onClick={() => setExportOpen(true)}>Export</PrimaryButton></div>
                    <DataTable caption={`${type} HR report`} rows={rows} columns={columns} rowKey={(row, index) => `${type}-${index}-${row[headers[0]] || 'record'}`} emptyTitle={`No ${type.toLowerCase()} records`} emptyDescription='Change the report type or department filter to review other records.' />
                </div>
            ) : null}
            <HrExport open={exportOpen} setOpen={setExportOpen} filename={`hr-${type}`} rows={rows} />
        </section>
    )
}

export default Reports
