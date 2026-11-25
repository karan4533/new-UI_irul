import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    BookOpen,
    BookMarked,
    Clock,
    Users,
    Plus,
    CheckCircle2,
    AlertCircle,
    BookmarkCheck,
    Send,
    ShieldAlert,
} from 'lucide-react'
import { IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getIssuedBooks,
    getBookRequests,
    saveBookRequests,
    hydrateBookRequests,
    getCatalogBooks,
    REGISTERED_MEMBERS,
} from '../libraryData'
import {
    loadLibraryWorkspace,
    replaceLibraryBooks,
    replaceLibraryIssues,
    replaceLibraryMembers,
} from '../../../services/api/libraryApiService'

const isActiveLoan = (row) => {
    const status = String(row?.status || '').toLowerCase()
    return status === 'issued' || status === 'overdue'
}

const isOverdueLoan = (row) => String(row?.status || '').toLowerCase() === 'overdue'

const Dashboard = () => {
    const live = isLiveApiEnabled()
    const [catalogBooks, setCatalogBooks] = useState(() => (live ? [] : getCatalogBooks()))
    const [issuedList, setIssuedList] = useState(() => (live ? [] : getIssuedBooks()))
    const [members, setMembers] = useState(() => (live ? [] : REGISTERED_MEMBERS))
    const [bookRequests, setBookRequests] = useState(() => (live ? [] : getBookRequests()))
    const [activeTab, setActiveTab] = useState('overview')
    const [actionNotice, setActionNotice] = useState('')
    const [liveSource, setLiveSource] = useState(live ? 'loading' : 'local')
    const [liveError, setLiveError] = useState('')
    const [saving, setSaving] = useState(false)
    const [requestsError, setRequestsError] = useState('')

    const refreshLive = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setCatalogBooks(getCatalogBooks())
            setIssuedList(getIssuedBooks())
            setMembers(REGISTERED_MEMBERS)
            setBookRequests(getBookRequests())
            setLiveSource('local')
            setLiveError('')
            return
        }
        setLiveSource((prev) => (prev === 'backend' ? 'backend' : 'loading'))
        const res = await loadLibraryWorkspace()
        if (!res.success) {
            setLiveSource('error')
            setLiveError(typeof res.error === 'string' ? res.error : 'Failed to load library collections.')
            setCatalogBooks([])
            setIssuedList([])
            setMembers([])
            setBookRequests([])
            return
        }
        setCatalogBooks(res.data.books || [])
        setIssuedList(res.data.issues || [])
        setMembers(res.data.members || [])
        const reqRes = await hydrateBookRequests()
        setBookRequests(reqRes.success ? getBookRequests() : [])
        setRequestsError(reqRes.success ? '' : (typeof reqRes.error === 'string' ? reqRes.error : 'Failed to load library requests.'))
        setLiveSource('backend')
        setLiveError('')
    }, [])

    useEffect(() => {
        refreshLive()
    }, [refreshLive])

    const totalTitles = catalogBooks.length
    const totalCopies = catalogBooks.reduce((sum, row) => sum + (Number(row.totalCopies) || 0), 0)
    const activeCirculation = issuedList.filter(isActiveLoan).length
    const overdueBooks = issuedList.filter(isOverdueLoan)
    const studentMembers = members.filter((m) => String(m.memberType || m.role || '').toLowerCase().includes('student')).length
    const facultyMembers = Math.max(0, members.length - studentMembers)

    const categoryBreakdown = useMemo(() => {
        const counts = new Map()
        catalogBooks.forEach((book) => {
            const key = String(book.category || 'Uncategorized').trim() || 'Uncategorized'
            counts.set(key, (counts.get(key) || 0) + 1)
        })
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count: `${count} Title${count === 1 ? '' : 's'}` }))
    }, [catalogBooks])

    const handleApproveRequest = async (reqId) => {
        const updated = bookRequests.map((r) =>
            r.id === reqId
                ? { ...r, status: 'Approved & Reserved', librarianRemarks: 'Approved by Chief Librarian; reserved on Shelf R-01.' }
                : r
        )
        if (live) {
            setSaving(true)
            const res = await saveBookRequests(updated)
            setSaving(false)
            if (!res?.success) {
                toast.error(res?.error || 'Server rejected book request approval.')
                await refreshLive()
                return
            }
            setBookRequests(updated)
            setActionNotice(`Book request #${reqId} approved (server confirmed).`)
            setTimeout(() => setActionNotice(''), 4000)
            return
        }
        setBookRequests(updated)
        saveBookRequests(updated)
        setActionNotice(`Book request #${reqId} approved locally (browser demo).`)
        setTimeout(() => setActionNotice(''), 4000)
    }

    const handleMarkReturned = async (issueId) => {
        if (live) {
            const target = issuedList.find((item) => item.id === issueId)
            if (!target) {
                toast.error('Issue record not found.')
                return
            }
            const returnDateStr = new Date().toLocaleDateString('en-GB')
            const nextIssues = issuedList.map((item) => (
                item.id === issueId
                    ? { ...item, status: 'Returned', returnDate: returnDateStr, returnComment: 'Returned in good condition' }
                    : item
            ))
            const nextBooks = catalogBooks.map((b) => (
                b.id === target.bookId
                    ? {
                        ...b,
                        availableCopies: Math.min(
                            Number(b.totalCopies) || (Number(b.availableCopies) || 0) + 1,
                            (Number(b.availableCopies) || 0) + 1,
                        ),
                        status: 'Available',
                    }
                    : b
            ))
            const nextMembers = members.map((m) => (
                m.id === target.memberId
                    ? { ...m, currentlyBorrowedCount: Math.max(0, (Number(m.currentlyBorrowedCount) || 0) - 1) }
                    : m
            ))
            setSaving(true)
            const [booksRes, issuesRes, membersRes] = await Promise.all([
                replaceLibraryBooks(nextBooks),
                replaceLibraryIssues(nextIssues),
                replaceLibraryMembers(nextMembers),
            ])
            setSaving(false)
            if (!booksRes.success || !issuesRes.success || !membersRes.success) {
                toast.error(booksRes.error || issuesRes.error || membersRes.error || 'Server rejected return.')
                return
            }
            await refreshLive()
            setActionNotice(`Book "${target.bookTitle}" returned (server confirmed).`)
            toast.success('Return persisted on the server.')
            setTimeout(() => setActionNotice(''), 4000)
            return
        }

        const updated = issuedList.map((i) =>
            i.id === issueId
                ? { ...i, status: 'Returned', returnDate: new Date().toLocaleDateString('en-GB') }
                : i
        )
        setIssuedList(updated)
        setActionNotice('Book returned and restored to circulation shelf (browser only).')
        setTimeout(() => setActionNotice(''), 4000)
    }

    const handleSendReminder = (borrowerName, bookTitle) => {
        setActionNotice(
            live
                ? `Reminder UI only — no SMS/email gateway for library overdue alerts. Recorded intent for ${borrowerName} / "${bookTitle}".`
                : `Overdue return notification and SMS alert dispatched to ${borrowerName} for "${bookTitle}" (demo).`,
        )
        setTimeout(() => setActionNotice(''), 4500)
    }

    return (
        <section className='space-y-6 pb-10'>
            {liveSource === 'backend' ? (
                <IntegrationNotice
                    state='connected'
                    title='Live library dashboard'
                    description='Catalog, circulation, overdue, and member KPIs hydrate from GET /api/v1/ops/library-books|issues|members. Mark Returned persists via full-collection PUT. Book requisitions hydrate from GET /api/v1/ops/library-requests (empty is OK). SMS reminders remain UI-only (no gateway).'
                />
            ) : liveSource === 'error' ? (
                <IntegrationNotice
                    state='failed'
                    title='Library dashboard unavailable'
                    description={liveError || 'Could not load /api/v1/ops/library-* collections.'}
                />
            ) : liveSource === 'loading' ? (
                <IntegrationNotice
                    state='connected'
                    title='Loading library dashboard'
                    description='Fetching /api/v1/ops/library-* collections…'
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Browser mock library dashboard'
                    description='KPI charts and requisition queue use local demo data. Enable live API for ops library collections.'
                />
            )}

            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 p-6'>
                <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                    <div>
                        <div className='flex items-center gap-2.5'>
                            <div className='p-2.5 bg-indigo-50 text-[#515DEF] rounded-xl'>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h1 className='text-2xl font-bold text-slate-900'>Central Library Dashboard</h1>
                                <p className='text-xs text-slate-500 mt-0.5'>
                                    Institutional catalog, circulation transactions, borrowing rules enforcement, and reservation queues.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className='flex items-center gap-2 flex-wrap'>
                        <NavLink
                            to='/librarian/issued-books/add-issued-book'
                            className='inline-flex items-center gap-1.5 px-4 py-2 bg-[#515DEF] hover:bg-[#434ecb] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer'
                        >
                            <Plus size={15} /> Issue Book
                        </NavLink>
                        <NavLink
                            to='/librarian/book-management/add-book'
                            className='inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer'
                        >
                            <Plus size={15} /> Add New Title
                        </NavLink>
                    </div>
                </div>

                <div className='mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs bg-indigo-50/50 p-3 rounded-xl border border-indigo-100'>
                    <div className='flex items-center gap-2 text-indigo-900 font-semibold'>
                        <ShieldAlert size={16} className='text-[#515DEF]' />
                        <span>Institutional Borrowing Limits:</span>
                    </div>
                    <div className='flex items-center gap-4 text-indigo-800'>
                        <span>Students: <strong>Max 1 Book</strong> (14 Days Loan)</span>
                        <span>•</span>
                        <span>Staff & Faculty: <strong>Max 5 Books</strong> (30 Days Loan)</span>
                        <span>•</span>
                        <span>Late Fee: <strong>₹5/day (Student)</strong> / <strong>₹2/day (Staff)</strong></span>
                    </div>
                </div>
            </div>

            {actionNotice && (
                <div className='p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in'>
                    <CheckCircle2 size={16} className='text-emerald-600 shrink-0' />
                    <span>{actionNotice}</span>
                </div>
            )}

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <NavLink
                    to='/librarian/book-management/book-list'
                    className='bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group'
                >
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold uppercase tracking-wider group-hover:text-indigo-600 transition-colors'>Catalog Titles</span>
                        <BookMarked size={18} className='text-[#515DEF]' />
                    </div>
                    <div className='mt-3 flex items-baseline gap-2'>
                        <span className='text-2xl font-bold text-slate-900'>{totalTitles.toLocaleString()}</span>
                        <span className='text-xs text-slate-400'>({totalCopies.toLocaleString()} copies)</span>
                    </div>
                    <span className='text-xs text-emerald-600 font-medium block mt-1'>
                        {liveSource === 'backend' ? 'From library-books →' : '98.2% catalog verified →'}
                    </span>
                </NavLink>

                <NavLink
                    to='/librarian/issued-books/issued-book-list'
                    className='bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group'
                >
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold uppercase tracking-wider group-hover:text-blue-600 transition-colors'>Active Circulation</span>
                        <Clock size={18} className='text-blue-600' />
                    </div>
                    <div className='mt-3 flex items-baseline gap-2'>
                        <span className='text-2xl font-bold text-blue-600'>{activeCirculation}</span>
                        <span className='text-xs text-slate-400'>books currently issued</span>
                    </div>
                    <span className='text-xs text-slate-500 font-medium block mt-1'>
                        Across students & faculty →
                    </span>
                </NavLink>

                <button
                    type='button'
                    onClick={() => setActiveTab('overview')}
                    className='bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-rose-300 transition-all group text-left cursor-pointer'
                >
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold uppercase tracking-wider group-hover:text-rose-600 transition-colors'>Overdue Returns</span>
                        <AlertCircle size={18} className='text-rose-600' />
                    </div>
                    <div className='mt-3 flex items-baseline gap-2'>
                        <span className='text-2xl font-bold text-rose-600'>{overdueBooks.length}</span>
                        <span className='text-xs text-rose-500'>requires attention</span>
                    </div>
                    <span className='text-xs text-rose-600 font-medium block mt-1'>
                        Total fines pending: ₹{overdueBooks.reduce((acc, curr) => acc + (curr.lateFee || 0), 0)} →
                    </span>
                </button>

                <NavLink
                    to='/librarian/members/member-list'
                    className='bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group'
                >
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-600 transition-colors'>Registered Members</span>
                        <Users size={18} className='text-emerald-600' />
                    </div>
                    <div className='mt-3 flex items-baseline gap-2'>
                        <span className='text-2xl font-bold text-emerald-600'>{members.length.toLocaleString()}</span>
                        <span className='text-xs text-slate-400'>active</span>
                    </div>
                    <span className='text-xs text-slate-500 font-medium block mt-1'>
                        {studentMembers} Students • {facultyMembers} Faculty →
                    </span>
                </NavLink>
            </div>

            <div className='flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit'>
                <button
                    type='button'
                    onClick={() => setActiveTab('overview')}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'overview'
                            ? 'bg-white text-[#515DEF] shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Circulation & Overdue Books ({overdueBooks.length})
                </button>
                <button
                    type='button'
                    onClick={() => setActiveTab('requests')}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'requests'
                            ? 'bg-white text-[#515DEF] shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Book Requisitions & Requests ({bookRequests.length})
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className='space-y-6'>
                    <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                        <div className='p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                            <div>
                                <div className='flex items-center gap-2'>
                                    <AlertCircle className='text-rose-600' size={18} />
                                    <h3 className='text-base font-bold text-slate-900'>Overdue Books Tracking</h3>
                                </div>
                                <p className='text-xs text-slate-500 mt-0.5'>
                                    {liveSource === 'backend'
                                        ? 'Derived from live library-issues with status Overdue. Mark Returned writes books + issues + members.'
                                        : 'Books that have exceeded loan duration; automated fine calculations applied.'}
                                </p>
                            </div>
                            <span className='text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200'>
                                {overdueBooks.length} Overdue Loans
                            </span>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-slate-50 text-slate-600 uppercase font-semibold'>
                                    <tr>
                                        <th className='px-4 py-3'>Book Details</th>
                                        <th className='px-4 py-3'>Borrower</th>
                                        <th className='px-4 py-3'>Member Type</th>
                                        <th className='px-4 py-3'>Due Date</th>
                                        <th className='px-4 py-3'>Days Overdue</th>
                                        <th className='px-4 py-3'>Accrued Fine</th>
                                        <th className='px-4 py-3 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {overdueBooks.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className='px-4 py-8 text-center text-xs text-slate-500'>
                                                {liveSource === 'loading' ? 'Loading overdue loans…' : 'No overdue loans in the current library-issues collection.'}
                                            </td>
                                        </tr>
                                    ) : null}
                                    {overdueBooks.map((item) => (
                                        <tr key={item.id} className='hover:bg-slate-50/50'>
                                            <td className='px-4 py-3.5'>
                                                <span className='font-bold text-slate-900 block'>{item.bookTitle}</span>
                                                <span className='text-xs text-slate-400'>ID: {item.bookId} • Author: {item.author}</span>
                                            </td>
                                            <td className='px-4 py-3.5'>
                                                <span className='font-semibold text-slate-800 block'>{item.memberName}</span>
                                                <span className='text-xs text-slate-400'>{item.admissionNumber}</span>
                                            </td>
                                            <td className='px-4 py-3.5'>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    item.memberType === 'Student'
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                                                }`}>
                                                    {item.memberType}
                                                </span>
                                            </td>
                                            <td className='px-4 py-3.5 font-semibold text-slate-700'>{item.dueDate}</td>
                                            <td className='px-4 py-3.5 font-bold text-rose-600'>{item.daysOverdue} days</td>
                                            <td className='px-4 py-3.5 font-bold text-slate-900'>₹{item.lateFee}</td>
                                            <td className='px-4 py-3.5 text-right whitespace-nowrap space-x-2'>
                                                <button
                                                    type='button'
                                                    onClick={() => handleSendReminder(item.memberName, item.bookTitle)}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all'
                                                >
                                                    <Send size={11} /> Send Reminder
                                                </button>
                                                <button
                                                    type='button'
                                                    disabled={saving}
                                                    onClick={() => handleMarkReturned(item.id)}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all disabled:opacity-50'
                                                >
                                                    <CheckCircle2 size={11} /> Mark Returned
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-sm border border-slate-100 p-5'>
                        <h3 className='text-sm font-bold text-slate-900 mb-4'>Collection by Subject Category</h3>
                        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center'>
                            {(categoryBreakdown.length
                                ? categoryBreakdown.map((cat) => ({
                                    ...cat,
                                    color: 'bg-slate-50 text-slate-700',
                                }))
                                : live ? [] : [
                                    { name: 'Science & Physics', count: '480 Titles', color: 'bg-blue-50 text-blue-700' },
                                    { name: 'Mathematics', count: '320 Titles', color: 'bg-purple-50 text-purple-700' },
                                    { name: 'Literature & Fiction', count: '290 Titles', color: 'bg-rose-50 text-rose-700' },
                                    { name: 'Computer Science', count: '180 Titles', color: 'bg-cyan-50 text-cyan-700' },
                                    { name: 'History & Civics', count: '110 Titles', color: 'bg-amber-50 text-amber-700' },
                                    { name: 'Reference & Dict', count: '100 Titles', color: 'bg-emerald-50 text-emerald-700' },
                                ]
                            ).map((cat) => (
                                <div key={cat.name} className={`p-3 rounded-xl border border-slate-100 ${cat.color}`}>
                                    <span className='font-bold text-xs block'>{cat.name}</span>
                                    <span className='text-xs opacity-80 mt-1 block font-medium'>{cat.count}</span>
                                </div>
                            ))}
                        </div>
                        {liveSource === 'backend' && categoryBreakdown.length === 0 ? (
                            <p className='text-xs text-slate-500 mt-3'>No category tags on live catalog titles yet.</p>
                        ) : null}
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className='space-y-4'>
                    {live ? (
                        <IntegrationNotice
                            state={requestsError ? 'failed' : 'connected'}
                            title={requestsError ? 'Book requisitions unavailable' : 'Book requisitions — live'}
                            description={requestsError || 'Queue loaded from GET /api/v1/ops/library-requests; approvals persist via full-collection PUT. An empty queue means no requests on the server.'}
                        />
                    ) : (
                        <IntegrationNotice
                            state='mock'
                            title='Book requisitions — browser demo'
                            description='Demo requisition queue stored in browser localStorage. Enable live API for library-requests.'
                        />
                    )}
                    <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                        <div className='p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                            <div>
                                <div className='flex items-center gap-2'>
                                    <BookmarkCheck className='text-[#515DEF]' size={18} />
                                    <h3 className='text-base font-bold text-slate-900'>Student & Staff Book Requests</h3>
                                </div>
                                <p className='text-xs text-slate-500 mt-0.5'>Review requisition requests for new titles or reserved library acquisitions.</p>
                            </div>
                            <span className='text-xs font-semibold text-[#515DEF] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200'>
                                {bookRequests.length} Total Requests
                            </span>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-slate-50 text-slate-600 uppercase font-semibold'>
                                    <tr>
                                        <th className='px-4 py-3'>Requisition ID</th>
                                        <th className='px-4 py-3'>Requested Book & Author</th>
                                        <th className='px-4 py-3'>Category</th>
                                        <th className='px-4 py-3'>Requested By</th>
                                        <th className='px-4 py-3'>Reason / Purpose</th>
                                        <th className='px-4 py-3'>Status</th>
                                        <th className='px-4 py-3 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {bookRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className='px-4 py-8 text-center text-xs text-slate-500'>
                                                {liveSource === 'loading' ? 'Loading book requests…' : 'No book requisitions in the queue.'}
                                            </td>
                                        </tr>
                                    ) : null}
                                    {bookRequests.map((req) => (
                                        <tr key={req.id} className='hover:bg-slate-50/50'>
                                            <td className='px-4 py-3.5 font-bold text-slate-800'>{req.id}</td>
                                            <td className='px-4 py-3.5'>
                                                <span className='font-bold text-slate-900 block'>{req.title}</span>
                                                <span className='text-xs text-slate-400'>By: {req.author} • ISBN: {req.isbn}</span>
                                            </td>
                                            <td className='px-4 py-3.5 text-xs text-slate-600 font-medium'>{req.category}</td>
                                            <td className='px-4 py-3.5'>
                                                <span className='font-semibold text-slate-800 block text-xs'>{req.requestedBy}</span>
                                                <span className='text-xs text-slate-400'>{req.requestedByRole}</span>
                                            </td>
                                            <td className='px-4 py-3.5 text-xs text-slate-600 max-w-xs'>{req.reason}</td>
                                            <td className='px-4 py-3.5'>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                    req.status === 'Approved & Reserved'
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        : req.status === 'Ready for Pickup'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    {req.status}
                                                </span>
                                                {req.librarianRemarks && (
                                                    <span className='block text-[11px] text-slate-400 mt-0.5 italic'>
                                                        {req.librarianRemarks}
                                                    </span>
                                                )}
                                            </td>
                                            <td className='px-4 py-3.5 text-right whitespace-nowrap'>
                                                {req.status === 'Pending Review' ? (
                                                    <button
                                                        type='button'
                                                        disabled={saving}
                                                        onClick={() => handleApproveRequest(req.id)}
                                                        className='inline-flex items-center gap-1 px-3 py-1.5 bg-[#515DEF] hover:bg-[#434ecb] text-white text-xs font-bold rounded-lg shadow-xs transition-all'
                                                    >
                                                        <CheckCircle2 size={12} /> Approve & Reserve
                                                    </button>
                                                ) : (
                                                    <span className='text-xs font-semibold text-emerald-600'>Processed</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

export default Dashboard
