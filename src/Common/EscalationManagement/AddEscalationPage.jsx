import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import EscalationForm from './Components/EscalationForm'
import { createEscalation, emptyEscalationForm } from './escalationData'
import { getRoleConfig } from './escalationRoleConfig'
import {
    getEscalationRecipientById,
    getEscalationRecipientSelectOptions,
} from './escalationUsersData'
import { useEscalationContext } from './useEscalationContext'
import IntegrationNotice from '../ui/IntegrationNotice'
import PageHeader from '../ui/PageHeader'
import Surface from '../ui/Surface'
import UnavailableWorkflowPage from '../ui/UnavailableWorkflowPage'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    createEscalation as createEscalationApi,
    listEscalationRecipients,
} from '../../services/api/escalationApiService'

const AddEscalationPage = ({ roleKey }) => {
    const live = isLiveApiEnabled()
    const navigate = useNavigate()
    const location = useLocation()
    const { pathname } = location
    const effectiveRoleKey = roleKey || (pathname.startsWith('/parent') ? 'parent' : (pathname.startsWith('/student') ? 'student' : null))
    const roleConfig = getRoleConfig(effectiveRoleKey || roleKey)
    const { currentUser } = useEscalationContext(effectiveRoleKey || roleKey)

    const [liveRecipientOptions, setLiveRecipientOptions] = useState([])
    const [recipientsLoading, setRecipientsLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)

    const defaultRecipientId = useMemo(
        () => getEscalationRecipientSelectOptions(roleConfig?.escalatesToRoleKey)?.[0]?.value || '',
        [roleConfig?.escalatesToRoleKey],
    )

    const [form, setForm] = useState(() => emptyEscalationForm(live ? '' : defaultRecipientId))

    useEffect(() => {
        if (!live) {
            setRecipientsLoading(false)
            return undefined
        }
        let cancelled = false
        ;(async () => {
            setRecipientsLoading(true)
            const res = await listEscalationRecipients()
            if (cancelled) return
            setRecipientsLoading(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not load escalation recipients.')
                setLiveRecipientOptions([])
                return
            }
            const options = (res.data || []).map((row) => ({
                value: row.id,
                label: row.email || row.name || row.id,
                subLabel: row.role || roleConfig?.escalatesTo || '',
            }))
            setLiveRecipientOptions(options)
            setForm((prev) => ({
                ...prev,
                recipientUserId: prev.recipientUserId || options[0]?.value || '',
            }))
        })()
        return () => { cancelled = true }
    }, [live, roleConfig?.escalatesTo])

    if (!roleConfig?.escalatesToRoleKey) {
        return <UnavailableWorkflowPage title='Escalation creation is unavailable' description='This role does not have a configured escalation destination.' alternateHref={roleConfig?.routeBase} alternateLabel='Open escalations' />
    }

    const handleSubmit = async (e) => {
        if (e) e.preventDefault()
        if (!form.description.trim()) {
            toast.error('Description is required.')
            return
        }

        if (live) {
            if (!form.recipientUserId) {
                toast.error(`Please select a ${roleConfig.escalatesTo.toLowerCase()} recipient.`)
                return
            }
            setSaving(true)
            const res = await createEscalationApi({
                description: form.description.trim(),
                fullDescription: (form.fullDescription || form.description).trim(),
                remarks: form.remarks?.trim() || null,
                recipientUserId: form.recipientUserId,
            })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Unable to create escalation on the server.')
                return
            }
            const recipientLabel =
                liveRecipientOptions.find((option) => option.value === form.recipientUserId)?.label ||
                roleConfig.escalatesTo
            toast.success(`Escalation routed to ${roleConfig.escalatesTo} · ${recipientLabel}.`)
            navigate(roleConfig.routeBase)
            return
        }

        const recipientUser = getEscalationRecipientById(
            roleConfig.escalatesToRoleKey,
            form.recipientUserId,
        )

        if (!recipientUser) {
            toast.error(`Please select a ${roleConfig.escalatesTo.toLowerCase()} recipient.`)
            return
        }

        const result = createEscalation(effectiveRoleKey || roleKey, form, roleConfig, currentUser, recipientUser)
        if (!result.success) {
            toast.error(result.message)
            return
        }

        toast.success(`Escalation routed to ${roleConfig.escalatesTo} · ${recipientUser.name}.`)
        navigate(roleConfig.routeBase)
    }

    return (
        <form onSubmit={handleSubmit} noValidate className='space-y-5'>
            <PageHeader title='Raise escalation' description={`Route an issue through ${roleConfig.hierarchyLabel}.`} />
            <IntegrationNotice
                state={live ? 'connected' : 'mock'}
                title={live ? 'Live escalation create' : 'Browser mock escalation'}
                description={live
                    ? 'POST /api/v1/escalations with recipientUserId. Recipients come from /api/v1/escalations/recipients.'
                    : 'Live API is off. This escalation is stored only in this browser.'}
            />
            <Surface title='Escalation information' description='Choose the responsible recipient and provide enough context for a 24-hour response.' contentClassName='p-4 sm:p-5'>
                <EscalationForm
                    form={form}
                    onChange={setForm}
                    roleConfig={roleConfig}
                    recipientOptions={live ? liveRecipientOptions : undefined}
                    recipientsLoading={recipientsLoading}
                />
            </Surface>

            <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                <button
                    type='button'
                    onClick={() => navigate(roleConfig.routeBase)}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Cancel
                </button>
                <button
                    type='submit'
                    disabled={saving || (live && recipientsLoading)}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-50'
                >
                    {saving ? 'Raising…' : 'Raise escalation'}
                </button>
            </div>
        </form>
    )
}

export default AddEscalationPage
