import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FeedbackState } from '../../../../Common/ui'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listLibraryBooks, replaceLibraryBooks } from '../../../../services/api/libraryApiService'

const emptyForm = {
    id: '',
    title: '',
    author: '',
    isbn: '',
    category: '',
    publisher: '',
    shelf: '',
    totalCopies: '1',
}

const AddBooks = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        if (!live) {
            setError('Live API required to add books. Set VITE_USE_MOCK=false.')
            return
        }
        if (!form.title.trim() || !form.author.trim()) {
            setError('Title and author are required.')
            return
        }
        const copies = Math.max(1, Number(form.totalCopies) || 1)
        const id = form.id.trim() || `LBK-${Date.now()}`
        setSaving(true)
        const current = await listLibraryBooks()
        if (!current.success) {
            setSaving(false)
            setError(typeof current.error === 'string' ? current.error : 'Failed to load catalog.')
            return
        }
        if ((current.data || []).some((b) => b.id === id)) {
            setSaving(false)
            setError(`Book id ${id} already exists.`)
            return
        }
        const next = [
            ...(current.data || []),
            {
                id,
                title: form.title.trim(),
                author: form.author.trim(),
                isbn: form.isbn.trim(),
                category: form.category.trim() || 'General',
                publisher: form.publisher.trim(),
                shelf: form.shelf.trim(),
                totalCopies: copies,
                availableCopies: copies,
                status: 'Available',
                price: 0,
            },
        ]
        const saved = await replaceLibraryBooks(next)
        setSaving(false)
        if (!saved.success) {
            setError(typeof saved.error === 'string' ? saved.error : 'Server rejected book create.')
            return
        }
        setSuccess(`Book "${form.title.trim()}" saved on the server.`)
        setForm(emptyForm)
        setTimeout(() => navigate('/librarian/book-management/book-list'), 800)
    }

    return (
        <section className='space-y-4'>
            {live ? (
                <p className='text-xs font-medium text-[#027A48]'>
                    Live add book · PUT /api/v1/ops/library-books (full catalog replace)
                </p>
            ) : (
                <FeedbackState kind='error' title='Live API required' description='Book create uses FastAPI ops library-books.' />
            )}
            {error ? <FeedbackState kind='error' title='Could not save book' description={error} /> : null}
            {success ? <p className='text-sm text-[#027A48] font-medium'>{success}</p> : null}

            <form onSubmit={handleSubmit} className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                <h2 className='text-xl font-semibold text-black'>Book Information</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Book ID (optional)</label>
                        <input value={form.id} onChange={onChange('id')} placeholder='LBK-…' className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Title *</label>
                        <input value={form.title} onChange={onChange('title')} required className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Author *</label>
                        <input value={form.author} onChange={onChange('author')} required className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>ISBN</label>
                        <input value={form.isbn} onChange={onChange('isbn')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Category</label>
                        <input value={form.category} onChange={onChange('category')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Publisher</label>
                        <input value={form.publisher} onChange={onChange('publisher')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Shelf</label>
                        <input value={form.shelf} onChange={onChange('shelf')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-sm font-medium text-[#1E1E1E]'>Total copies</label>
                        <select value={form.totalCopies} onChange={onChange('totalCopies')} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'>
                            {['1', '2', '5', '10', '15', '20', '25', '30', '50'].map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className='flex gap-3'>
                    <button
                        type='submit'
                        disabled={saving || !live}
                        className='bg-[#515DEF] text-white text-sm px-5 py-2 rounded-md disabled:opacity-60'
                    >
                        {saving ? 'Saving…' : 'Save book'}
                    </button>
                    <button
                        type='button'
                        onClick={() => navigate('/librarian/book-management/book-list')}
                        className='border border-[#515DEF] text-[#515DEF] text-sm px-5 py-2 rounded-md'
                    >
                        Back to catalog
                    </button>
                </div>
            </form>
        </section>
    )
}

export default AddBooks
