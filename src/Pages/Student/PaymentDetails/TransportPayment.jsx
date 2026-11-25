import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'react-toastify'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Bus, CreditCard, CheckCircle2, Receipt, X } from 'lucide-react'
import { feeService } from '../../../services/modules/feeService'
import { transportService } from '../../../services/modules/transportService'
import { useAuth } from '../../../context/AuthContext'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportStudentAssignments } from '../../../services/api/transportApiService'

const DEFAULT_TRANSPORT_RECORDS = [
    {
        id: 'INV-TRP-2026-001',
        invoiceNumber: 'INV/TRP/2025-26/101',
        studentId: 'STU-001',
        routeName: 'Route 4: Anna Nagar -> Collectorate -> Campus',
        vehicleNumber: 'BUS-04 (TN-58-BZ-4190)',
        transportFee: 6000,
        paidAmount: 3000,
        balanceAmount: 3000,
        dueDate: '15-11-2026',
        status: 'Partially Paid',
        paymentMethod: 'UPI',
        receiptNumber: 'REC-2026-101',
    },
    {
        id: 'INV-TRP-2026-002',
        invoiceNumber: 'INV/TRP/2025-26/089',
        studentId: 'STU-001',
        routeName: 'Route 4: Anna Nagar -> Collectorate -> Campus',
        vehicleNumber: 'BUS-04 (TN-58-BZ-4190)',
        transportFee: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        dueDate: '15-06-2025',
        status: 'Paid',
        paymentMethod: 'Net Banking',
        receiptNumber: 'REC-2026-089',
    },
]

const badgeColor = {
    Paid: 'bg-[#4CAF5033] text-[#4CAF50]',
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    'Partially Paid': 'bg-[#FF980033] text-[#FF9800]',
    'Not Paid': 'bg-[#FF000033] text-[#FF0000]',
}

const TransportPayment = () => {
    const [fromDate, setFromDate] = useState(new Date())
    const [toDate, setToDate] = useState(new Date())
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const { user, employeeId } = useAuth()
    const live = isLiveApiEnabled()
    const liveStudentId = user?.studentId || user?.id || employeeId || ''

    // Live: start empty — never DEFAULT_TRANSPORT_RECORDS / demo route.
    const [records, setRecords] = useState(live ? [] : DEFAULT_TRANSPORT_RECORDS)
    const [activeRouteInfo, setActiveRouteInfo] = useState(
        live
            ? { routeName: '—', vehicleNumber: '—' }
            : {
                routeName: 'Route 4: Anna Nagar -> Collectorate -> Campus',
                vehicleNumber: 'BUS-04 (TN-58-BZ-4190)',
            },
    )
    const [liveLoaded, setLiveLoaded] = useState(!live)

    // Payment modal state
    const [payModalItem, setPayModalItem] = useState(null)
    const [selectedMethod, setSelectedMethod] = useState('UPI')
    const [isProcessing, setIsProcessing] = useState(false)

    // Receipt modal state
    const [viewReceiptItem, setViewReceiptItem] = useState(null)

    const loadData = useCallback(async () => {
        if (live) {
            try {
                const [assignRes, invRes] = await Promise.all([
                    listTransportStudentAssignments(),
                    feeService.getInvoices(),
                ])
                const mine = assignRes.success && liveStudentId
                    ? (assignRes.data || []).find(
                        (a) => String(a.studentId) === String(liveStudentId) || String(a.admissionNumber) === String(liveStudentId),
                    )
                    : null
                const routeName = mine?.routeName ? `${mine.routeName}${mine.stopName ? ` (${mine.stopName})` : ''}` : '—'
                const vehicleNumber = mine?.vehicleNumber || '—'
                setActiveRouteInfo({ routeName, vehicleNumber })
                if (invRes.success && Array.isArray(invRes.data) && liveStudentId) {
                    const mapped = invRes.data
                        .filter((inv) => String(inv.studentId) === String(liveStudentId))
                        .filter((inv) =>
                            inv.items?.some(
                                (i) => i.feeHeadId === 'FH-TRN' || String(i.name || '').toLowerCase().includes('transport'),
                            ) || String(inv.invoiceNumber || '').includes('TRP'),
                        )
                        .map((inv) => ({
                            id: inv.id,
                            invoiceNumber: inv.invoiceNumber,
                            studentId: inv.studentId,
                            routeName: inv.routeName || routeName,
                            vehicleNumber: inv.vehicleNumber || vehicleNumber,
                            transportFee: inv.totalAmount || 0,
                            paidAmount: inv.paidAmount || 0,
                            balanceAmount: inv.balanceAmount ?? ((inv.totalAmount || 0) - (inv.paidAmount || 0)),
                            dueDate: inv.dueDate || '—',
                            status: inv.status || (inv.balanceAmount === 0 ? 'Paid' : 'Pending'),
                            paymentMethod: inv.paymentMethod || '—',
                            receiptNumber: inv.receipts?.[0] || '',
                        }))
                    setRecords(mapped)
                } else {
                    setRecords([])
                }
            } catch {
                setRecords([])
            } finally {
                setLiveLoaded(true)
            }
            return
        }
        try {
            const [routesRes, manifestRes, invRes] = await Promise.all([
                transportService.getRoutes(),
                transportService.getPassengerManifest(),
                feeService.getInvoices(),
            ])

            let routeName = 'Route 4: Anna Nagar -> Collectorate -> Campus'
            let vehicleNumber = 'BUS-04 (TN-58-BZ-4190)'

            if (routesRes.success && Array.isArray(routesRes.data) && routesRes.data.length > 0) {
                const r = routesRes.data[0]
                routeName = r.name || routeName
                vehicleNumber = r.busNumber || vehicleNumber
            }

            if (manifestRes.success && Array.isArray(manifestRes.data)) {
                const s = manifestRes.data.find((m) => m.studentId === 'STU-001' || m.studentId === 'STU-2025-1001')
                if (s && s.stopName) {
                    routeName = `${routeName} (${s.stopName})`
                }
            }

            setActiveRouteInfo({ routeName, vehicleNumber })

            if (invRes.success && Array.isArray(invRes.data)) {
                const transportInvoices = invRes.data.filter((inv) =>
                    inv.items?.some(
                        (i) => i.feeHeadId === 'FH-TRN' || String(i.name || '').toLowerCase().includes('transport'),
                    ) || String(inv.invoiceNumber || '').includes('TRP'),
                )

                if (transportInvoices.length > 0) {
                    const mapped = transportInvoices.map((inv) => ({
                        id: inv.id,
                        invoiceNumber: inv.invoiceNumber,
                        studentId: inv.studentId,
                        routeName: inv.routeName || routeName,
                        vehicleNumber: inv.vehicleNumber || vehicleNumber,
                        transportFee: inv.totalAmount || 5000,
                        paidAmount: inv.paidAmount || 0,
                        balanceAmount: inv.balanceAmount ?? (inv.totalAmount - (inv.paidAmount || 0)),
                        dueDate: inv.dueDate || '15-11-2026',
                        status: inv.status || (inv.balanceAmount === 0 ? 'Paid' : 'Pending'),
                        paymentMethod: inv.paymentMethod || 'Net Banking',
                        receiptNumber: inv.receipts?.[0] || `REC-${inv.invoiceNumber}`,
                    }))
                    setRecords(mapped)
                    return
                }
            }
        } catch {
            // Graceful fallback to default mock data
        }
    }, [live, liveStudentId])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleClearFilters = () => {
        setFromDate(new Date())
        setToDate(new Date())
        setSearchTerm('')
        setStatusFilter('')
        toast.info('Transport payment filters cleared')
    }

    const handleOpenPayModal = (item) => {
        setPayModalItem(item)
        setSelectedMethod('UPI')
    }

    const handleConfirmPayment = async () => {
        if (!payModalItem) return
        setIsProcessing(true)

        const amountToPay = payModalItem.balanceAmount || payModalItem.transportFee || 3000
        try {
            const payRes = await feeService.recordPayment({
                invoiceId: payModalItem.id,
                studentId: payModalItem.studentId || (live ? liveStudentId : 'STU-001'),
                amount: amountToPay,
                paymentMethod: selectedMethod,
            })
            if (live && payRes && payRes.success === false) {
                setIsProcessing(false)
                toast.error(payRes.error || payRes.message || 'Payment could not be recorded.')
                return
            }
        } catch (err) {
            if (live) {
                setIsProcessing(false)
                toast.error(err?.message || 'Payment could not be recorded.')
                return
            }
            // Handled gracefully in mock
        }

        const generatedReceipt = `REC/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`

        setRecords((prev) =>
            prev.map((r) => {
                if (r.id === payModalItem.id) {
                    return {
                        ...r,
                        paidAmount: r.transportFee,
                        balanceAmount: 0,
                        status: 'Paid',
                        paymentMethod: selectedMethod,
                        receiptNumber: generatedReceipt,
                    }
                }
                return r
            }),
        )

        setIsProcessing(false)
        setPayModalItem(null)
        toast.success(`Payment of ₹${amountToPay.toLocaleString('en-IN')} confirmed! Receipt: ${generatedReceipt}`)
    }

    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            const matchesSearch =
                !searchTerm ||
                r.routeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = !statusFilter || r.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [records, searchTerm, statusFilter])

    const totalDue = useMemo(
        () => records.reduce((acc, r) => acc + (r.balanceAmount || 0), 0),
        [records],
    )
    const totalPaid = useMemo(
        () => records.reduce((acc, r) => acc + (r.paidAmount || 0), 0),
        [records],
    )

    return (
        <section className='space-y-6'>
            {/* KPI Dues & Route Summary */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0'>
                        <Bus className='w-6 h-6' />
                    </div>
                    <div className='min-w-0'>
                        <p className='text-xs text-slate-500 font-medium'>Assigned Vehicle</p>
                        <p className='text-sm font-bold text-slate-800 truncate'>{activeRouteInfo.vehicleNumber}</p>
                    </div>
                </div>

                <div className='bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0'>
                        <CreditCard className='w-6 h-6' />
                    </div>
                    <div>
                        <p className='text-xs text-slate-500 font-medium'>Live Transport Due</p>
                        <p className='text-xl font-bold text-amber-600'>₹{totalDue.toLocaleString('en-IN')}</p>
                    </div>
                </div>

                <div className='bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0'>
                        <CheckCircle2 className='w-6 h-6' />
                    </div>
                    <div>
                        <p className='text-xs text-slate-500 font-medium'>Total Fees Paid</p>
                        <p className='text-xl font-bold text-emerald-600'>₹{totalPaid.toLocaleString('en-IN')}</p>
                    </div>
                </div>

                <div className='bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0'>
                        <Receipt className='w-6 h-6' />
                    </div>
                    <div>
                        <p className='text-xs text-slate-500 font-medium'>Payment Receipts</p>
                        <p className='text-xl font-bold text-purple-600'>{records.filter((r) => r.status === 'Paid').length} Issued</p>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={handleClearFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <select
                        name=''
                        id=''
                        className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs sm:max-w-full'
                    >
                        <option value=''>From Beginning</option>
                    </select>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>
                            Search
                        </label>
                        <input
                            type='text'
                            id='search'
                            value={searchTerm}
                            placeholder='Search by route, bus, or invoice...'
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class' className='text-base font-medium text-[#808080]'>
                            Status
                        </label>
                        <select
                            id='class'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            <option value='Paid'>Paid</option>
                            <option value='Pending'>Pending</option>
                            <option value='Partially Paid'>Partially Paid</option>
                            <option value='Not Paid'>Not Paid</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>
                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Transport Fees Payment List</h2>
                </div>
                <div className='flex gap-x-2 items-center my-2'>
                    <select
                        name=''
                        id=''
                        className='px-2 py-1.5 bg-white text-[#515DEF] border border-[#515DEF] rounded-md'
                    >
                        <option value='10'>10</option>
                        <option value='20'>20</option>
                        <option value='30'>30</option>
                        <option value='40'>40</option>
                        <option value='50'>50</option>
                    </select>
                    <span className='text-sm font-normal text-[#515DEF]'>Entries Per Page</span>
                </div>
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>
                                    Route Name
                                </th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Vehicle Number</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Transport Fee</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Due Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Payment Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Payment Method</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg text-center'>
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className='p-8 text-center text-sm text-slate-500'>
                                        {live && !liveLoaded
                                            ? 'Loading transport invoices…'
                                            : 'No transport invoices found for your account.'}
                                    </td>
                                </tr>
                            ) : null}
                            {filteredRecords.map((row) => (
                                <tr
                                    key={row.id}
                                    className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'
                                >
                                    <td className='px-2 py-4 rounded-s-lg font-medium text-slate-800'>
                                        {row.routeName}
                                        <div className='text-xs text-slate-400'>{row.invoiceNumber}</div>
                                    </td>
                                    <td className='px-2 py-4'>{row.vehicleNumber}</td>
                                    <td className='px-2 py-4 font-semibold text-slate-900'>
                                        ₹{row.transportFee?.toLocaleString('en-IN')}
                                        {row.balanceAmount > 0 && (
                                            <div className='text-xs text-rose-500 font-normal'>
                                                Due: ₹{row.balanceAmount?.toLocaleString('en-IN')}
                                            </div>
                                        )}
                                    </td>
                                    <td className='px-2 py-4'>{row.dueDate}</td>
                                    <td className='px-2 py-4'>
                                        <span
                                            className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                                                badgeColor[row.status] || 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className='px-2 py-4'>{row.paymentMethod}</td>
                                    <td className='px-2 py-4 rounded-e-lg text-center'>
                                        {row.status === 'Paid' ? (
                                            <button
                                                type='button'
                                                onClick={() => setViewReceiptItem(row)}
                                                className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition cursor-pointer'
                                            >
                                                Receipt
                                            </button>
                                        ) : (
                                            <button
                                                type='button'
                                                onClick={() => handleOpenPayModal(row)}
                                                className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#515DEF] text-white hover:opacity-90 transition cursor-pointer shadow-sm'
                                            >
                                                Pay Now
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    Showing 1 to {filteredRecords.length} of {records.length} entries
                </p>

                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] hover:bg-[#515DEF] hover:text-white border border-[#E2E8F0] rounded-full cursor-pointer'
                    >
                        1
                    </button>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {payModalItem && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in'>
                    <div className='relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6 space-y-4'>
                        <div className='flex items-center justify-between border-b pb-3'>
                            <h3 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                                <CreditCard className='w-5 h-5 text-indigo-600' />
                                Pay Transport Fee
                            </h3>
                            <button
                                type='button'
                                onClick={() => setPayModalItem(null)}
                                className='text-slate-400 hover:text-slate-600'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        <div className='bg-slate-50 p-4 rounded-xl space-y-2 text-sm'>
                            <div className='flex justify-between text-slate-600'>
                                <span>Route:</span>
                                <span className='font-semibold text-slate-800 truncate max-w-[200px]'>
                                    {payModalItem.routeName}
                                </span>
                            </div>
                            <div className='flex justify-between text-slate-600'>
                                <span>Vehicle:</span>
                                <span className='font-semibold text-slate-800'>{payModalItem.vehicleNumber}</span>
                            </div>
                            <div className='flex justify-between text-slate-600 border-t pt-2'>
                                <span>Amount Due:</span>
                                <span className='font-bold text-rose-600 text-base'>
                                    ₹{payModalItem.balanceAmount?.toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
                                Payment Method
                            </label>
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                {['UPI', 'Net Banking', 'Credit Card', 'Debit Card'].map((method) => (
                                    <button
                                        type='button'
                                        key={method}
                                        onClick={() => setSelectedMethod(method)}
                                        className={`p-2.5 rounded-lg border font-medium transition cursor-pointer text-center ${
                                            selectedMethod === method
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className='flex gap-3 pt-2'>
                            <button
                                type='button'
                                onClick={() => setPayModalItem(null)}
                                className='flex-1 px-4 py-2.5 text-sm font-medium border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer'
                            >
                                Cancel
                            </button>
                            <button
                                type='button'
                                disabled={isProcessing}
                                onClick={handleConfirmPayment}
                                className='flex-1 px-4 py-2.5 text-sm font-medium bg-[#515DEF] text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition cursor-pointer'
                            >
                                {isProcessing ? 'Processing...' : 'Confirm & Pay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Receipt Modal */}
            {viewReceiptItem && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in'>
                    <div className='relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 border border-slate-200'>
                        <div className='flex items-center justify-between border-b pb-3'>
                            <h3 className='text-lg font-bold text-slate-800 flex items-center gap-2'>
                                <Receipt className='w-5 h-5 text-emerald-600' />
                                Transport Payment Receipt
                            </h3>
                            <button
                                type='button'
                                onClick={() => setViewReceiptItem(null)}
                                className='text-slate-400 hover:text-slate-600'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        <div className='p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center space-y-1'>
                            <p className='text-xs font-semibold text-emerald-800 uppercase tracking-wider'>
                                Payment Cleared
                            </p>
                            <p className='text-2xl font-bold text-emerald-700'>
                                ₹{viewReceiptItem.paidAmount?.toLocaleString('en-IN')}
                            </p>
                            <p className='text-xs text-slate-500'>Receipt: {viewReceiptItem.receiptNumber}</p>
                        </div>

                        <div className='space-y-2 text-xs text-slate-600 border-t pt-3'>
                            <div className='flex justify-between'>
                                <span>Route:</span>
                                <span className='font-medium text-slate-800'>{viewReceiptItem.routeName}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span>Vehicle:</span>
                                <span className='font-medium text-slate-800'>{viewReceiptItem.vehicleNumber}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span>Payment Mode:</span>
                                <span className='font-medium text-slate-800'>{viewReceiptItem.paymentMethod}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span>Status:</span>
                                <span className='font-semibold text-emerald-600'>{viewReceiptItem.status}</span>
                            </div>
                        </div>

                        <div className='flex gap-3 pt-2'>
                            <button
                                type='button'
                                onClick={() => {
                                    toast.success(`Receipt ${viewReceiptItem.receiptNumber} download initiated`)
                                    setViewReceiptItem(null)
                                }}
                                className='w-full px-4 py-2.5 text-sm font-medium bg-[#515DEF] text-white rounded-xl hover:opacity-90 transition cursor-pointer'
                            >
                                Download Receipt PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

export default TransportPayment
