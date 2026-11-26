import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { DataTable, DataToolbar, IntegrationNotice, StatusBadge } from '../../../../Common/ui'
import { FEE_FREQUENCIES } from '../../financeDomain/financeConstants'
import { formatCurrency } from '../../financeDomain/financeHelpers'
import { useFinance } from '../../financeDomain/FinanceContext'
import {
    listFeeStructuresApi,
    upsertFeeStructureApi,
} from '../../../../services/api/feeStructureApiService.js'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore.js'
import { ACADEMIC_YEARS, GRADES } from '../feesManagementData'

const FeeStructureLiveTab = ({ onRequestDefine }) => {
    const { rehydrateFromApi } = useFinance()
    const [structures, setStructures] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [academicYear, setAcademicYear] = useState('All years')
    const [grade, setGrade] = useState(GRADES[0])

    const refresh = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setError('Live API is disabled.')
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await listFeeStructuresApi()
        if (!res.success) {
            setError(res.error || 'Could not load fee structures.')
            setStructures([])
            setCategories([])
            setLoading(false)
            return res
        }
        setStructures(res.data.structures || [])
        setCategories(res.data.categories || [])
        setLoading(false)
        return res
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const categoryName = useCallback(
        (id) => categories.find((item) => item.id === id)?.name ?? id,
        [categories],
    )
    const frequencyLabel = (id) => FEE_FREQUENCIES.find((item) => item.id === id)?.label ?? id

    const filteredRows = useMemo(() => structures.filter((row) => {
        if (academicYear !== 'All years' && row.academicYear !== academicYear) return false
        if (grade !== GRADES[0] && row.className !== grade) return false
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return true
        return [row.academicYear, row.className, categoryName(row.feeCategoryId), row.feeHead, row.status]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery)
    }), [academicYear, categoryName, grade, query, structures])

    const yearOptions = useMemo(() => {
        const years = new Set(structures.map((row) => row.academicYear).filter(Boolean))
        ACADEMIC_YEARS.forEach((year) => years.add(year))
        return ['All years', ...Array.from(years)]
    }, [structures])

    const columns = [
        { key: 'academicYear', label: 'Academic year' },
        { key: 'className', label: 'Class', required: true },
        { key: 'category', label: 'Category', render: (row) => categoryName(row.feeCategoryId) },
        { key: 'feeHead', label: 'Fee head' },
        { key: 'frequency', label: 'Frequency', render: (row) => frequencyLabel(row.frequency) },
        {
            key: 'amount',
            label: 'Amount',
            render: (row) => <span className='font-semibold text-[var(--erp-ink)]'>{formatCurrency(row.amount)}</span>,
        },
        { key: 'dueDayOfMonth', label: 'Due day', render: (row) => row.dueDayOfMonth || 'Not set' },
        { key: 'mandatory', label: 'Requirement', render: (row) => (row.mandatory ? 'Mandatory' : 'Optional') },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ]

    const liveCount = structures.length
    const categoryCount = categories.length

    return (
        <div className='space-y-5'>
            {error ? (
                <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3'>
                    <span>{error}</span>
                    <button type='button' onClick={refresh} className='underline cursor-pointer'>Retry</button>
                </div>
            ) : null}
            {loading ? <p className='text-sm text-[var(--erp-muted)]'>Loading fee structures from campus finance…</p> : null}

            <div className='grid gap-4 lg:grid-cols-2'>
                <IntegrationNotice
                    state='connected'
                    title='Live fee structure register'
                    description='Structures persist on the campus finance snapshot (PostgreSQL). Define new heads with the form — they save through the live upsert API.'
                />
                <section className='rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white p-4 sm:p-5'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h3 className='text-base font-semibold text-[var(--erp-ink)]'>Live setup summary</h3>
                            <p className='mt-1 text-xs text-[var(--erp-muted)]'>Campus finance snapshot</p>
                        </div>
                        <StatusBadge status='Connected' />
                    </div>
                    <dl className='mt-4 grid grid-cols-2 gap-3'>
                        <div className='rounded-lg bg-[var(--erp-canvas)] p-3'>
                            <dt className='text-xs text-[var(--erp-muted)]'>Structures</dt>
                            <dd className='mt-1 text-lg font-semibold text-[var(--erp-ink)]'>{liveCount}</dd>
                        </div>
                        <div className='rounded-lg bg-[var(--erp-canvas)] p-3'>
                            <dt className='text-xs text-[var(--erp-muted)]'>Categories</dt>
                            <dd className='mt-1 text-lg font-semibold text-[var(--erp-ink)]'>{categoryCount}</dd>
                        </div>
                    </dl>
                    <div className='mt-3 flex gap-3'>
                        <button type='button' onClick={refresh} className='text-sm text-[var(--erp-indigo)] cursor-pointer' disabled={loading}>
                            Refresh
                        </button>
                        {typeof onRequestDefine === 'function' ? (
                            <button type='button' onClick={onRequestDefine} className='text-sm text-[var(--erp-indigo)] cursor-pointer'>
                                Define structure
                            </button>
                        ) : null}
                    </div>
                </section>
            </div>

            <section className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <div className='px-4 pt-4 sm:px-5'>
                    <h3 className='text-base font-semibold text-[var(--erp-ink)]'>Configured fee structures</h3>
                </div>
                <DataToolbar
                    query={query}
                    onQueryChange={setQuery}
                    searchLabel='Search fee structures'
                    searchPlaceholder='Class, category, fee head or status…'
                    resultCount={filteredRows.length}
                    onReset={() => {
                        setQuery('')
                        setAcademicYear('All years')
                        setGrade(GRADES[0])
                    }}
                    filters={(
                        <>
                            <label className='grid gap-1 text-xs font-semibold text-[var(--erp-slate)]'>Academic year
                                <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    {yearOptions.map((year) => <option key={year}>{year}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-semibold text-[var(--erp-slate)]'>Grade
                                <select value={grade} onChange={(event) => setGrade(event.target.value)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    {GRADES.map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                />
                <DataTable
                    caption='Configured fee structures'
                    rows={filteredRows}
                    columns={columns}
                    rowKey='id'
                    emptyTitle={loading ? 'Loading…' : 'No fee structures found'}
                    emptyDescription='Define a fee structure to persist it on the campus ledger.'
                />
            </section>
        </div>
    )
}

export async function saveFeeStructureLive(payload, { rehydrateFromApi } = {}) {
    const res = await upsertFeeStructureApi(payload)
    if (!res.success) {
        toast.error(res.error || 'Could not save fee structure.')
        return res
    }
    toast.success('Fee structure saved to campus ledger.')
    if (typeof rehydrateFromApi === 'function') await rehydrateFromApi()
    return res
}

export default FeeStructureLiveTab
