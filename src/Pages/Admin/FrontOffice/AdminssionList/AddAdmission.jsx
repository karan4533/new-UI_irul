import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Circle, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import AdmissionInfo from './Components/AdmissionInfo'
import StudentInfo from './Components/StudentInfo'
import TransportInfo from './Components/TransportInfo'
import ParentsInfo from './Components/ParentsInfo'
import AccountInformation from './Components/AccountInformation'
import FeesTimeLine from './Components/FeesTimeLine'
import {
    buildInitialAdmissionForm,
    createAdmission,
    getAdmissionById,
    toAdmissionFormState,
    updateAdmission,
} from './admissionListData'
import {
    getAdmissionListPath,
    mapEnquiryToAdmissionPrefill,
} from '../AdmissionEnquiry/admissionEnquiryData'
import {
    clearAdmissionDraft,
    getAdmissionDraftKey,
    loadAdmissionDraft,
    saveAdmissionDraft,
} from '../../../../Common/Admissions/admissionDraft'
import { ADMISSION_STAGES, getAdmissionStageProgress } from '../../../../Common/ui/governance'
import { ConfirmAction, FeedbackState, IntegrationNotice, PageHeader, Surface } from '../../../../Common/ui'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import {
    createAdmissionRecord,
    getAdmission,
    updateAdmissionRecord,
} from '../../../../services/api/admissionsApiService'

const stagePanels = {
    admission: { title: 'Admission information', Component: AdmissionInfo },
    student: { title: 'Student information', Component: StudentInfo },
    transport: { title: 'Transport information', Component: TransportInfo },
    parents: { title: 'Parents and guardians', Component: ParentsInfo },
    account: { title: 'Contact emails (no parent login)', Component: AccountInformation },
    fees: { title: 'Fees timeline', Component: FeesTimeLine },
}

const formatSavedTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const AddAdmission = () => {
    const navigate = useNavigate()
    const { id } = useParams()
    const isEdit = Boolean(id)
    const live = isLiveApiEnabled()
    const { pathname, state: locationState } = useLocation()
    const listPath = getAdmissionListPath(pathname)
    const draftKey = getAdmissionDraftKey(pathname, id || 'new')

    const [record, setRecord] = useState(() => (!live && isEdit ? getAdmissionById(id) : null))
    const [loading, setLoading] = useState(Boolean(live && isEdit))
    const [loadError, setLoadError] = useState('')
    const [saving, setSaving] = useState(false)
    const [initialDraft] = useState(() => (
        locationState?.enquiry ? null : loadAdmissionDraft(draftKey)
    ))
    const [form, setForm] = useState(() => {
        if (initialDraft?.form) return initialDraft.form
        if (!live && isEdit) {
            const local = getAdmissionById(id)
            return local ? toAdmissionFormState(local) : buildInitialAdmissionForm()
        }
        const prefill = locationState?.enquiry
            ? mapEnquiryToAdmissionPrefill(locationState.enquiry)
            : null
        return buildInitialAdmissionForm(prefill, locationState?.fromEnquiryId || '')
    })
    const [activeStage, setActiveStage] = useState(() => initialDraft?.activeStage || 'admission')
    const [draftSavedAt, setDraftSavedAt] = useState(() => initialDraft?.savedAt || '')
    const [error, setError] = useState('')
    const [discardOpen, setDiscardOpen] = useState(false)
    const [formReady, setFormReady] = useState(!(live && isEdit) || Boolean(initialDraft?.form))

    useEffect(() => {
        let cancelled = false

        async function loadLiveEdit() {
            if (!isLiveApiEnabled() || !isEdit) {
                setLoading(false)
                return
            }
            // Prefer local draft if user already started editing this admission.
            if (initialDraft?.form) {
                setLoading(false)
                setFormReady(true)
                return
            }

            setLoading(true)
            setLoadError('')
            const res = await getAdmission(id)
            if (cancelled) return
            setLoading(false)

            if (!res.success || !res.data) {
                setRecord(null)
                setLoadError(typeof res.error === 'string' ? res.error : 'Failed to load admission for edit.')
                setFormReady(true)
                return
            }

            if (res.data.status === 'Enrolled') {
                setRecord(res.data)
                setLoadError('Enrolled admissions cannot be edited.')
                setFormReady(true)
                return
            }

            setRecord(res.data)
            setForm(toAdmissionFormState(res.data))
            setFormReady(true)
        }

        loadLiveEdit()
        return () => {
            cancelled = true
        }
    }, [id, isEdit, initialDraft])

    if (loading || (live && isEdit && !formReady)) {
        return (
            <FeedbackState
                kind='loading'
                title='Loading admission'
                description='Fetching admission details for edit…'
            />
        )
    }

    if (isEdit && !record && !initialDraft?.form) {
        return (
            <FeedbackState
                kind='error'
                title='Admission not found'
                description={loadError || 'The admission may have been removed or the link is no longer valid.'}
                action={(
                    <button type='button' onClick={() => navigate(listPath)} className='text-sm font-semibold text-[var(--erp-indigo)]'>
                        Back to admission list
                    </button>
                )}
            />
        )
    }

    if (isEdit && (record?.status === 'Enrolled' || loadError === 'Enrolled admissions cannot be edited.')) {
        return (
            <FeedbackState
                kind='error'
                title='Cannot edit enrolled admission'
                description='Enrolled admissions are locked. Use View to review student and parent details.'
                action={(
                    <button type='button' onClick={() => navigate(listPath)} className='text-sm font-semibold text-[var(--erp-indigo)]'>
                        Back to admission list
                    </button>
                )}
            />
        )
    }

    const progress = getAdmissionStageProgress(form)
    const activeStageIndex = Math.max(0, ADMISSION_STAGES.findIndex((stage) => stage.key === activeStage))
    const activePanel = stagePanels[activeStage]
    const ActiveComponent = activePanel.Component

    const persistDraft = (nextForm, nextStage = activeStage) => {
        const result = saveAdmissionDraft(draftKey, nextForm, nextStage)
        if (result.success) setDraftSavedAt(new Date().toISOString())
    }

    const updateField = (key, value) => {
        const next = { ...form, [key]: value }
        setForm(next)
        persistDraft(next)
        setError('')
    }

    const moveToStage = (nextStage) => {
        setActiveStage(nextStage)
        persistDraft(form, nextStage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSave = async () => {
        setError('')
        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = isEdit
                ? await updateAdmissionRecord(id, form)
                : await createAdmissionRecord(form)
            setSaving(false)
            if (!res.success) {
                setError(typeof res.error === 'string' ? res.error : 'Failed to save admission on the API.')
                return
            }
            clearAdmissionDraft(draftKey)
            toast.success(isEdit ? 'Admission updated on the server.' : 'Admission created on the server.')
            navigate(listPath)
            return
        }

        const result = isEdit ? updateAdmission(id, form) : createAdmission(form)
        if (!result.success) {
            setError(result.message)
            return
        }

        clearAdmissionDraft(draftKey)
        toast.success(isEdit ? 'Admission updated successfully.' : 'Admission saved successfully.')
        navigate(listPath)
    }

    const handleSaveAndExit = () => {
        persistDraft(form)
        toast.info('Draft saved on this device. Account passwords are never included.')
        navigate(listPath)
    }

    const handleDiscard = () => {
        clearAdmissionDraft(draftKey)
        setDiscardOpen(false)
        navigate(listPath)
    }

    return (
        <section className='space-y-5'>
            <PageHeader
                title={isEdit ? 'Edit admission' : 'New admission'}
                description={live
                    ? 'Complete the application in stages. Final save writes to the admissions API.'
                    : 'Complete the application in stages. Progress is saved locally so the record can be resumed before final submission.'}
                context={locationState?.fromEnquiryId ? `Converted from enquiry ${locationState.fromEnquiryId}` : 'Admissions workflow'}
                meta={draftSavedAt ? <span>Draft saved at {formatSavedTime(draftSavedAt)}</span> : <span>Draft not yet saved</span>}
            />

            <Surface contentClassName='p-4 sm:p-5'>
                <div className='flex items-center justify-between gap-3 text-sm'>
                    <span className='font-semibold text-[var(--erp-ink)]'>{progress.completed} of {progress.total} stages complete</span>
                    <span className='text-[var(--erp-muted)]'>{progress.percent}%</span>
                </div>
                <div className='mt-2 h-2 overflow-hidden rounded-full bg-[var(--erp-line)]' role='progressbar' aria-valuemin='0' aria-valuemax='100' aria-valuenow={progress.percent} aria-label='Admission completion'>
                    <div className='h-full rounded-full bg-[var(--erp-indigo)] transition-[width]' style={{ width: `${progress.percent}%` }} />
                </div>
                <ol className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6' aria-label='Admission stages'>
                    {progress.stages.map((stage, index) => {
                        const isActive = stage.key === activeStage
                        return (
                            <li key={stage.key}>
                                <button
                                    type='button'
                                    onClick={() => moveToStage(stage.key)}
                                    aria-current={isActive ? 'step' : undefined}
                                    className={`flex min-h-16 w-full items-start gap-2 rounded-xl border p-3 text-left transition-colors ${isActive ? 'border-[var(--erp-indigo)] bg-[var(--erp-indigo-soft)]' : 'border-[var(--erp-line)] bg-white hover:border-[var(--erp-line-strong)]'}`}
                                >
                                    <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${stage.complete ? 'bg-[var(--erp-green)] text-white' : isActive ? 'bg-[var(--erp-indigo)] text-white' : 'text-[var(--erp-muted)]'}`}>
                                        {stage.complete ? <Check aria-hidden='true' size={13} /> : isActive ? <span className='text-[10px] font-bold'>{index + 1}</span> : <Circle aria-hidden='true' size={16} />}
                                    </span>
                                    <span>
                                        <span className='block text-sm font-semibold text-[var(--erp-ink)]'>{stage.label}</span>
                                        <span className='mt-0.5 hidden text-xs text-[var(--erp-muted)] xl:block'>{stage.description}</span>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ol>
            </Surface>

            <Surface
                title={activePanel.title}
                description={ADMISSION_STAGES[activeStageIndex].description}
                contentClassName='p-4 sm:p-5'
            >
                {activeStage === 'account' ? (
                    <ActiveComponent form={form} onChange={updateField} isEnrolled={form.status === 'Enrolled'} />
                ) : (
                    <ActiveComponent form={form} onChange={updateField} />
                )}
            </Surface>

            {error && <p className='rounded-xl border border-[#F4433633] bg-[#F443360D] px-4 py-3 text-sm text-[#B42318]' role='alert'>{error}</p>}

            <div className='flex flex-col gap-3 rounded-2xl border border-[var(--erp-line)] bg-white/95 p-3 shadow-lg backdrop-blur sm:sticky sm:bottom-3 sm:z-10 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-wrap gap-2'>
                    <button type='button' onClick={() => setDiscardOpen(true)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-slate)] hover:bg-[var(--erp-canvas)]'>
                        Discard draft
                    </button>
                    <button type='button' onClick={handleSaveAndExit} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-indigo)] px-4 text-sm font-semibold text-[var(--erp-indigo)] hover:bg-[var(--erp-indigo-soft)]'>
                        <Save aria-hidden='true' size={16} /> Save and finish later
                    </button>
                </div>
                <div className='flex gap-2'>
                    <button
                        type='button'
                        onClick={() => moveToStage(ADMISSION_STAGES[activeStageIndex - 1].key)}
                        disabled={activeStageIndex === 0 || saving}
                        className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)] disabled:cursor-not-allowed disabled:opacity-40'
                    >
                        <ArrowLeft aria-hidden='true' size={16} /> Previous
                    </button>
                    {activeStageIndex < ADMISSION_STAGES.length - 1 ? (
                        <button type='button' onClick={() => moveToStage(ADMISSION_STAGES[activeStageIndex + 1].key)} disabled={saving} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-60'>
                            Next <ArrowRight aria-hidden='true' size={16} />
                        </button>
                    ) : (
                        <button type='button' onClick={handleSave} disabled={saving} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-60'>
                            <Check aria-hidden='true' size={16} /> {saving ? 'Saving…' : (isEdit ? 'Update admission' : 'Create admission')}
                        </button>
                    )}
                </div>
            </div>

            <ConfirmAction
                open={discardOpen}
                onClose={() => setDiscardOpen(false)}
                onConfirm={handleDiscard}
                title='Discard this admission draft?'
                description='Locally saved progress will be removed from this device.'
                confirmLabel='Discard draft'
                tone='danger'
            >
                <p>The submitted admissions list is not affected. This action only removes the unfinished local draft.</p>
            </ConfirmAction>
        </section>
    )
}

export default AddAdmission
