import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getCandidates, getInterviews, nextId, pushNotification, queueCommunication, saveCandidates, saveInterviews } from '../domain/hrStore'
import { Badge, Modal, PageIntro, PrimaryButton, SearchBox, Select, TableWrap, inputClass } from '../components/HrUi'
import { matches, useFilters, useHrTick } from '../components/hrUiState'
import { DataTable, FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHrCollection, patchHrItem } from '../../../services/api/hrApiService'
import { useHrLiveCollection } from '../hooks/useHrLiveCollection'

const LEVELS = ['Screening', 'Level 1', 'Level 2', 'Technical', 'HR', 'Management', 'Final']
const STATUSES = ['Scheduled', 'Completed', 'Selected', 'Rejected', 'On Hold', 'Next Round', 'No Show']
const empty = { candidateId: '', level: 'Screening', interviewer: '', date: '2026-09-25', time: '10:00', mode: 'In Person', status: 'Scheduled', score: 0, remarks: '', strengths: '', concerns: '', recommendation: '', nextStep: '', technical: 0, communication: 0, experienceMatch: 0, roleFit: 0, finalDecision: '' }

const Rating = ({ label, value, onChange }) => (
    <label className='text-sm text-[#808080]'>{label}
        <select className={`${inputClass} mt-1`} value={value} onChange={(e) => onChange(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
    </label>
)

const Interviews = () => {
    const feedbackMode = useLocation().pathname.includes('interview-feedback')
    const tick = useHrTick()
    const live = isLiveApiEnabled()
    const loadLocal = useCallback(() => {
        void tick
        return getInterviews()
    }, [tick])
    const { rows, listLoading, listError, listSource, saving, refresh, createOne, patchOne } = useHrLiveCollection('interviews', {
        loadLocal,
        saveLocal: saveInterviews,
    })
    const [candidates, setCandidates] = useState(() => (live ? [] : getCandidates()))
    const { filters, set } = useFilters({ search: '', level: '', status: '' })
    const [form, setForm] = useState(null)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setCandidates(getCandidates())
            return
        }
        listHrCollection('candidates').then((res) => {
            if (res.success) setCandidates(Array.isArray(res.data) ? res.data : [])
        })
    }, [listSource, tick])

    const filtered = rows.filter((row) => (!filters.level || row.level === filters.level) && (!filters.status || row.status === filters.status) && matches(`${row.id} ${row.position} ${row.interviewer}`, filters.search))
    const columns = [
        { key: 'id', label: 'Interview ID', required: true },
        { key: 'candidateId', label: 'Candidate', required: true, render: (row) => candidates.find((item) => item.id === row.candidateId)?.name || row.candidateId },
        { key: 'level', label: 'Level' },
        { key: 'date', label: 'Schedule', render: (row) => `${row.date} ${row.time || ''}`.trim() },
        { key: 'interviewer', label: 'Interviewer' },
        { key: 'score', label: 'Score', render: (row) => row.score || '—' },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]

    const save = async (event) => {
        event.preventDefault()
        if (!form.candidateId || !form.level || !form.date) return toast.error('Candidate, level, and date are required.')
        const candidate = candidates.find((item) => item.id === form.candidateId)
        const record = {
            ...form,
            position: candidate?.position || '',
            score: Number(form.technical) || Number(form.score) || 0,
            id: form.id || nextId('INT-2026', rows),
        }

        if (isLiveApiEnabled()) {
            const res = form.id ? await patchOne(form.id, record) : await createOne(record)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the interview save.')
                return
            }
            if (record.finalDecision === 'Selected' && candidate) {
                const candRes = await patchHrItem('candidates', candidate.id, { ...candidate, status: 'Selected' })
                if (!candRes.success) {
                    toast.warn('Interview saved, but candidate status update failed on the server.')
                }
            }
            toast.success(form.id ? 'Interview feedback saved on server.' : 'Interview scheduled on server.')
            setForm(null)
            return
        }

        saveInterviews(form.id ? getInterviews().map((row) => (row.id === form.id ? record : row)) : [record, ...getInterviews()])
        if (!form.id && record.status === 'Scheduled') {
            pushNotification({ type: 'Recruitment', title: 'Interview Scheduled', message: `${record.level} interview for ${candidate?.name} on ${record.date} at ${record.time}.`, relatedDate: record.date })
            queueCommunication({ channel: 'Email', subject: `Interview schedule — ${candidate?.name}`, audience: candidate?.email })
            toast.success('Interview saved. Demo email queued.')
        } else toast.success('Interview feedback saved.')
        if (record.finalDecision === 'Selected' && candidate) {
            saveCandidates(getCandidates().map((item) => (item.id === candidate.id ? { ...item, status: 'Selected' } : item)))
            pushNotification({ type: 'Recruitment', title: 'Candidate Selected', message: `${candidate.name} selected for ${candidate.position}.`, relatedDate: record.date })
        }
        setForm(null)
    }

    return (
        <section>
            <PageIntro text={feedbackMode ? 'Rate each completed round on a 1–3 scale and record the recommendation.' : 'Schedule interview rounds. Feedback is stored on the same interview history.'}>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <SearchBox value={filters.search} onChange={set('search')} placeholder='Candidate or interviewer' />
                    <Select label='Level' value={filters.level} onChange={set('level')} options={LEVELS} />
                    <Select label='Status' value={filters.status} onChange={set('status')} options={STATUSES} />
                </div>
            </PageIntro>
            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Interviews API unavailable' : 'Live interviews'}
                    description={listSource === 'error' ? listError : 'Interview schedule and feedback from /api/v1/hr/interviews.'}
                />
            ) : null}
            {listLoading ? <p className='text-sm text-slate-500 py-4'>Loading interviews…</p> : null}
            {listError && !listLoading ? <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={refresh}>Retry</button> : null}
            {!listLoading ? (
                <TableWrap title={feedbackMode ? 'Interview Feedback' : 'Interviews'} action={<PrimaryButton disabled={saving} onClick={() => setForm({ ...empty, candidateId: candidates[0]?.id || '' })}>{feedbackMode ? 'Add Feedback' : 'Schedule Interview'}</PrimaryButton>}>
                    <DataTable caption='HR interview register' rows={filtered} columns={columns} rowKey='id' emptyTitle='No interviews found' emptyDescription='Change level, status or search to review other interviews.' renderActions={(row) => <button type='button' className='min-h-9 rounded-md border border-[var(--erp-indigo)] px-3 text-sm font-semibold text-[var(--erp-indigo)]' onClick={() => setForm(row)}>Feedback</button>} />
                </TableWrap>
            ) : null}
            {form && (
                <Modal title='Interview' onClose={() => setForm(null)} wide>
                    <form onSubmit={save} className='grid md:grid-cols-2 gap-3'>
                        <Select label='Candidate' value={form.candidateId} onChange={(e) => setForm({ ...form, candidateId: e.target.value })} options={candidates.map((item) => item.id)} allLabel='Select' />
                        <Select label='Level' value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} options={LEVELS} allLabel='Select' />
                        <Select label='Status' value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} allLabel='Select' />
                        {['interviewer', 'date', 'time', 'mode', 'strengths', 'concerns', 'remarks', 'recommendation', 'nextStep', 'finalDecision'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
                        <Rating label='Technical / Functional' value={form.technical || 1} onChange={(value) => setForm({ ...form, technical: value })} />
                        <Rating label='Communication' value={form.communication || 1} onChange={(value) => setForm({ ...form, communication: value })} />
                        <Rating label='Experience Match' value={form.experienceMatch || 1} onChange={(value) => setForm({ ...form, experienceMatch: value })} />
                        <Rating label='Role Fit' value={form.roleFit || 1} onChange={(value) => setForm({ ...form, roleFit: value })} />
                        <PrimaryButton type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                    </form>
                </Modal>
            )}
        </section>
    )
}

export default Interviews
