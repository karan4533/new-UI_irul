import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { DataTable, DataToolbar, FeedbackState, PageHeader, Pagination, StatusBadge, Surface } from '../../../Common/ui'
import { paginateRows } from '../../../Common/ui/dataTableState'
import {
    deleteDocumentItem,
    listDocumentFolders,
    openDocumentFile,
    putDocumentItem,
} from '../../../services/api/documentsApiService'
import { listStudents } from '../../../services/api/studentApiService'
import { listPortalEmployees } from '../../../services/api/hrApiService'

const STUDENT_DOC_TYPES = [
    { id: 'aadhaar', label: 'Aadhaar/ID Proof' },
    { id: 'birth', label: 'Birth Certificate' },
    { id: 'tc', label: 'TC' },
    { id: 'marksheet', label: 'Mark Sheet' },
]

const inputClass = 'min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'

/**
 * Admin student / employee documents backed by FastAPI /api/v1/documents (live mode only).
 * kind: 'students' | 'employees'
 */
const LiveDocuments = ({ kind }) => {
    const isStudents = kind === 'students'
    const noun = isStudents ? 'student' : 'employee'
    const [folders, setFolders] = useState([])
    const [people, setPeople] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [openId, setOpenId] = useState(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ ref: '', label: isStudents ? STUDENT_DOC_TYPES[0].id : '', status: 'Pending', file: null })

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        const [foldersRes, peopleRes] = await Promise.all([
            listDocumentFolders(kind),
            isStudents ? listStudents() : listPortalEmployees(),
        ])
        setLoading(false)
        if (!foldersRes.success) {
            setFolders([])
            setError(typeof foldersRes.error === 'string' ? foldersRes.error : 'Documents could not be loaded.')
            return
        }
        setFolders(foldersRes.data)
        const rows = peopleRes.success && Array.isArray(peopleRes.data) ? peopleRes.data : []
        setPeople(rows.map((row) => (isStudents
            ? { ref: row.id, label: `${row.admissionNumber || row.id} · ${row.name}` }
            : { ref: row.id, label: `${row.id} · ${row.name}` })))
    }, [kind, isStudents])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return folders
        return folders.filter((row) => `${row.subject_ref} ${row.name} ${row.class_name || ''}`.toLowerCase().includes(q))
    }, [folders, search])
    const pagination = paginateRows(filtered, { page, pageSize })
    const open = folders.find((row) => row.id === openId) || null

    const submit = async (event) => {
        event.preventDefault()
        if (!form.ref) return toast.error(`Choose a ${noun}.`)
        if (!form.label.trim()) return toast.error('Choose or enter a document label.')
        if (!form.file) return toast.error('Choose a file to upload.')
        setSaving(true)
        const res = await putDocumentItem(kind, form.ref, {
            label: form.label,
            file: form.file,
            status: isStudents ? undefined : form.status,
        })
        setSaving(false)
        if (!res.success) return toast.error(typeof res.error === 'string' ? res.error : 'Upload failed.')
        toast.success('Document uploaded.')
        setForm((current) => ({ ...current, file: null }))
        load()
    }

    const removeItem = async (folder, item) => {
        if (!window.confirm(`Remove ${item.label}?`)) return
        const res = await deleteDocumentItem(kind, folder.subject_ref && !isStudents ? folder.subject_ref : folder.subject_id, item.id)
        if (!res.success) return toast.error(typeof res.error === 'string' ? res.error : 'Could not remove the document.')
        toast.success('Document removed.')
        load()
    }

    const view = async (item) => {
        const res = await openDocumentFile(item.download_url)
        if (!res.success) toast.error(res.error || 'Could not open the document.')
    }

    const columns = [
        { key: 'subject_ref', label: isStudents ? 'Admission no.' : 'Employee ID', required: true },
        { key: 'name', label: 'Name' },
        ...(isStudents ? [{ key: 'class_name', label: 'Class', render: (row) => row.class_name || '—' }] : []),
        { key: 'items', label: 'Documents', render: (row) => row.items.length },
        { key: 'submitted_date', label: 'Submitted', render: (row) => row.submitted_date || '—' },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ]

    if (loading) return <FeedbackState kind='loading' title={`Loading ${noun} documents`} description='Fetching document folders…' />
    if (error) {
        return (
            <FeedbackState
                kind='error'
                title='Unable to load documents'
                description={error}
                action={<button type='button' onClick={load} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>Retry</button>}
            />
        )
    }

    return (
        <section className='space-y-5'>
            <PageHeader
                title={isStudents ? 'Student documents' : 'Employee documents'}
                description={`Secure document folders for each ${noun}.`}
                context={`${folders.length} folder(s)`}
            />

            <Surface title='Upload a document' description='Uploading adds the document to the person’s folder, or replaces the same document type.' contentClassName='p-4 sm:p-5'>
                <form onSubmit={submit} className='grid gap-3 md:grid-cols-4'>
                    <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>{isStudents ? 'Student' : 'Employee'}
                        <select value={form.ref} onChange={(e) => setForm((c) => ({ ...c, ref: e.target.value }))} className={inputClass}>
                            <option value=''>Select…</option>
                            {people.map((p) => <option key={p.ref} value={p.ref}>{p.label}</option>)}
                        </select>
                    </label>
                    <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Document
                        {isStudents ? (
                            <select value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} className={inputClass}>
                                {STUDENT_DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        ) : (
                            <input value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} maxLength={80} placeholder='e.g. Offer letter' className={inputClass} />
                        )}
                    </label>
                    {!isStudents ? (
                        <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                            <select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))} className={inputClass}>
                                <option>Pending</option>
                                <option>Approved</option>
                            </select>
                        </label>
                    ) : null}
                    <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>File
                        <input type='file' onChange={(e) => setForm((c) => ({ ...c, file: e.target.files?.[0] || null }))} className={`${inputClass} py-1.5`} />
                    </label>
                    <div className='flex items-end'>
                        <button type='submit' disabled={saving} className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer'>
                            {saving ? 'Uploading…' : 'Upload'}
                        </button>
                    </div>
                </form>
            </Surface>

            <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataToolbar
                    query={search}
                    onQueryChange={(value) => { setSearch(value); setPage(1) }}
                    searchLabel={`Search ${noun} documents`}
                    searchPlaceholder='Name or ID…'
                    resultCount={filtered.length}
                    onReset={() => { setSearch(''); setPage(1) }}
                />
                <DataTable
                    caption={`${noun} document folders`}
                    rows={pagination.rows}
                    columns={columns}
                    rowKey='id'
                    emptyTitle='No document folders yet'
                    emptyDescription='Upload a document above to create the first folder.'
                    renderActions={(row) => (
                        <button type='button' onClick={() => setOpenId(openId === row.id ? null : row.id)} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>
                            {openId === row.id ? 'Hide' : 'View'}
                        </button>
                    )}
                />
                <Pagination {...pagination} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} pageSizeOptions={[10, 25, 50]} />
            </div>

            {open ? (
                <Surface title={`${open.name} — ${open.subject_ref}`} description='Documents in this folder.' contentClassName='p-4 sm:p-5'>
                    {open.items.length === 0 ? (
                        <p className='text-sm text-[var(--erp-slate)]'>No documents in this folder.</p>
                    ) : (
                        <ul className='divide-y divide-[var(--erp-line)]'>
                            {open.items.map((item) => (
                                <li key={item.id} className='flex flex-wrap items-center justify-between gap-3 py-3'>
                                    <div className='min-w-0'>
                                        <p className='text-sm font-semibold text-[var(--erp-ink)]'>{item.label}</p>
                                        <p className='text-xs text-[var(--erp-slate)]'>{item.file_name || 'File'} · {item.status}</p>
                                    </div>
                                    <div className='flex gap-3'>
                                        <button type='button' onClick={() => view(item)} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>Open</button>
                                        <button type='button' onClick={() => removeItem(open, item)} className='text-sm font-semibold text-[#B42318] hover:underline cursor-pointer'>Remove</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Surface>
            ) : null}
        </section>
    )
}

export default LiveDocuments
