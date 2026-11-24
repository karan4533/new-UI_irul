import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Download, X } from 'lucide-react'
import { toast } from 'react-toastify'
import mo_user from '../../../assets/images/no-profile.png'
import pdf_icon from '../../../assets/images/pdf-icon.png'
import mp4_icon from '../../../assets/images/mp4-icon.png'

const MOCK_STUDENT = {
    studentId: 'STU-100842',
    studentName: 'Rahul Kumar Sharma',
    class: 'Class 10',
    section: 'Section A',
    profileImage: null,
}

const SUBJECT_HOMEWORK = [
    {
        subject: 'Mathematics',
        teacherName: 'Anita Verma',
        homework: [
            {
                title: 'Algebra Worksheet – Chapter 5',
                givenDate: '03-03-2026',
                uploadedDate: '05-03-2026',
                documents: [
                    { name: 'Algebra_Worksheet_Answers.pdf', type: 'pdf' },
                ],
            },
            {
                title: 'Quadratic Equations Practice',
                givenDate: '10-03-2026',
                uploadedDate: '12-03-2026',
                documents: [
                    { name: 'Quadratic_Practice.pdf', type: 'pdf' },
                    { name: 'Solution_Scan.jpg', type: 'image' },
                ],
            },
        ],
    },
    {
        subject: 'Science',
        teacherName: 'John Milton',
        homework: [
            {
                title: 'Photosynthesis Lab Report',
                givenDate: '04-03-2026',
                uploadedDate: '07-03-2026',
                documents: [
                    { name: 'Lab_Report_Photosynthesis.pdf', type: 'pdf' },
                ],
            },
        ],
    },
    {
        subject: 'English',
        teacherName: 'Sarah Thomas',
        homework: [
            {
                title: 'Essay on Environmental Protection',
                givenDate: '01-03-2026',
                uploadedDate: '04-03-2026',
                documents: [
                    { name: 'Environment_Essay.pdf', type: 'pdf' },
                ],
            },
            {
                title: 'Grammar Exercise – Tenses',
                givenDate: '08-03-2026',
                uploadedDate: '—',
                documents: [],
            },
        ],
    },
    {
        subject: 'Social Science',
        teacherName: 'David Wilson',
        homework: [
            {
                title: 'Indian Independence Movement Notes',
                givenDate: '06-03-2026',
                uploadedDate: '09-03-2026',
                documents: [
                    { name: 'Independence_Notes.pdf', type: 'pdf' },
                    { name: 'Presentation_Recording.mp4', type: 'video' },
                ],
            },
        ],
    },
]

const DocumentIcon = ({ type }) => (
    <img src={type === 'video' ? mp4_icon : pdf_icon} alt="" className="w-6 h-6 shrink-0" />
)

const buildDemoAttachmentBlob = (doc) => {
    const type = String(doc.type || '').toLowerCase()
    if (type === 'image' || String(doc.name || '').match(/\.(png|jpe?g|gif|webp)$/i)) {
        // 1x1 PNG
        const binary = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
        return new Blob([bytes], { type: 'image/png' })
    }
    if (type === 'video' || String(doc.name || '').match(/\.(mp4|webm|mov)$/i)) {
        return new Blob(
            [`Demo video placeholder for ${doc.name}. Binary media is not embedded in this demo dossier.`],
            { type: 'text/plain;charset=utf-8' }
        )
    }
    const text = [
        `QMIS Student Home Fun Attachment`,
        `File: ${doc.name}`,
        `Generated: ${new Date().toISOString()}`,
        '',
        'This is a demonstration attachment used when a live file URL is not available.',
        'Replace with authenticated GET /files/{id} when LMS storage is LIVE.',
    ].join('\n')
    return new Blob([text], { type: 'application/pdf' })
}

const ViewStudentLMS = () => {
    const navigate = useNavigate()
    const student = MOCK_STUDENT
    const [previewDoc, setPreviewDoc] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')

    const previewKind = useMemo(() => {
        if (!previewDoc) return 'none'
        const name = String(previewDoc.name || '')
        const type = String(previewDoc.type || '').toLowerCase()
        if (type === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image'
        if (type === 'video' || /\.(mp4|webm|mov)$/i.test(name)) return 'unsupported'
        return 'text'
    }, [previewDoc])

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl('')
        setPreviewDoc(null)
    }

    const handlePreview = (doc) => {
        try {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
            const blob = buildDemoAttachmentBlob(doc)
            const url = URL.createObjectURL(blob)
            setPreviewDoc(doc)
            setPreviewUrl(url)
        } catch (err) {
            toast.error(err.message || 'Unable to open attachment preview.')
        }
    }

    const handleDownload = (doc) => {
        try {
            const blob = buildDemoAttachmentBlob(doc)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = doc.name || 'attachment.bin'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            toast.success(`Download started: ${doc.name}`)
        } catch (err) {
            toast.error(err.message || 'Unable to download attachment.')
        }
    }

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-center gap-3'>
                <button
                    type='button'
                    onClick={() => navigate('/director/lms/student-lms')}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
                >
                    <ArrowLeft size={18} />
                    Back to list
                </button>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center gap-4'>
                    <img
                        src={student.profileImage || mo_user}
                        alt=""
                        className='w-20 h-20 rounded-full object-cover ring-2 ring-indigo-100'
                    />
                    <div>
                        <h1 className='text-2xl font-semibold text-black'>{student.studentName}</h1>
                        <p className='text-sm text-[#667085] mt-1'>
                            <span className='font-medium text-[#1E1E1E]'>Student ID: {student.studentId}</span>
                            {' · '}
                            <span className='text-[#808080]'>{student.class} · {student.section}</span>
                        </p>
                    </div>
                </div>
            </div>

            {SUBJECT_HOMEWORK.map((subjectBlock) => (
                <div key={subjectBlock.subject} className='bg-white rounded-2xl shadow-md p-4'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-[#EEF0F6]'>
                        <h2 className='text-xl font-semibold text-[#0C1E5B]'>{subjectBlock.subject}</h2>
                        <p className='text-sm text-[#808080]'>
                            Subject Teacher: <span className='font-medium text-[#1E1E1E]'>{subjectBlock.teacherName}</span>
                        </p>
                    </div>

                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                            <thead className="text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg">
                                <tr>
                                    <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg">Homework Title</th>
                                    <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Given By</th>
                                    <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Given Date</th>
                                    <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase">Uploaded Date</th>
                                    <th className="px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg">Uploaded Documents</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectBlock.homework.map((item) => (
                                    <tr
                                        key={item.title}
                                        className="border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]"
                                    >
                                        <td className="px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg">{item.title}</td>
                                        <td className="px-2 py-4">{subjectBlock.teacherName}</td>
                                        <td className="px-2 py-4">{item.givenDate}</td>
                                        <td className="px-2 py-4">{item.uploadedDate}</td>
                                        <td className="px-2 py-4 rounded-e-lg">
                                            {item.documents.length > 0 ? (
                                                <div className='flex flex-col gap-2'>
                                                    {item.documents.map((doc) => (
                                                        <div
                                                            key={doc.name}
                                                            className='flex items-center justify-between gap-3 rounded-lg border border-[#E8ECF4] bg-[#FAFBFD] px-3 py-2'
                                                        >
                                                            <span className='flex items-center gap-2 min-w-0'>
                                                                <DocumentIcon type={doc.type} />
                                                                <span className='text-sm font-normal text-[#515DEF] truncate'>{doc.name}</span>
                                                            </span>
                                                            <span className='flex items-center gap-1 shrink-0'>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => handlePreview(doc)}
                                                                    className='p-1.5 rounded-md text-[#515DEF] hover:bg-[#515DEF]/10 cursor-pointer'
                                                                    title='View'
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => handleDownload(doc)}
                                                                    className='p-1.5 rounded-md text-[#515DEF] hover:bg-[#515DEF]/10 cursor-pointer'
                                                                    title='Download'
                                                                >
                                                                    <Download size={16} />
                                                                </button>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className='text-sm text-[#808080]'>Not uploaded yet</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {previewDoc && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                    <div className='absolute inset-0 bg-black/40' onClick={closePreview} />
                    <div className='relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 p-5 space-y-4'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h3 className='text-lg font-semibold text-slate-900'>Attachment Preview</h3>
                                <p className='text-xs text-slate-500 mt-0.5'>{previewDoc.name}</p>
                            </div>
                            <button type='button' onClick={closePreview} className='p-1 text-slate-400 hover:text-slate-700'>
                                <X size={18} />
                            </button>
                        </div>
                        {previewKind === 'image' && previewUrl ? (
                            <img src={previewUrl} alt={previewDoc.name} className='w-full max-h-[60vh] object-contain rounded-xl border border-slate-100' />
                        ) : previewKind === 'unsupported' ? (
                            <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
                                In-browser preview is not available for this media type. Use Download to save the file.
                            </div>
                        ) : (
                            <iframe title={previewDoc.name} src={previewUrl} className='w-full h-[50vh] rounded-xl border border-slate-200' />
                        )}
                        <div className='flex justify-end gap-2'>
                            <button
                                type='button'
                                onClick={() => handleDownload(previewDoc)}
                                className='inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
                            >
                                <Download size={14} /> Download
                            </button>
                            <button
                                type='button'
                                onClick={closePreview}
                                className='rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

export default ViewStudentLMS
