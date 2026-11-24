import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { ConfirmAction, DataTable, IntegrationNotice } from '../../../Common/ui'
import { DISCIPLINE_ACTORS, DISCIPLINE_FLOW } from '../domain/hrSeed'
import { canMutate, employeeName, getDisciplinary, getEmployees, nextId, pushNotification, saveDisciplinary } from '../domain/hrStore'
import { Badge, Modal, PageIntro, PrimaryButton, TableWrap, inputClass } from '../components/HrUi'
import { useHrTick } from '../components/hrUiState'
import { useHrLiveCollection } from '../hooks/useHrLiveCollection'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listPortalEmployees } from '../../../services/api/hrApiService'

const Disciplinary = () => {
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const {
        rows: liveRows,
        listLoading,
        listError,
        listSource,
        saving,
        createOne,
        patchOne,
    } = useHrLiveCollection('disciplinary', {
        loadLocal: getDisciplinary,
        saveLocal: saveDisciplinary,
    })
    const localRows = useMemo(() => { void tick; return getDisciplinary().filter((row) => row?.id) }, [tick])
    const rows = (live ? liveRows : localRows).filter((row) => row?.id)
    const [employees, setEmployees] = useState(() => (live ? [] : getEmployees().filter((row) => row?.id)))
    const [form, setForm] = useState(null)
    const [view, setView] = useState(null)
    const [pendingAction, setPendingAction] = useState(null)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setEmployees(getEmployees().filter((row) => row?.id))
            return
        }
        listPortalEmployees().then((res) => {
            if (res.success && Array.isArray(res.data)) setEmployees(res.data.filter((row) => row?.id))
            else setEmployees([])
        })
    }, [tick, live])

    const advance = async (row) => {
        const index = DISCIPLINE_FLOW.indexOf(row.status)
        const status = DISCIPLINE_FLOW[Math.min(index + 1, DISCIPLINE_FLOW.length - 1)]
        const actor = DISCIPLINE_ACTORS[row.status] || 'Employee'
        const next = {
            ...row,
            status,
            acknowledgement: row.acknowledgement,
            chain: [...(row.chain || []), { actor, decision: status === 'APPROVED' ? 'Approved' : 'Recommended', at: new Date().toISOString().slice(0, 10), comments: '' }],
        }
        if (isLiveApiEnabled()) {
            const res = await patchOne(row.id, next)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Disciplinary update was not saved.')
                return
            }
            toast.success(`${row.id} is now ${status} on the server.`)
            setPendingAction(null)
            return
        }
        saveDisciplinary(getDisciplinary().filter(Boolean).map((item) => item.id === row.id ? next : item))
        toast.success(`${row.id} is now ${status} in this browser.`)
        setPendingAction(null)
    }

    const acknowledge = async (row) => {
        if (row.status !== 'APPROVED') return toast.error('Acknowledgement follows final approval.')
        const next = {
            ...row,
            acknowledgement: 'Acknowledged',
            chain: [...(row.chain || []), { actor: 'Employee', decision: 'Acknowledged', at: new Date().toISOString().slice(0, 10), comments: row?.explanation || 'Noted' }],
        }
        if (isLiveApiEnabled()) {
            const res = await patchOne(row.id, next)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Acknowledgement was not saved.')
                return
            }
            toast.success('Employee acknowledgement recorded on the server.')
            setPendingAction(null)
            return
        }
        saveDisciplinary(getDisciplinary().filter(Boolean).map((item) => item.id === row?.id ? next : item))
        toast.success('Employee acknowledgement recorded in this browser.')
        setPendingAction(null)
    }

    const columns = [
        { key: 'id', label: 'Notice', required: true },
        { key: 'employeeId', label: 'Employee', required: true, render: (row) => employeeName(row.employeeId) },
        { key: 'actionType', label: 'Type' },
        { key: 'incident', label: 'Incident' },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]

    return (
        <section>
            {listSource === 'backend' ? (
                <div className='mb-4'><IntegrationNotice state='connected' title='Live disciplinary collection' description='Persists via GET/POST/PATCH /api/v1/hr/disciplinary. Success toasts only follow API confirmation.' /></div>
            ) : listSource === 'error' ? (
                <div className='mb-4'><IntegrationNotice state='failed' title='Disciplinary API unavailable' description={listError || 'Could not load /api/v1/hr/disciplinary.'} /></div>
            ) : (
                <div className='mb-4'><IntegrationNotice state='demo' title='Browser disciplinary register' description='Notices are stored in this browser until live API mode is enabled.' /></div>
            )}
            <PageIntro text='Approved notices stay on file. Edit and delete stay disabled after approval.' />
            <TableWrap title='Disciplinary Action' action={<PrimaryButton disabled={listLoading || saving} onClick={() => employees[0] && setForm({ employeeId: employees[0].id, date: '2026-09-24', actionType: 'Warning', incident: '', details: '', remarks: '' })}>New notice</PrimaryButton>}>
                <DataTable caption='Disciplinary action register' rows={rows} columns={columns} rowKey='id' emptyTitle={listLoading ? 'Loading notices…' : 'No disciplinary notices found'} emptyDescription='Create a notice when a documented HR review is required.' renderActions={(row) => (
                    <>
                        <button type='button' className='min-h-9 rounded-md border border-[#D9D9D9] px-3 text-xs font-semibold text-[#344054]' onClick={() => setView(row)}>History</button>
                        {canMutate(row) && row.status !== 'APPROVED' && <button type='button' disabled={saving} className='min-h-9 rounded-md border border-[#515DEF] px-3 text-xs font-semibold text-[#515DEF]' onClick={() => setPendingAction({ type: 'advance', row })}>Review</button>}
                        {row.status === 'APPROVED' && row.acknowledgement !== 'Acknowledged' && <button type='button' disabled={saving} className='min-h-9 rounded-md border border-[#039855] px-3 text-xs font-semibold text-[#027A48]' onClick={() => setPendingAction({ type: 'acknowledge', row })}>Acknowledge</button>}
                    </>
                )} />
            </TableWrap>
            {view && <Modal title={view.id} onClose={() => setView(null)}><ul className='text-sm space-y-2'>{(view.chain || []).map((step, index) => <li key={index}>{step?.at} · {step?.actor} · {step?.decision} {step?.comments}</li>)}{(view.chain || []).length === 0 && <li>No review steps yet.</li>}</ul></Modal>}
            {form && <DisciplineForm form={form} employees={employees} rows={rows} setForm={setForm} createOne={createOne} />}
            <ConfirmAction open={Boolean(pendingAction)} onClose={() => !saving && setPendingAction(null)} onConfirm={() => { if (!pendingAction) return; if (pendingAction.type === 'acknowledge') acknowledge(pendingAction.row); else advance(pendingAction.row) }} title={pendingAction?.type === 'acknowledge' ? 'Record acknowledgement?' : 'Advance disciplinary review?'} description='This appends a new step to the disciplinary history.' confirmLabel={pendingAction?.type === 'acknowledge' ? 'Record acknowledgement' : 'Advance review'}>
                <p><strong>{pendingAction?.row?.id}</strong> · {pendingAction?.row ? employeeName(pendingAction.row.employeeId) : ''}. Production must derive the actor from the authenticated role and persist an immutable timestamp and decision rationale.</p>
            </ConfirmAction>
        </section>
    )
}

const DisciplineForm = ({ form, employees, rows, setForm, createOne }) => {
    const save = async (event) => {
        event.preventDefault()
        if (!form?.incident?.trim()) return toast.error('Deviation or incident is required.')
        const record = { id: nextId('DSC-2026', rows), employeeId: form.employeeId, date: form.date, actionType: form.actionType, incident: form.incident, details: form.details, previous: 'None', explanation: '', acknowledgement: 'Pending', remarks: form.remarks, status: 'HR_REVIEW', chain: [] }
        if (isLiveApiEnabled()) {
            const res = await createOne(record)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Notice was not saved on the server.')
                return
            }
            toast.success('Notice saved on the server (HR review).')
            setForm(null)
            return
        }
        saveDisciplinary([record, ...getDisciplinary()])
        pushNotification({ type: 'Disciplinary', title: 'Disciplinary Review Pending', message: `${record.actionType} for ${employeeName(record.employeeId)}.`, relatedDate: record.date })
        toast.success('Notice saved in this browser (HR review).')
        setForm(null)
    }
    return (
        <Modal title='Disciplinary notice' onClose={() => setForm(null)}>
            <form onSubmit={save} className='grid gap-3'>
                <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select className={inputClass} value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}><option>Warning</option><option>Memo</option><option>Suspended</option></select>
                <input className={inputClass} placeholder='Deviation / incident' value={form.incident} onChange={(e) => setForm({ ...form, incident: e.target.value })} />
                <input className={inputClass} placeholder='Details' value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                <PrimaryButton type='submit'>Save</PrimaryButton>
            </form>
        </Modal>
    )
}

export default Disciplinary
