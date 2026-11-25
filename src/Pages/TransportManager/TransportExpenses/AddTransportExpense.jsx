import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { upsertTransportExpense } from '../../../services/api/transportApiService'
import FuelExpenseForm from './Components/FuelExpenseForm'
import ServiceExpenseForm from './Components/ServiceExpenseForm'
import OtherExpenseForm from './Components/OtherExpenseForm'

const ADD_CONFIG = {
    fuel: {
        title: 'Fuel Management',
        Form: FuelExpenseForm,
        category: 'fuel',
    },
    service: {
        title: 'Service Expense Information',
        Form: ServiceExpenseForm,
        category: 'service',
    },
    other: {
        title: 'Other Expense Information',
        Form: OtherExpenseForm,
        category: 'other',
    },
}

const AddTransportExpense = () => {
    const { type } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [saving, setSaving] = useState(false)
    const config = ADD_CONFIG[type]
    const FormComponent = config?.Form

    const handleSave = async () => {
        if (!config) return
        if (!live) {
            toast.success('Transport expense saved successfully (browser demo).')
            navigate('/transport-manager/transport-expenses')
            return
        }
        setSaving(true)
        const res = await upsertTransportExpense({
            category: config.category,
            expenseDate: new Date().toLocaleDateString('en-GB'),
            amount: 0,
            paymentMode: 'UPI',
            remarks: `Created from TM add/${config.category}`,
            status: 'Recorded',
        })
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Expense create failed on server.')
            return
        }
        toast.success('Expense row persisted on the server (category shell). Detail form fields remain UI-only until fully controlled.')
        navigate('/transport-manager/transport-expenses')
    }

    return (
        <section>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live expense create (PARTIAL form capture)'
                    description='Save writes a category row to PUT /api/v1/ops/transport-expenses after confirmation. Uncontrolled detail form widgets are not yet fully mapped field-by-field.'
                    className='mb-4'
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Demo expense create'
                    description='Enable live API to persist expenses on FastAPI ops.'
                    className='mb-4'
                />
            )}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                {!config ? (
                    <p className='text-[#667085] text-center py-8'>Invalid expense type.</p>
                ) : (
                    <>
                        <h2 className='text-xl font-semibold text-black'>{config.title}</h2>
                        <FormComponent />
                    </>
                )}
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/transport-expenses')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                {config && (
                    <button
                        type='button'
                        disabled={saving}
                        onClick={handleSave}
                        className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-50'
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                )}
            </div>
        </section>
    )
}

export default AddTransportExpense
