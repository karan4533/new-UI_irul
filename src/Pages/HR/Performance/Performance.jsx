import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ConfirmAction, DataTable, FeedbackState } from '../../../Common/ui'
import { formatInr } from '../domain/payrollCalculations'
import { applyRevision, canMutate, employeeName, getEmployees, getPerformance, getPayrollBundle, nextId, savePerformance, savePayrollBundle } from '../domain/hrStore'
import { Badge, Modal, PageIntro, PrimaryButton, TableWrap, inputClass } from '../components/HrUi'
import { useHrTick } from '../components/hrUiState'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getHrPayrollBundle,
    listPortalEmployees,
    saveHrPayrollBundle,
} from '../../../services/api/hrApiService'
import { useHrLiveCollection } from '../hooks/useHrLiveCollection'

const RATINGS = ['Above Average', 'Average', 'Below Average']

const Performance = () => {
    const path = useLocation().pathname
    const mode = path.includes('increment') ? 'increment' : path.includes('bsc') ? 'bsc' : path.includes('comparison') ? 'comparison' : 'review'
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const loadLocal = useCallback(() => {
        void tick
        return getPerformance()
    }, [tick])
    const {
        rows: reviews,
        listLoading,
        listError,
        listSource,
        saving,
        refresh,
        createOne,
        patchOne,
    } = useHrLiveCollection('performance', {
        loadLocal,
        saveLocal: savePerformance,
    })
    const [revisions, setRevisions] = useState(() => (live ? [] : (getPayrollBundle().revisions || [])))
    const [employees, setEmployees] = useState(() => (live ? [] : getEmployees()))
    const [form, setForm] = useState(null)
    const [pendingRevision, setPendingRevision] = useState(null)
    const [payrollLoading, setPayrollLoading] = useState(Boolean(live && mode === 'increment'))

    const loadPayroll = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setRevisions(getPayrollBundle().revisions || [])
            setEmployees(getEmployees())
            setPayrollLoading(false)
            return
        }
        setPayrollLoading(true)
        const [payRes, empRes] = await Promise.all([getHrPayrollBundle(), listPortalEmployees()])
        setPayrollLoading(false)
        if (payRes.success) setRevisions(payRes.data.revisions || [])
        if (empRes.success) setEmployees(Array.isArray(empRes.data) ? empRes.data : [])
    }, [])

    useEffect(() => {
        if (mode === 'increment' || live) loadPayroll()
        else {
            setEmployees(getEmployees())
            setRevisions(getPayrollBundle().revisions || [])
        }
    }, [loadPayroll, mode, live, tick, listSource])

    const nameFor = useCallback((id) => {
        const hit = employees.find((item) => item.id === id)
        return hit?.name || employeeName(id)
    }, [employees])

    const saveReview = async (event) => {
        event.preventDefault()
        if (!form.employeeId) return toast.error('Employee is required.')
        const record = {
            ...form,
            id: form.id || nextId('PRF-2026', reviews),
            bsc: Number(form.bsc),
            audit: Number(form.audit),
            score: Number(form.score),
            status: form.status || 'Pending',
        }
        if (isLiveApiEnabled()) {
            const res = form.id ? await patchOne(form.id, record) : await createOne(record)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the performance review.')
                return
            }
            toast.success('Performance review saved on server.')
            setForm(null)
            return
        }
        savePerformance(form.id ? getPerformance().map((item) => (item.id === form.id ? record : item)) : [record, ...getPerformance()])
        toast.success('Performance review saved.')
        setForm(null)
    }

    const commitRevision = async (submittedForm) => {
        const currentGross = Number(submittedForm.currentGross)
        const percent = Number(submittedForm.revisionPercent)
        const revisedGross = Math.round(currentGross * (1 + percent / 100))
        const record = {
            ...submittedForm,
            id: submittedForm.id || nextId('REV-2026', revisions),
            currentGross,
            revisionPercent: percent,
            revisedGross,
            promotion: submittedForm.promotion === true || submittedForm.promotion === 'Yes',
        }
        const next = submittedForm.id
            ? revisions.map((item) => (item.id === submittedForm.id ? record : item))
            : [record, ...revisions]

        if (isLiveApiEnabled()) {
            const pay = await getHrPayrollBundle()
            if (!pay.success) {
                toast.error(typeof pay.error === 'string' ? pay.error : 'Could not load payroll revisions.')
                return
            }
            const res = await saveHrPayrollBundle({
                months: pay.data.months || [],
                revisions: next,
            })
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the salary revision.')
                return
            }
            setRevisions(res.data.revisions || [])
            toast.success(record.status === 'Applied' ? 'Revision saved on server (Applied revisions lock gross).' : 'Revision saved on server.')
            setPendingRevision(null)
            setForm(null)
            return
        }

        savePayrollBundle({ ...getPayrollBundle(), revisions: next })
        applyRevision(record)
        toast.success(record.status === 'Applied' ? 'Revision applied to current salary.' : 'Revision saved.')
        setPendingRevision(null)
        setForm(null)
    }

    const saveRevision = (event) => {
        event.preventDefault()
        if (!form) return
        const percent = Number(form.revisionPercent)
        if (!form.employeeId || !(percent >= 0)) return toast.error('Employee and revision percent are required.')
        const existing = revisions.find((item) => item.id === form.id)
        if (form.id && !canMutate(existing)) return toast.error('Applied revisions are locked.')
        if (form.status === 'Applied') {
            setPendingRevision({ ...form, revisionPercent: percent })
            return
        }
        commitRevision({ ...form, revisionPercent: percent })
    }

    const reviewColumns = [
        { key: 'employeeId', label: 'Employee', required: true, render: (row) => <span className='block'><span className='block font-medium text-[#1E1E1E]'>{nameFor(row.employeeId)}</span><span className='block text-xs text-[#667085]'>{row.reviewer || 'Reviewer pending'}</span></span> },
        { key: 'period', label: 'Period' },
        { key: 'bsc', label: 'BSC' },
        { key: 'audit', label: 'Audit' },
        { key: 'score', label: 'Score' },
        { key: 'rating', label: 'Rating', render: (row) => <Badge value={row.rating} /> },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]
    const revisionColumns = [
        { key: 'employeeId', label: 'Employee', required: true, render: (row) => nameFor(row.employeeId) },
        { key: 'effectiveDate', label: 'Effective' },
        { key: 'currentGross', label: 'Current', render: (row) => formatInr(row.currentGross) },
        { key: 'revisedGross', label: 'Revised', render: (row) => formatInr(row.revisedGross) },
        { key: 'revisionPercent', label: '%' },
        { key: 'promotion', label: 'Promotion', render: (row) => (row.promotion ? 'Yes' : 'No') },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]

    const busy = listLoading || payrollLoading

    return (
        <section>
            <PageIntro text='Ratings stay on Above Average, Average, and Below Average. Applied increments update payroll revision history on the server when live.' />
            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Performance API unavailable' : 'Live performance'}
                    description={listSource === 'error' ? listError : 'Reviews from /hr/performance; increments from /hr/payroll revisions (Applied gross is locked server-side).'}
                />
            ) : null}
            {busy ? <p className='text-sm text-slate-500 py-4'>Loading performance data…</p> : null}
            {listError && !busy ? <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={refresh}>Retry</button> : null}
            {!busy && mode !== 'increment' && (
                <TableWrap title={mode === 'bsc' ? 'BSC / Audit Score' : mode === 'comparison' ? 'Performance Comparison' : 'Performance Review'} action={mode === 'review' && employees[0] ? <PrimaryButton disabled={saving} onClick={() => setForm({ employeeId: employees[0].id, period: '2025–26', reviewer: '', goals: '', bsc: 70, audit: 70, score: 3, strengths: '', improvement: '', remarks: '', rating: 'Average', status: 'Pending' })}>Add Review</PrimaryButton> : null}>
                    <DataTable caption='Employee performance review register' rows={reviews} columns={reviewColumns} rowKey='id' emptyTitle='No performance reviews found' emptyDescription='Create a review when an employee enters the appraisal cycle.' />
                    {mode === 'comparison' && <p className='text-sm text-[#667085] mt-3'>Above average: {reviews.filter((row) => row.rating === 'Above Average').length} · Average: {reviews.filter((row) => row.rating === 'Average').length} · Below average: {reviews.filter((row) => row.rating === 'Below Average').length}</p>}
                </TableWrap>
            )}
            {!busy && mode === 'increment' && (
                <TableWrap title='Increment / Promotion / Revision' action={employees[0] ? <PrimaryButton onClick={() => setForm({ employeeId: employees[0].id, effectiveDate: '2026-04-01', currentDesignation: employees[0].designation, newDesignation: employees[0].designation, currentGross: employees[0].grossSalary, revisionPercent: 5, promotion: 'No', incrementType: 'Annual Increment', reason: '', approvedBy: 'Director Academics', status: 'Draft' })}>Add Revision</PrimaryButton> : null}>
                    <DataTable caption='Salary revision and promotion register' rows={revisions} columns={revisionColumns} rowKey='id' emptyTitle='No salary revisions found' emptyDescription='Create a draft revision to begin the approval workflow.' renderActions={(row) => (canMutate(row) ? <button type='button' className='min-h-9 rounded-md border border-[#515DEF] px-3 text-xs font-semibold text-[#515DEF] hover:bg-[#F1F2FF]' onClick={() => setForm({ ...row, promotion: row.promotion ? 'Yes' : 'No' })}>Edit</button> : null)} />
                </TableWrap>
            )}
            {form && mode !== 'increment' && (
                <Modal title='Review' onClose={() => setForm(null)}>
                    <form onSubmit={saveReview} className='grid gap-3'>
                        <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        {['period', 'reviewer', 'goals', 'bsc', 'audit', 'score', 'strengths', 'improvement', 'remarks'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
                        <select className={inputClass} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>{RATINGS.map((item) => <option key={item}>{item}</option>)}</select>
                        <PrimaryButton type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                    </form>
                </Modal>
            )}
            {form && mode === 'increment' && (
                <Modal title='Revision' onClose={() => setForm(null)}>
                    <form onSubmit={saveRevision} className='grid gap-3'>
                        <select className={inputClass} value={form.employeeId} onChange={(e) => { const employee = employees.find((item) => item.id === e.target.value); setForm({ ...form, employeeId: e.target.value, currentDesignation: employee.designation, currentGross: employee.grossSalary }) }}>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        {['effectiveDate', 'newDesignation', 'currentGross', 'revisionPercent', 'incrementType', 'reason', 'approvedBy'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
                        <select className={inputClass} value={form.promotion} onChange={(e) => setForm({ ...form, promotion: e.target.value })}><option>No</option><option>Yes</option></select>
                        <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['Draft', 'Recommended', 'Approved', 'Rejected', 'Applied'].map((item) => <option key={item}>{item}</option>)}</select>
                        <PrimaryButton type='submit'>Save</PrimaryButton>
                    </form>
                </Modal>
            )}
            <ConfirmAction
                open={Boolean(pendingRevision)}
                onClose={() => setPendingRevision(null)}
                onConfirm={() => pendingRevision && commitRevision(pendingRevision)}
                title='Apply salary revision?'
                description='Applied revisions are locked by the payroll API. Confirm only after approval.'
                confirmLabel='Apply revision'
            />
        </section>
    )
}

export default Performance
