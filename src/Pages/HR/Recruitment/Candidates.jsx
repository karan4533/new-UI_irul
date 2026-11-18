import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getCandidates, getJobs, nextId, saveCandidates } from '../domain/hrStore'
import { Badge, HrExport, Modal, PageIntro, PrimaryButton, SearchBox, Select, TableWrap, inputClass } from '../components/HrUi'
import { matches, useFilters, useHrTick } from '../components/hrUiState'
import { DataTable, FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHrCollection } from '../../../services/api/hrApiService'
import { useHrLiveCollection } from '../hooks/useHrLiveCollection'

const SOURCES = ['Walk-in', 'Employee Referral', 'Consultancy', 'Job Portal', 'Internal', 'Campus', 'Other']
const STATUSES = ['Applied', 'Screening', 'Interview', 'Selected', 'Rejected', 'On Hold']
const empty = { jobId: '', name: '', dateOfBirth: '', gender: '', maritalStatus: '', address: '', mobile: '', email: '', qualification: '', experience: '', currentCompany: '', currentSalary: '', expectedSalary: '', noticePeriod: '', source: 'Walk-in', reference: '', resumeName: '', resumeSize: '', applicationDate: '2026-09-24', status: 'Applied' }

const Candidates = () => {
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const [params] = useSearchParams()
    const loadLocal = useCallback(() => {
        void tick
        return getCandidates()
    }, [tick])
    const { rows, listLoading, listError, listSource, saving, refresh, createOne, patchOne } = useHrLiveCollection('candidates', {
        loadLocal,
        saveLocal: saveCandidates,
    })
    const [jobs, setJobs] = useState(() => (live ? [] : getJobs()))
    const { filters, set } = useFilters({ search: '', source: '', status: params.get('status') || '' })
    const [form, setForm] = useState(null)
    const [selected, setSelected] = useState(null)
    const [exportOpen, setExportOpen] = useState(false)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setJobs(getJobs())
            return
        }
        listHrCollection('jobs').then((res) => {
            if (res.success) setJobs(Array.isArray(res.data) ? res.data : [])
        })
    }, [listSource, tick])

    const filtered = rows.filter((row) => (!filters.source || row.source === filters.source) && (!filters.status || row.status === filters.status) && matches(`${row.name} ${row.id} ${row.position}`, filters.search))
    const columns = [
        { key: 'id', label: 'Candidate ID', required: true },
        { key: 'name', label: 'Name', required: true },
        { key: 'position', label: 'Position' },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]

    const save = async (event) => {
        event.preventDefault()
        if (!form.name.trim()) return toast.error('Candidate name is required.')
        const job = jobs.find((item) => item.id === form.jobId)
        const record = {
            ...form,
            position: job?.position || form.position,
            currentSalary: Number(form.currentSalary) || 0,
            expectedSalary: Number(form.expectedSalary) || 0,
            id: form.id || nextId('CAN-2026', rows),
        }

        if (isLiveApiEnabled()) {
            const res = form.id ? await patchOne(form.id, record) : await createOne(record)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the candidate.')
                return
            }
            toast.success('Candidate saved on server.')
            setForm(null)
            return
        }

        saveCandidates(form.id ? getCandidates().map((row) => (row.id === form.id ? record : row)) : [record, ...getCandidates()])
        toast.success('Candidate saved.')
        setForm(null)
    }

    return (
        <section>
            <PageIntro text={live ? 'Candidates persist on /api/v1/hr/candidates and stay linked to job openings.' : 'Candidate profiles stay linked to the job and, after joining, to the employee record.'}>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <SearchBox value={filters.search} onChange={set('search')} placeholder='Name or ID' />
                    <Select label='Source' value={filters.source} onChange={set('source')} options={SOURCES} />
                    <Select label='Status' value={filters.status} onChange={set('status')} options={STATUSES} />
                </div>
            </PageIntro>
            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Candidates API unavailable' : 'Live candidates'}
                    description={listSource === 'error' ? listError : 'Campus-scoped candidate register from the HR API.'}
                />
            ) : null}
            {listLoading ? <p className='text-sm text-slate-500 py-4'>Loading candidates…</p> : null}
            {listError && !listLoading ? <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={refresh}>Retry</button> : null}
            {!listLoading ? (
                <TableWrap title='Candidates' action={<><PrimaryButton disabled={saving} onClick={() => setForm({ ...empty, jobId: jobs[0]?.id || '' })}>Add Candidate</PrimaryButton><PrimaryButton onClick={() => setExportOpen(true)}>Export</PrimaryButton></>}>
                    <DataTable caption='HR candidate register' rows={filtered} columns={columns} rowKey='id' emptyTitle='No candidates found' emptyDescription='Change source, status or search to review other candidates.' renderActions={(row) => <><button type='button' className='min-h-9 rounded-md border border-[var(--erp-line-strong)] px-3 text-sm font-semibold' onClick={() => setSelected(row)}>View</button><button type='button' className='min-h-9 rounded-md border border-[var(--erp-indigo)] px-3 text-sm font-semibold text-[var(--erp-indigo)]' onClick={() => setForm(row)}>Edit</button></>} />
                </TableWrap>
            ) : null}
            {selected && (
                <Modal title={selected.name} onClose={() => setSelected(null)}>
                    <div className='grid sm:grid-cols-2 gap-3 text-sm'>{Object.entries(selected).map(([key, value]) => <p key={key}><span className='text-[#808080]'>{key}: </span>{String(value || '—')}</p>)}</div>
                </Modal>
            )}
            {form && (
                <Modal title='Candidate' onClose={() => setForm(null)} wide>
                    <form onSubmit={save} className='grid md:grid-cols-2 gap-3'>
                        <Select label='Position' value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} options={jobs.map((job) => job.id)} allLabel='Select' />
                        {['name', 'dateOfBirth', 'gender', 'maritalStatus', 'address', 'mobile', 'email', 'qualification', 'experience', 'currentCompany', 'currentSalary', 'expectedSalary', 'noticePeriod', 'reference', 'applicationDate'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
                        <Select label='Source' value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} options={SOURCES} allLabel='Select' />
                        <Select label='Status' value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} allLabel='Select' />
                        <input type='file' onChange={(e) => { const file = e.target.files?.[0]; if (file) setForm({ ...form, resumeName: file.name, resumeSize: `${Math.ceil(file.size / 1024)} KB` }) }} />
                        <PrimaryButton type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                    </form>
                </Modal>
            )}
            <HrExport open={exportOpen} setOpen={setExportOpen} filename='candidates' rows={filtered} />
        </section>
    )
}

export default Candidates
