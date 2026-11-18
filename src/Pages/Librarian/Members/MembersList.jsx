import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listLibraryMembers,
    replaceLibraryMembers,
} from '../../../services/api/libraryApiService'

const emptyForm = {
    id: '',
    name: '',
    memberType: 'Student',
    classSection: '',
    admissionNumber: '',
    email: '',
    maxBorrowLimit: '1',
}

const MembersList = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API required for library members.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listLibraryMembers()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load members.')
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((m) => `${m.id} ${m.name} ${m.admissionNumber} ${m.email}`.toLowerCase().includes(q))
    }, [rows, search])

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

    const handleAdd = async (e) => {
        e.preventDefault()
        setNotice('')
        if (!live) return
        if (!form.name.trim()) {
            setError('Member name is required.')
            return
        }
        const id = form.id.trim() || `LMB-${Date.now()}`
        if (rows.some((m) => m.id === id)) {
            setError(`Member id ${id} already exists.`)
            return
        }
        const next = [
            ...rows,
            {
                id,
                name: form.name.trim(),
                memberType: form.memberType,
                role: form.memberType,
                classSection: form.classSection.trim(),
                admissionNumber: form.admissionNumber.trim() || id,
                email: form.email.trim(),
                currentlyBorrowedCount: 0,
                maxBorrowLimit: Number(form.maxBorrowLimit) || (form.memberType === 'Student' ? 1 : 5),
            },
        ]
        setSaving(true)
        const res = await replaceLibraryMembers(next)
        setSaving(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Server rejected member create.')
            return
        }
        setForm(emptyForm)
        setNotice(`Member "${form.name.trim()}" saved on the server.`)
        await load()
    }

    if (!live) {
        return (
            <section>
                <FeedbackState kind='error' title='Live API required' description='Members use GET/PUT /api/v1/ops/library-members.' />
            </section>
        )
    }

    return (
        <section className='space-y-4'>
            <p className='text-xs font-medium text-[#027A48]'>
                Live library members · GET/PUT /api/v1/ops/library-members
            </p>
            {error ? <FeedbackState kind='error' title='Members API' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading members' description='Fetching library members…' /> : null}
            {notice ? <p className='text-sm text-[#027A48] font-medium'>{notice}</p> : null}

            <form onSubmit={handleAdd} className='bg-white rounded-2xl shadow-md p-4 grid grid-cols-1 md:grid-cols-3 gap-3'>
                <input value={form.id} onChange={onChange('id')} placeholder='Member ID (optional)' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                <input value={form.name} onChange={onChange('name')} placeholder='Name *' required className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                <select value={form.memberType} onChange={onChange('memberType')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'>
                    <option value='Student'>Student</option>
                    <option value='Staff'>Staff</option>
                    <option value='Teacher'>Teacher</option>
                </select>
                <input value={form.admissionNumber} onChange={onChange('admissionNumber')} placeholder='Admission / Emp no' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                <input value={form.classSection} onChange={onChange('classSection')} placeholder='Class / Dept' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                <input value={form.email} onChange={onChange('email')} placeholder='Email' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                <button type='submit' disabled={saving} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md md:col-span-3 disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Add member'}
                </button>
            </form>

            {!loading ? (
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <div className='flex justify-between items-center mb-3 gap-3 flex-wrap'>
                        <h2 className='text-xl font-medium text-black'>Members · {filtered.length}</h2>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Search…'
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                        />
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3'>ID</th>
                                    <th className='px-2 py-3'>Name</th>
                                    <th className='px-2 py-3'>Type</th>
                                    <th className='px-2 py-3'>Admission</th>
                                    <th className='px-2 py-3'>Active loans</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className='px-2 py-8 text-center text-[#667085]'>No members yet.</td></tr>
                                ) : filtered.map((m) => (
                                    <tr key={m.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-3'>{m.id}</td>
                                        <td className='px-2 py-3 font-medium'>{m.name}</td>
                                        <td className='px-2 py-3'>{m.memberType || m.role}</td>
                                        <td className='px-2 py-3'>{m.admissionNumber || '—'}</td>
                                        <td className='px-2 py-3'>{m.currentlyBorrowedCount || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </section>
    )
}

export default MembersList
