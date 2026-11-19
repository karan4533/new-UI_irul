import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import AdmissionEnquiryInfo from './Components/AdmissionEnquiryInfo'
import { FeedbackState } from '../../../../Common/ui'
import {
    getAdmissionEnquiryById,
    getAddAdmissionPath,
    getEnquiryRouteBase,
    isAdminFrontOfficePath,
    toFormState,
    updateAdmissionEnquiryStatus,
} from './admissionEnquiryData'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import {
    convertAdmissionEnquiry,
    getAdmissionEnquiry,
    updateAdmissionEnquiry,
} from '../../../../services/api/admissionsApiService'

const ViewAdmissionEnquiry = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const routeBase = getEnquiryRouteBase(pathname)
    const isAdminView = isAdminFrontOfficePath(pathname)
    const live = isLiveApiEnabled()
    const [record, setRecord] = useState(() => (live ? null : getAdmissionEnquiryById(id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await getAdmissionEnquiry(id)
        setLoading(false)
        if (!res.success || !res.data) {
            setRecord(null)
            setError(typeof res.error === 'string' ? res.error : 'Enquiry not found on the server.')
            return
        }
        setRecord(res.data)
    }, [id])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRecord(getAdmissionEnquiryById(id))
            setLoading(false)
            return
        }
        loadLive()
    }, [id, loadLive])

    const form = useMemo(() => (record ? toFormState(record) : null), [record])

    const handleMarkSuccess = async () => {
        if (!record) return
        if (!isLiveApiEnabled()) {
            updateAdmissionEnquiryStatus(record.id, 'Success')
            toast.success('Enquiry marked as Success.')
            navigate(routeBase)
            return
        }
        setBusy(true)
        const res = await updateAdmissionEnquiry(record.id, { ...record, status: 'Success' })
        setBusy(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not update enquiry status.')
            return
        }
        toast.success('Enquiry marked as Success on the server.')
        navigate(routeBase)
    }

    const handleConvert = async () => {
        if (!record) return
        if (!isLiveApiEnabled()) {
            updateAdmissionEnquiryStatus(record.id, 'Success')
            toast.success('Enquiry converted. Continue on the admission form.')
            navigate(getAddAdmissionPath(pathname), {
                state: { fromEnquiryId: record.id, enquiry: record },
            })
            return
        }
        setBusy(true)
        const res = await convertAdmissionEnquiry(record.id)
        setBusy(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not convert enquiry.')
            return
        }
        toast.success('Enquiry converted to admission on the server.')
        navigate(
            pathname.startsWith('/front-office')
                ? '/front-office/admission-list'
                : '/admin/front-office/admission-list',
            { state: { convertedAdmission: res.data } },
        )
    }

    if (loading) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-8'>
                <FeedbackState kind='loading' title='Loading enquiry' description='Fetching from the admissions API…' />
            </section>
        )
    }

    if (!record || !form) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-8 text-center'>
                <h2 className='text-xl font-semibold text-[#0C1E5B]'>Enquiry not found</h2>
                {error ? <p className='text-sm text-[#667085] mt-2'>{error}</p> : null}
                <NavLink to={routeBase} className='inline-block mt-4 text-[#515DEF] hover:underline'>
                    Back to Admission Enquiry List
                </NavLink>
            </section>
        )
    }

    return (
        <section className='space-y-6'>
            <button
                type='button'
                onClick={() => navigate(routeBase)}
                className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
            >
                <ArrowLeft size={18} />
                Back to list
            </button>

            {live ? (
                <p className='text-xs font-medium text-[#027A48]'>
                    Live enquiry · GET /api/v1/admissions/enquiries/{'{id}'}
                </p>
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3 mb-2'>
                    <div>
                        <h2 className='text-xl font-semibold text-black'>Admission Enquiry Details</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            ID: {record.enquiryCode || record.id} · Status: {record.status}
                            {record.convertedAdmissionId
                                ? ` · Converted admission: ${record.convertedAdmissionId}`
                                : ''}
                        </p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {record.status !== 'Success' && !isAdminView ? (
                            <button
                                type='button'
                                disabled={busy}
                                onClick={handleMarkSuccess}
                                className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 cursor-pointer disabled:opacity-60'
                            >
                                Mark as Success
                            </button>
                        ) : null}
                        {!record.convertedAdmissionId ? (
                            <button
                                type='button'
                                disabled={busy}
                                onClick={handleConvert}
                                className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white cursor-pointer disabled:opacity-60'
                            >
                                Convert to Admission
                            </button>
                        ) : null}
                        <NavLink
                            to={`${routeBase}/edit/${record.id}`}
                            className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white'
                        >
                            Edit
                        </NavLink>
                    </div>
                </div>
                <AdmissionEnquiryInfo form={form} readOnly />
            </div>
        </section>
    )
}

export default ViewAdmissionEnquiry
