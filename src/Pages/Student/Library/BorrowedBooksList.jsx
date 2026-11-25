import React, { useCallback, useEffect, useState, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Plus, BookOpen, X, Check } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { listLibraryIssues } from '../../../services/api/libraryApiService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const INITIAL_BOOKS = [
    {
        id: 'BR001',
        bookName: 'Fundamentals of Mathematics',
        authorName: 'R.S. Aggarwal',
        issuedDate: '01-08-2025',
        returnDate: '15-08-2025',
        status: 'Borrowed',
    },
    {
        id: 'BR002',
        bookName: 'English Grammar Guide',
        authorName: 'Wren & Martin',
        issuedDate: '20-07-2025',
        returnDate: '03-08-2025',
        status: 'Overdue',
    },
    {
        id: 'BR003',
        bookName: 'Concepts of Physics (Vol 1)',
        authorName: 'H.C. Verma',
        issuedDate: '10-09-2025',
        returnDate: '24-09-2025',
        status: 'Returned',
    },
]

const mapIssueRow = (row = {}) => {
    const statusRaw = String(row.status || 'Issued')
    let status = statusRaw
    if (/issued|borrowed/i.test(statusRaw) && !row.returnDate) status = 'Borrowed'
    if (/overdue/i.test(statusRaw) || Number(row.daysOverdue) > 0) status = 'Overdue'
    if (/return/i.test(statusRaw) || row.returnDate) status = 'Returned'
    return {
        id: row.id || '',
        bookName: row.bookTitle || row.bookName || '—',
        authorName: row.author || row.authorName || '—',
        issuedDate: row.issuedDate || '—',
        returnDate: row.returnDate || row.dueDate || '—',
        status,
    }
}

const BorrowedBooksList = () => {
    const live = isLiveApiEnabled()
    const [books, setBooks] = useState(() => (live ? [] : INITIAL_BOOKS))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [showRequestModal, setShowRequestModal] = useState(false)
    const [requestForm, setRequestForm] = useState({
        bookTitle: '',
        author: '',
        category: 'Mathematics',
        purpose: '',
    })

    const loadLive = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setBooks(INITIAL_BOOKS)
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await listLibraryIssues()
        setLoading(false)
        if (!res.success) {
            setBooks([])
            setError(typeof res.error === 'string' ? res.error : 'Failed to load library issues.')
            return
        }
        setBooks((Array.isArray(res.data) ? res.data : []).map(mapIssueRow))
    }, [])

    useEffect(() => {
        loadLive()
    }, [loadLive])

    const badgeColor = {
        Returned: 'bg-[#4CAF5033] text-[#4CAF50]',
        Borrowed: 'bg-[#FF980033] text-[#FF9800]',
        Overdue: 'bg-[#FF000033] text-[#FF0000]',
        Requested: 'bg-[#2196F333] text-[#2196F3]',
    }

    const handleClearFilters = () => {
        setSearchQuery('')
        setStatusFilter('')
        setFromDate(null)
        setToDate(null)
    }

    const handleRequestSubmit = (e) => {
        e.preventDefault()
        if (isLiveApiEnabled()) {
            toast.info('Book requests are handled by the Librarian portal. Live student self-request is not enabled yet.')
            setShowRequestModal(false)
            return
        }
        if (!requestForm.bookTitle.trim()) {
            toast.error('Book title is required.')
            return
        }
        const newReq = {
            id: `REQ-${Date.now().toString().slice(-4)}`,
            bookName: requestForm.bookTitle,
            authorName: requestForm.author || 'Not specified',
            issuedDate: new Date().toLocaleDateString('en-GB'),
            returnDate: 'Pending Allocation',
            status: 'Requested',
        }
        setBooks([newReq, ...books])
        setShowRequestModal(false)
        setRequestForm({ bookTitle: '', author: '', category: 'Mathematics', purpose: '' })
        toast.success(`Book request for "${newReq.bookName}" submitted to librarian!`)
    }

    const filteredBooks = useMemo(() => {
        return books.filter((item) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const match =
                    item.id.toLowerCase().includes(q) ||
                    item.bookName.toLowerCase().includes(q) ||
                    item.authorName.toLowerCase().includes(q)
                if (!match) return false
            }
            if (statusFilter && item.status !== statusFilter) return false
            return true
        })
    }, [books, searchQuery, statusFilter])

    return (
        <section className='space-y-6'>
            {live ? (
                <IntegrationNotice
                    state={error ? 'failed' : 'connected'}
                    title={error ? 'Library issues API failed' : 'Borrowed books are live'}
                    description={error || 'Loaded from GET /api/v1/ops/library-issues. Requests stay with the Librarian portal.'}
                />
            ) : null}
            {loading ? <FeedbackState kind='loading' title='Loading borrowed books' description='Fetching library issues…' /> : null}
            {error && !loading ? <FeedbackState kind='error' title='Library issues unavailable' description={error} /> : null}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={handleClearFilters}
                        className='bg-[#515DEF] text-white uppercase text-xs font-semibold px-4 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <span className='text-xs text-gray-500'>
                        {filteredBooks.length} books found
                    </span>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 lg:mt-6 mt-3'>
                    <div className='flex flex-col gap-y-1.5'>
                        <label htmlFor='search' className='text-xs font-semibold text-gray-600'>
                            Search
                        </label>
                        <input
                            type='text'
                            id='search'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder='Title, author, or book ID...'
                            className='text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                        />
                    </div>
                    <div className='flex flex-col gap-y-1.5'>
                        <label htmlFor='status' className='text-xs font-semibold text-gray-600'>
                            Status
                        </label>
                        <select
                            id='status'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                        >
                            <option value=''>All Statuses</option>
                            <option value='Borrowed'>Borrowed</option>
                            <option value='Returned'>Returned</option>
                            <option value='Overdue'>Overdue</option>
                            <option value='Requested'>Requested</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-semibold text-gray-600'>From Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable
                                placeholderText='Start Date'
                                className='w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                            />
                            <Calendar
                                size={15}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                            />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-semibold text-gray-600'>To Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable
                                placeholderText='End Date'
                                className='w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                            />
                            <Calendar
                                size={15}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <div>
                        <h2 className='text-xl font-bold text-gray-900'>Borrowed Books List</h2>
                        <p className='text-xs text-gray-500 mt-0.5'>
                            Track your borrowed library books and submit new book requests.
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={() => setShowRequestModal(true)}
                        className='inline-flex items-center gap-1.5 bg-[#515DEF] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-opacity-95 transition-all shadow-sm cursor-pointer'
                    >
                        <Plus className='w-4 h-4' />
                        Request New Book
                    </button>
                </div>

                <div className='relative overflow-x-auto rounded-lg border border-gray-100'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase rounded-s-lg'>Book ID</th>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase'>Book Name</th>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase'>Author Name</th>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase'>Issued Date</th>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase'>Return Date</th>
                                <th className='px-3 py-3.5 text-[#0C1E5B] font-semibold uppercase rounded-e-lg'>Status</th>
                            </tr>
                        </thead>

                        <tbody className='divide-y divide-gray-100'>
                            {filteredBooks.map((item) => (
                                <tr
                                    key={item.id}
                                    className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg transition-colors'
                                >
                                    <td className='px-3 py-4 font-semibold text-gray-900 rounded-s-lg'>
                                        {item.id}
                                    </td>
                                    <td className='px-3 py-4 font-medium text-gray-900'>
                                        {item.bookName}
                                    </td>
                                    <td className='px-3 py-4 text-gray-600'>{item.authorName}</td>
                                    <td className='px-3 py-4 text-gray-500'>{item.issuedDate}</td>
                                    <td className='px-3 py-4 text-gray-500'>{item.returnDate}</td>
                                    <td className='px-3 py-4 rounded-e-lg'>
                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                badgeColor[item.status] || 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Request New Book Modal */}
            {showRequestModal && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
                    <div className='bg-white rounded-2xl max-w-md w-full p-6 shadow-xl'>
                        <div className='flex items-center justify-between pb-3 border-b mb-4'>
                            <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
                                <BookOpen className='w-5 h-5 text-[#515DEF]' />
                                Request Book from Library
                            </h3>
                            <button
                                type='button'
                                onClick={() => setShowRequestModal(false)}
                                className='text-gray-400 hover:text-gray-600'
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleRequestSubmit} className='space-y-4'>
                            <div>
                                <label className='block text-xs font-semibold text-gray-700 mb-1'>
                                    Book Title *
                                </label>
                                <input
                                    type='text'
                                    required
                                    placeholder='e.g. A Brief History of Time'
                                    value={requestForm.bookTitle}
                                    onChange={(e) =>
                                        setRequestForm({ ...requestForm, bookTitle: e.target.value })
                                    }
                                    className='w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-[#515DEF]'
                                />
                            </div>

                            <div>
                                <label className='block text-xs font-semibold text-gray-700 mb-1'>
                                    Author Name
                                </label>
                                <input
                                    type='text'
                                    placeholder='e.g. Stephen Hawking'
                                    value={requestForm.author}
                                    onChange={(e) =>
                                        setRequestForm({ ...requestForm, author: e.target.value })
                                    }
                                    className='w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-[#515DEF]'
                                />
                            </div>

                            <div>
                                <label className='block text-xs font-semibold text-gray-700 mb-1'>
                                    Subject / Category
                                </label>
                                <select
                                    value={requestForm.category}
                                    onChange={(e) =>
                                        setRequestForm({ ...requestForm, category: e.target.value })
                                    }
                                    className='w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-[#515DEF]'
                                >
                                    <option value='Mathematics'>Mathematics</option>
                                    <option value='Physics'>Physics</option>
                                    <option value='Chemistry'>Chemistry</option>
                                    <option value='Biology'>Biology</option>
                                    <option value='Computer Science'>Computer Science</option>
                                    <option value='English Literature'>English Literature</option>
                                    <option value='Social Studies'>Social Studies</option>
                                    <option value='General Knowledge'>General Knowledge</option>
                                </select>
                            </div>

                            <div>
                                <label className='block text-xs font-semibold text-gray-700 mb-1'>
                                    Purpose / Notes
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder='e.g. Reference book for science fair project'
                                    value={requestForm.purpose}
                                    onChange={(e) =>
                                        setRequestForm({ ...requestForm, purpose: e.target.value })
                                    }
                                    className='w-full text-sm p-2.5 border rounded-lg focus:ring-2 focus:ring-[#515DEF]'
                                />
                            </div>

                            <div className='flex justify-end gap-3 pt-3 border-t'>
                                <button
                                    type='button'
                                    onClick={() => setShowRequestModal(false)}
                                    className='px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='px-5 py-2 text-sm text-white bg-[#515DEF] rounded-lg hover:bg-opacity-90 font-medium'
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}

export default BorrowedBooksList
