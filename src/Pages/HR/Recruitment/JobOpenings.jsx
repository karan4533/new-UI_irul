import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { DEPARTMENTS } from '../domain/hrStatus'
import { getJobs, nextId, pushNotification, saveJobs } from '../domain/hrStore'
import { Badge, HrExport, Modal, PageIntro, PrimaryButton, SearchBox, Select, TableWrap, inputClass } from '../components/HrUi'
import { matches, useFilters, useHrTick } from '../components/hrUiState'
import { DataTable, FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { useHrLiveCollection } from '../hooks/useHrLiveCollection'

const STATUSES = ['Draft', 'Open', 'On Hold', 'Closed', 'Filled']
const empty = { position: '', department: 'Academic', designation: '', openings: 1, employmentType: 'Full Time', experience: '', qualification: '', location: 'Main Campus', postedDate: '2026-09-24', closingDate: '', hiringManager: '', status: 'Draft', description: '', rolesText: '', rolesFileName: '', rolesFileType: '', internalPosting: false }

const JobOpenings = () => {
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const loadLocal = useCallback(() => {
        void tick
        return getJobs()
    }, [tick])
    const { rows, listLoading, listError, listSource, saving, refresh, createOne, patchOne, replaceAll } = useHrLiveCollection('jobs', {
        loadLocal,
        saveLocal: saveJobs,
    })
    const { filters, set } = useFilters({ search: '', department: '', status: '' })
    const [form, setForm] = useState(null)
    const [exportOpen, setExportOpen] = useState(false)
    const filtered = rows.filter((row) => (!filters.department || row.department === filters.department) && (!filters.status || row.status === filters.status) && matches(`${row.id} ${row.position}`, filters.search))
    const columns = useMemo(() => [
        { key: 'id', label: 'Job ID', required: true },
        { key: 'position', label: 'Position', required: true },
        { key: 'department', label: 'Department' },
        { key: 'openings', label: 'Openings' },
        { key: 'rolesText', label: 'Roles', render: (row) => row.rolesText || row.rolesFileName || '—' },
        { key: 'internalPosting', label: 'Internal', render: (row) => (row.internalPosting ? 'Yes' : 'No') },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
        { key: 'closingDate', label: 'Closing' },
    ], [])

    const save = async (event) => {
        event.preventDefault()
        if (!form.position || !form.closingDate) return toast.error('Position and closing date are required.')
        const record = {
            ...form,
            openings: Number(form.openings) || 1,
            internalPosting: Boolean(form.internalPosting),
            id: form.id || nextId('JOB-2026', rows),
        }

        if (isLiveApiEnabled()) {
            const res = form.id
                ? await patchOne(form.id, record)
                : await createOne(record)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the job opening.')
                return
            }
            toast.success('Job opening saved on server.')
            setForm(null)
            return
        }

        saveJobs(form.id ? getJobs().map((row) => (row.id === form.id ? record : row)) : [record, ...getJobs()])
        if (record.internalPosting && record.status === 'Open') {
            pushNotification({ type: 'Internal Job', title: 'Internal Job Opening', message: `${record.position} is open for internal applicants until ${record.closingDate}.`, relatedDate: record.closingDate })
        }
        toast.success('Job opening saved.')
        setForm(null)
    }

    return (
        <section>
            <PageIntro text={live ? 'Job openings persist on GET/POST/PATCH /api/v1/hr/jobs. No external job board is called.' : 'Internal postings create an HR notification for staff. No external job board is called.'}>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <SearchBox value={filters.search} onChange={set('search')} placeholder='Job title or ID' />
                    <Select label='Department' value={filters.department} onChange={set('department')} options={DEPARTMENTS} />
                    <Select label='Status' value={filters.status} onChange={set('status')} options={STATUSES} />
                </div>
            </PageIntro>
            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Jobs API unavailable' : 'Live job openings'}
                    description={listSource === 'error' ? listError : 'Campus-scoped recruitment openings from the HR API.'}
                />
            ) : null}
            {listLoading ? <p className='text-sm text-slate-500 py-4'>Loading job openings…</p> : null}
            {listError && !listLoading ? <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={refresh}>Retry</button> : null}
            {!listLoading ? (
                <TableWrap title='Job Openings' action={<><PrimaryButton disabled={saving} onClick={() => setForm(empty)}>Add Opening</PrimaryButton><PrimaryButton onClick={() => setExportOpen(true)}>Export</PrimaryButton></>}>
                    <DataTable caption='HR job openings' rows={filtered} columns={columns} rowKey='id' emptyTitle='No job openings found' emptyDescription='Change department, status or search to review other openings.' renderActions={(row) => <button type='button' className='min-h-9 rounded-md border border-[var(--erp-indigo)] px-3 text-sm font-semibold text-[var(--erp-indigo)]' onClick={() => setForm(row)}>Edit</button>} />
                </TableWrap>
            ) : null}
            {form && (
                <Modal title='Job Opening' onClose={() => setForm(null)} wide>
                    <form onSubmit={save} className='grid md:grid-cols-2 gap-3'>
                        {['position', 'designation', 'experience', 'qualification', 'location', 'postedDate', 'closingDate', 'hiringManager', 'description'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
                        <input className={inputClass} type='number' min='1' value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
                        <Select label='Department' value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} options={DEPARTMENTS} allLabel='Select' />
                        <Select label='Status' value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} allLabel='Select' />
                        <textarea className={`${inputClass} md:col-span-2`} placeholder='Roles and responsibilities' value={form.rolesText || ''} onChange={(e) => setForm({ ...form, rolesText: e.target.value })} />
                        <label className='text-sm md:col-span-2'>Roles file (PDF or JPG metadata only)
                            <input type='file' accept='application/pdf,image/jpeg,image/jpg,image/png,.png' onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setForm({ ...form, rolesFileName: file.name, rolesFileType: file.type }) }} />
                            {form.rolesFileName && <span className='block text-xs text-[#667085] mt-1'>{form.rolesFileName} · {form.rolesFileType}</span>}
                        </label>
                        <label className='text-sm flex items-center gap-2'><input type='checkbox' checked={!!form.internalPosting} onChange={(e) => setForm({ ...form, internalPosting: e.target.checked })} /> Internal job posting</label>
                        <PrimaryButton type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                    </form>
                </Modal>
            )}
            <HrExport open={exportOpen} setOpen={setExportOpen} filename='job-openings' rows={filtered} />
        </section>
    )
}

export default JobOpenings
