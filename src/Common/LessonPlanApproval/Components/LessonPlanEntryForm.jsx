import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { toast } from 'react-toastify'
import {
    ACADEMIC_YEAR_OPTIONS,
    MONTH_OPTIONS,
    addLessonPlan,
    CLASS_OPTIONS,
    SECTION_OPTIONS,
    SUBJECT_OPTIONS,
} from '../lessonPlanApprovalData'
import { PLANNING_COLUMNS, emptyPlanningRow } from '../lessonPlanTemplate'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { createLessonPlan, submitLessonPlan } from '../../../services/api/lessonPlanApiService'
import IntegrationNotice from '../../ui/IntegrationNotice'

const inputClass = 'text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-2 w-full bg-white'
const areaClass = `${inputClass} min-h-20`

const toDisplayDate = (value) => {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    if (!year || !month || !day) return value
    return `${day}-${month}-${year}`
}

/** Convert month display name + academic year into API YYYY-MM. */
export function monthNameToYyyyMm(monthName, academicYear) {
    const idx = MONTH_OPTIONS.indexOf(monthName)
    const monthIndex = idx >= 0 ? idx : new Date().getMonth()
    const mm = String(monthIndex + 1).padStart(2, '0')
    const ay = String(academicYear || '')
    const startMatch = ay.match(/^(\d{4})/)
    let year = startMatch ? Number(startMatch[1]) : new Date().getFullYear()
    // Indian AY Apr–Mar: Jan–Mar belong to the second calendar year of the AY.
    if (startMatch && monthIndex <= 2 && /-\d{2,4}$/.test(ay)) {
        year += 1
    }
    return `${year}-${mm}`
}

const LessonPlanEntryForm = ({ submitterName, submitterRole, successPath }) => {
    const live = isLiveApiEnabled()
    const navigate = useNavigate()
    const [saving, setSaving] = useState(false)
    const [header, setHeader] = useState({
        subject: '',
        className: '',
        section: '',
        academicYear: '2026-27',
        month: 'October',
        weekNo: '4',
        fromDate: '',
        toDate: '',
        numberOfSessions: '',
        chapterName: '',
        attachmentName: '',
    })
    const [rows, setRows] = useState([emptyPlanningRow()])
    const [summary, setSummary] = useState({
        specialAttention: '',
        classroomSetup: '',
        teacherNotes: '',
        reflection: '',
        subjectMentor: '',
        evaluator: '',
        coordinatorSignoff: '',
        sdgPlanned: '',
        sdcPlanned: '',
        worksheetsPlanned: '',
    })

    const setHeaderField = (key, value) => setHeader((current) => ({ ...current, [key]: value }))
    const updateRow = (id, key, value) => setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)))

    const submit = async () => {
        if (!header.subject || !header.className || !header.section || !header.academicYear || !header.month || !header.weekNo || !header.fromDate || !header.toDate) return
        if (!rows.length) return

        if (live) {
            setSaving(true)
            const month = monthNameToYyyyMm(header.month, header.academicYear)
            const content = {
                ...header,
                ...summary,
                fromDate: toDisplayDate(header.fromDate),
                toDate: toDisplayDate(header.toDate),
                planningRows: rows,
                attachment: header.attachmentName,
                submitterName,
                submitterRole,
            }
            const created = await createLessonPlan({
                className: header.className,
                section: header.section,
                subject: header.subject,
                month,
                title: header.chapterName || header.subject,
                content,
            })
            if (!created.success) {
                setSaving(false)
                toast.error(typeof created.error === 'string' ? created.error : 'Unable to create lesson plan on the server.')
                return
            }
            const planId = created.data?.id || created.data?.planId
            if (planId) {
                const submitted = await submitLessonPlan(planId)
                if (!submitted.success) {
                    setSaving(false)
                    toast.error(typeof submitted.error === 'string' ? submitted.error : 'Plan created but submit failed.')
                    return
                }
            }
            setSaving(false)
            toast.success('Lesson plan submitted for approval.')
            navigate(successPath)
            return
        }

        addLessonPlan({
            ...header,
            ...summary,
            fromDate: toDisplayDate(header.fromDate),
            toDate: toDisplayDate(header.toDate),
            planningRows: rows,
            attachment: header.attachmentName,
            submitterName,
            submitterRole,
        })
        navigate(successPath)
    }

    return (
        <section className='space-y-6'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live lesson-plan create'
                    description='Submit posts to /api/v1/lesson-plans then /submit. Browser localStorage is not used.'
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Browser lesson-plan draft'
                    description='This form saves into browser storage only.'
                />
            )}
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                <div>
                    <h2 className='text-xl font-semibold text-black'>Submit Lesson Plan</h2>
                    <p className='text-sm text-[#667085] mt-1'>Enter the week once. Add as many planning rows as the week needs. The saved view follows the QMIS lesson-plan table.</p>
                </div>
                <h3 className='font-medium'>General Information</h3>
                <div className='grid md:grid-cols-3 gap-4'>
                    <label className='text-sm'>Month<select className={inputClass} value={header.month} onChange={(e) => setHeaderField('month', e.target.value)}>{MONTH_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label className='text-sm'>Week No<input className={inputClass} value={header.weekNo} onChange={(e) => setHeaderField('weekNo', e.target.value)} /></label>
                    <label className='text-sm'>Academic Year<select className={inputClass} value={header.academicYear} onChange={(e) => setHeaderField('academicYear', e.target.value)}>{ACADEMIC_YEAR_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label className='text-sm'>Grade{CLASS_OPTIONS.length ? <select className={inputClass} value={header.className} onChange={(e) => setHeaderField('className', e.target.value)}><option value=''>Select Class</option>{CLASS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select> : <input className={inputClass} value={header.className} placeholder='Grade' onChange={(e) => setHeaderField('className', e.target.value)} />}</label>
                    <label className='text-sm'>Section{SECTION_OPTIONS.length ? <select className={inputClass} value={header.section} onChange={(e) => setHeaderField('section', e.target.value)}><option value=''>Select Section</option>{SECTION_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select> : <input className={inputClass} value={header.section} placeholder='Section' onChange={(e) => setHeaderField('section', e.target.value)} />}</label>
                    <label className='text-sm'>Teacher<input className={inputClass} value={submitterName} readOnly /></label>
                    <label className='text-sm'>Subject{SUBJECT_OPTIONS.length ? <select className={inputClass} value={header.subject} onChange={(e) => setHeaderField('subject', e.target.value)}><option value=''>Select Subject</option>{SUBJECT_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select> : <input className={inputClass} value={header.subject} placeholder='Subject' onChange={(e) => setHeaderField('subject', e.target.value)} />}</label>
                    <label className='text-sm'>Planning From<input type='date' className={inputClass} value={header.fromDate} onChange={(e) => setHeaderField('fromDate', e.target.value)} /></label>
                    <label className='text-sm'>Planning To<input type='date' className={inputClass} value={header.toDate} onChange={(e) => setHeaderField('toDate', e.target.value)} /></label>
                    <label className='text-sm'>Number of Sessions<input className={inputClass} value={header.numberOfSessions} onChange={(e) => setHeaderField('numberOfSessions', e.target.value)} /></label>
                    <label className='text-sm md:col-span-2'>Chapter No. and Name<input className={inputClass} value={header.chapterName} onChange={(e) => setHeaderField('chapterName', e.target.value)} /></label>
                    <label className='text-sm'>Attachment
                        <span className='mt-1 flex items-center gap-2 border border-dashed border-[#515DEF] rounded-md px-3 py-2 text-[#515DEF] cursor-pointer'>
                            <Upload size={16} />{header.attachmentName || 'Choose file'}
                            <input type='file' className='hidden' onChange={(e) => setHeaderField('attachmentName', e.target.files?.[0]?.name || '')} />
                        </span>
                    </label>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                <div className='flex items-center justify-between gap-3'>
                    <h3 className='font-medium'>Planning Rows</h3>
                    <button type='button' className='text-sm text-[#515DEF] cursor-pointer' onClick={() => setRows((current) => [...current, emptyPlanningRow()])}>Add row</button>
                </div>
                {rows.map((row, index) => (
                    <div key={row.id} className='border border-[#E8ECFF] rounded-xl p-3 space-y-3'>
                        <div className='flex justify-between'>
                            <p className='text-sm font-medium'>Row {index + 1}</p>
                            <button type='button' className='text-sm text-[#FF0000] cursor-pointer' onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button>
                        </div>
                        <div className='grid md:grid-cols-2 gap-3'>
                            {PLANNING_COLUMNS.map((column) => (
                                <label key={column.key} className='text-sm'>{column.label}
                                    {column.key === 'day' || column.key === 'mainConcepts' || column.key === 'cognitiveLevel'
                                        ? <input className={inputClass} value={row[column.key]} onChange={(e) => updateRow(row.id, column.key, e.target.value)} />
                                        : <textarea className={areaClass} value={row[column.key]} onChange={(e) => updateRow(row.id, column.key, e.target.value)} />}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
                <h3 className='font-medium'>Student Attention / Classroom Setup</h3>
                <label className='text-sm block'>Details of students who need special attention<textarea className={areaClass} value={summary.specialAttention} onChange={(e) => setSummary({ ...summary, specialAttention: e.target.value })} /></label>
                <label className='text-sm block'>Modified classroom setup for students requiring special care<textarea className={areaClass} value={summary.classroomSetup} onChange={(e) => setSummary({ ...summary, classroomSetup: e.target.value })} /></label>
            </div>
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
                <h3 className='font-medium'>Teacher Notes / Reflection</h3>
                <label className='text-sm block'>Teacher notes influencing learners or sessions<textarea className={areaClass} value={summary.teacherNotes} onChange={(e) => setSummary({ ...summary, teacherNotes: e.target.value })} /></label>
                <label className='text-sm block'>Reflection<textarea className={areaClass} value={summary.reflection} onChange={(e) => setSummary({ ...summary, reflection: e.target.value })} /></label>
            </div>
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
                <h3 className='font-medium'>Review / Sign-off</h3>
                <div className='grid md:grid-cols-3 gap-3'>
                    {[
                        ['subjectMentor', 'Subject Mentor'],
                        ['evaluator', 'Evaluator'],
                        ['coordinatorSignoff', 'Coordinator'],
                        ['sdgPlanned', 'Total No. of SDG Planned'],
                        ['sdcPlanned', 'Total No. of SDC Planned'],
                        ['worksheetsPlanned', 'Total No. of Worksheets Planned'],
                    ].map(([key, label]) => (
                        <label key={key} className='text-sm'>{label}<input className={inputClass} value={summary[key]} onChange={(e) => setSummary({ ...summary, [key]: e.target.value })} /></label>
                    ))}
                </div>
                <button type='button' disabled={saving} onClick={submit} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md cursor-pointer disabled:opacity-60'>
                    {saving ? 'Submitting…' : 'Submit for Approval'}
                </button>
            </div>
        </section>
    )
}

export default LessonPlanEntryForm
