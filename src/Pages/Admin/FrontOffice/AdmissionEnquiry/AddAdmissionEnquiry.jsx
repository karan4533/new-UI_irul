import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import AdmissionEnquiryInfo from './Components/AdmissionEnquiryInfo'
import { FeedbackState } from '../../../../Common/ui'
import {
    DEFAULT_ENQUIRY_FORM,
    createAdmissionEnquiry as createLocalEnquiry,
    getAdmissionEnquiryById,
    getEnquiryRouteBase,
    toFormState,
    updateAdmissionEnquiry as updateLocalEnquiry,
} from './admissionEnquiryData'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import {
    createAdmissionEnquiry,
    enquiryFormToApiPayload,
    getAdmissionEnquiry,
    updateAdmissionEnquiry,
} from '../../../../services/api/admissionsApiService'

const AddAdmissionEnquiry = () => {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const { id } = useParams()
    const isEdit = Boolean(id)
    const listPath = getEnquiryRouteBase(pathname)
    const live = isLiveApiEnabled()
    const [form, setForm] = useState({
        ...DEFAULT_ENQUIRY_FORM,
        enquiryDate: new Date(),
        nextFollowUpDate: new Date(),
    })
    const [error, setError] = useState('')
    const [notFound, setNotFound] = useState(false)
    const [loading, setLoading] = useState(Boolean(live && isEdit))
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!isEdit) return

        let cancelled = false
        const load = async () => {
            if (!isLiveApiEnabled()) {
                const record = getAdmissionEnquiryById(id)
                if (!record) {
                    setNotFound(true)
                    return
                }
                setNotFound(false)
                setForm(toFormState(record))
                return
            }

            setLoading(true)
            setError('')
            const res = await getAdmissionEnquiry(id)
            if (cancelled) return
            setLoading(false)
            if (!res.success || !res.data) {
                setNotFound(true)
                setError(typeof res.error === 'string' ? res.error : 'Enquiry not found on the server.')
                return
            }
            setNotFound(false)
            setForm(toFormState(res.data))
        }

        load()
        return () => {
            cancelled = true
        }
    }, [id, isEdit])

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleDiscard = () => {
        navigate(listPath)
    }

    const handleSave = async () => {
        setError('')
        const name = String(form.name || '').trim()
        const mobileNumber = String(form.mobileNumber || '').trim()
        if (!name) {
            setError('Name is required.')
            return
        }
        if (!mobileNumber) {
            setError('Mobile number is required.')
            return
        }
        if (!form.className) {
            setError('Class is required.')
            return
        }

        if (!isLiveApiEnabled()) {
            const result = isEdit ? updateLocalEnquiry(id, form) : createLocalEnquiry(form)
            if (!result.success) {
                setError(result.message)
                return
            }
            toast.success(isEdit ? 'Admission enquiry updated.' : 'Admission enquiry saved successfully.')
            navigate(listPath)
            return
        }

        setSaving(true)
        const payload = enquiryFormToApiPayload(form)
        const res = isEdit
            ? await updateAdmissionEnquiry(id, payload)
            : await createAdmissionEnquiry(payload)
        setSaving(false)

        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Could not save enquiry on the server.')
            return
        }

        toast.success(isEdit ? 'Admission enquiry updated on the server.' : 'Admission enquiry saved on the server.')
        navigate(listPath)
    }

    if (loading) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-8'>
                <FeedbackState kind='loading' title='Loading enquiry' description='Fetching from the admissions API…' />
            </section>
        )
    }

    if (notFound) {
        return (
            <section className='bg-white rounded-2xl shadow-md p-8 text-center'>
                <h2 className='text-xl font-semibold text-[#0C1E5B]'>Enquiry not found</h2>
                {error ? <p className='text-sm text-[#667085] mt-2'>{error}</p> : null}
                <button
                    type='button'
                    onClick={() => navigate(listPath)}
                    className='mt-4 text-[#515DEF] hover:underline cursor-pointer'
                >
                    Back to Admission Enquiry List
                </button>
            </section>
        )
    }

    return (
        <section>
            {live ? (
                <p className='mb-3 text-xs font-medium text-[#027A48]'>
                    Live enquiry {isEdit ? 'update' : 'create'} ·{' '}
                    {isEdit ? 'PATCH' : 'POST'} /api/v1/admissions/enquiries
                </p>
            ) : null}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>
                    {isEdit ? 'Edit Admission Enquiry' : 'Admission Enquiry Information'}
                </h2>
                <p className='text-sm text-[#667085] mt-1'>
                    {isEdit
                        ? 'Update enquiry details and save changes.'
                        : 'New enquiries are saved as Active and appear in the Admission Enquiry list.'}
                </p>
                <AdmissionEnquiryInfo form={form} onChange={updateField} />
            </div>

            {error && <p className='text-sm text-[#F44336] mt-4'>{error}</p>}

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={handleDiscard}
                    disabled={saving}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    onClick={handleSave}
                    disabled={saving}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AddAdmissionEnquiry
