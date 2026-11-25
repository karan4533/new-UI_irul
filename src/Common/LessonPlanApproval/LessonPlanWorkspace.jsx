import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Download, Plus, RefreshCw } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
    DataTable,
    DataToolbar,
    FeedbackState,
    IntegrationNotice,
    PageHeader,
    Pagination,
    StatusBadge,
} from '../ui'
import { paginateRows, parseTableState, serializeTableState } from '../ui/dataTableState'
import GroupStatusProgress from './Components/GroupStatusProgress'
import {
    APPROVAL_STATUSES,
    buildLessonPlanGroupHref,
    CLASS_OPTIONS,
    filterLessonPlans,
    getApprovedLessonPlansBySubmitter,
    getLessonPlansBySubmitter,
    groupLessonPlansByTeacherSubject,
    SECTION_OPTIONS,
    SUBJECT_OPTIONS,
} from './lessonPlanApprovalData'
import { getLessonPlanWorkspaceConfig } from './lessonPlanWorkspaceConfig'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { listLessonPlans, mapLessonPlanToUi } from '../../services/api/lessonPlanApiService'

const LessonPlanWorkspace = ({ role, mode = 'submitted' }) => {
    const live = isLiveApiEnabled()
    const config = getLessonPlanWorkspaceConfig(role)
    const [urlParams, setUrlParams] = useSearchParams()
    const initialTableState = parseTableState(urlParams)
    const loadLocalPlans = () => (mode === 'approved'
        ? getApprovedLessonPlansBySubmitter(config?.submitterName)
        : getLessonPlansBySubmitter(config?.submitterName))
    const [plans, setPlans] = useState(() => (live ? [] : loadLocalPlans()))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [search, setSearch] = useState(initialTableState.query)
    const [subject, setSubject] = useState(initialTableState.filters.subject || '')
    const [className, setClassName] = useState(initialTableState.filters.className || '')
    const [section, setSection] = useState(initialTableState.filters.section || '')
    const [approvalStatus, setApprovalStatus] = useState(initialTableState.filters.approvalStatus || '')
    const [fromDate, setFromDate] = useState(initialTableState.filters.fromDate || '')
    const [toDate, setToDate] = useState(initialTableState.filters.toDate || '')
    const [page, setPage] = useState(initialTableState.page)
    const [pageSize, setPageSize] = useState(urlParams.has('pageSize') ? initialTableState.pageSize : 5)

    const loadLivePlans = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const res = await listLessonPlans({ mine: true })
        setListLoading(false)
        if (!res.success) {
            setListSource('error')
            setListError(typeof res.error === 'string' ? res.error : 'Failed to load lesson plans.')
            setPlans([])
            return
        }
        const mapped = (Array.isArray(res.data) ? res.data : []).map(mapLessonPlanToUi)
        const scoped = mode === 'approved'
            ? mapped.filter((plan) => plan.approvalStatus === 'Approved' || plan.markAsDone)
            : mapped
        setPlans(scoped)
        setListSource('backend')
    }, [mode])

    useEffect(() => {
        if (!config) return
        if (!isLiveApiEnabled()) {
            setPlans(loadLocalPlans())
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLivePlans()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- localStorage only when not live
    }, [config, loadLivePlans, mode])

    const filteredPlans = useMemo(() => filterLessonPlans(plans, {
        search,
        subject,
        className,
        section,
        approvalStatus: mode === 'submitted' ? approvalStatus : '',
        trackStatus: '',
        submitterRole: '',
        fromDate,
        toDate,
    }), [approvalStatus, className, fromDate, mode, plans, search, section, subject, toDate])
    const groups = useMemo(() => groupLessonPlansByTeacherSubject(filteredPlans), [filteredPlans])
    const pagination = paginateRows(groups, { page, pageSize })

    useEffect(() => {
        setUrlParams(serializeTableState({
            query: search,
            page: pagination.page,
            pageSize,
            filters: {
                subject,
                className,
                section,
                approvalStatus: mode === 'submitted' ? approvalStatus : '',
                fromDate,
                toDate,
            },
        }), { replace: true })
    }, [approvalStatus, className, fromDate, mode, pageSize, pagination.page, search, section, setUrlParams, subject, toDate])

    if (!config) {
        return <FeedbackState kind='permission' title='Lesson-plan workspace unavailable' description='This role cannot author lesson plans.' />
    }

    const counts = {
        total: plans.length,
        pending: plans.filter((plan) => plan.approvalStatus === 'Pending').length,
        approved: plans.filter((plan) => plan.approvalStatus === 'Approved').length,
        rejected: plans.filter((plan) => plan.approvalStatus === 'Rejected').length,
        completed: plans.filter((plan) => plan.markAsDone).length,
    }

    const resetFilters = () => {
        setSearch('')
        setSubject('')
        setClassName('')
        setSection('')
        setApprovalStatus('')
        setFromDate('')
        setToDate('')
        setPage(1)
    }

    const handleRefresh = () => {
        if (isLiveApiEnabled()) {
            loadLivePlans()
            return
        }
        setPlans(loadLocalPlans())
    }

    const columns = [
        {
            key: 'subject',
            label: 'Subject',
            required: true,
            render: (group) => (
                <span>
                    <span className='block font-semibold text-[var(--erp-ink)]'>{group.subject}</span>
                    <span className='block text-xs text-[var(--erp-muted)]'>{group.submitterName}</span>
                </span>
            ),
        },
        { key: 'planCount', label: 'Plans', render: (group) => `${group.planCount} plan${group.planCount === 1 ? '' : 's'}` },
        { key: 'latestSubmittedAt', label: 'Latest submission', render: (group) => group.latestSubmittedAt || 'Not recorded' },
        {
            key: 'status',
            label: mode === 'approved' ? 'Completion' : 'Approval status',
            render: (group) => <GroupStatusProgress group={group} mode={mode === 'approved' ? 'mark-as-done' : 'approval'} />,
        },
    ]

    const title = mode === 'approved' ? 'Approved lesson plans' : 'Lesson-plan submissions'
    const description = mode === 'approved'
        ? 'Use approved plans during delivery and record completion from the plan-group detail.'
        : 'Draft, submit and monitor lesson plans through the academic review workflow.'

    return (
        <section className='space-y-5'>
            <PageHeader
                title={title}
                description={description}
                context={listSource === 'backend'
                    ? `${config.submitterName} · ${counts.total} live plans`
                    : `${config.submitterName} · ${counts.total} browser-stored plans`}
                actions={mode === 'submitted' ? (
                    <NavLink to={config.createRoute} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white'>
                        <Plus aria-hidden='true' size={16} /> Add lesson plan
                    </NavLink>
                ) : null}
            />

            {listSource === 'backend' ? (
                <IntegrationNotice
                    state='connected'
                    title='Live lesson plans'
                    description='Loaded from GET /api/v1/lesson-plans?mine=true. Refresh reloads the API; browser localStorage is not used on this screen.'
                />
            ) : listSource === 'error' ? (
                <IntegrationNotice
                    state='failed'
                    title='Lesson-plan API unavailable'
                    description={listError || 'Could not load lesson plans from the server.'}
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Browser lesson-plan workflow'
                    description='Drafts and decisions are browser-stored demonstration records. Production review must be persisted by the academic API.'
                />
            )}

            <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
                {[
                    ['Total', counts.total, 'info'],
                    ['Pending', counts.pending, 'Pending'],
                    ['Approved', counts.approved, 'Approved'],
                    ['Rejected', counts.rejected, 'Rejected'],
                    ['Completed', counts.completed, 'closed'],
                ].map(([label, value, status]) => (
                    <article key={label} className='rounded-xl border border-[var(--erp-line)] bg-white p-4'>
                        <StatusBadge status={status} label={label} />
                        <p className='mt-2 text-2xl font-semibold text-[var(--erp-ink)]'>{value}</p>
                    </article>
                ))}
            </div>

            {listLoading ? (
                <FeedbackState kind='loading' title='Loading lesson plans' description='Fetching your lesson-plan queue…' />
            ) : null}

            {!listLoading && listSource !== 'error' ? (
            <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataToolbar
                    query={search}
                    onQueryChange={(value) => { setSearch(value); setPage(1) }}
                    searchPlaceholder='Search subject, plan ID, class or description'
                    resultCount={filteredPlans.length}
                    onReset={resetFilters}
                    filters={(
                        <>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Subject
                                <select value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All subjects</option>
                                    {SUBJECT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Class
                                <select value={className} onChange={(event) => { setClassName(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All classes</option>
                                    {CLASS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Section
                                <select value={section} onChange={(event) => { setSection(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All sections</option>
                                    {SECTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                            {mode === 'submitted' && (
                                <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                                    <select value={approvalStatus} onChange={(event) => { setApprovalStatus(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                        <option value=''>All statuses</option>
                                        {APPROVAL_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </label>
                            )}
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>From
                                <input type='date' value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm' />
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>To
                                <input type='date' value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm' />
                            </label>
                        </>
                    )}
                    actions={(
                        <>
                            <button type='button' onClick={handleRefresh} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)]'>
                                <RefreshCw aria-hidden='true' size={16} /> Refresh
                            </button>
                            <button type='button' disabled title='Lesson-plan export API is not connected' className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-65'>
                                <Download aria-hidden='true' size={16} /> Export unavailable
                            </button>
                        </>
                    )}
                />
                <DataTable
                    caption={title}
                    rows={pagination.rows}
                    columns={columns}
                    rowKey='key'
                    emptyTitle={plans.length ? 'No matching lesson plans' : 'No lesson plans yet'}
                    emptyDescription={plans.length ? 'Clear or adjust the filters to see more plan groups.' : 'Create a lesson plan to begin the review workflow.'}
                    renderActions={(group) => (
                        <NavLink
                            to={buildLessonPlanGroupHref(config.routePrefix, group.submitterName, group.subject, mode === 'approved' ? 'mark-as-done' : 'submissions')}
                            className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--erp-line-strong)] px-3 text-xs font-semibold text-[var(--erp-ink)]'
                        >
                            Open group <ArrowUpRight aria-hidden='true' size={14} />
                        </NavLink>
                    )}
                />
                <Pagination {...pagination} pageSizeOptions={[5, 10, 25]} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} />
            </div>
            ) : null}
        </section>
    )
}

export default LessonPlanWorkspace
