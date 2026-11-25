import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { apiClient } from '../../../services/api/apiClient'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import ProfileUpload from './Components/ProfileUpload'

const AddSubjects = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [saving, setSaving] = useState(false)

    const handleSave = async (e) => {
        e.preventDefault()
        if (!code.trim() || !name.trim()) {
            toast.error('Subject code and name are required.')
            return
        }

        if (!live) {
            toast.info('Saved locally is not supported for subjects — enable live API.')
            return
        }

        setSaving(true)
        const res = await apiClient.post(
            '/api/v1/masters/subjects',
            { code: code.trim().toUpperCase(), name: name.trim() },
            { skipMock: true },
        )
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not create subject.')
            return
        }
        toast.success('Subject created.')
        navigate('/admin/class/subjects')
    }

    return (
        <section>
            <form onSubmit={handleSave}>
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <h2 className='text-xl font-semibold text-black'>Subject Information</h2>
                    {live ? (
                        <p className='text-sm text-[#667085] mt-1'>Creates a campus subject via POST /api/v1/masters/subjects.</p>
                    ) : (
                        <p className='text-sm text-[#667085] mt-1'>Enable live API to create subjects on the server.</p>
                    )}

                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:mt-8 mt-2'>
                        <div className='flex flex-col gap-y-2'>
                            <label className='text-base font-medium text-[#1E1E1E]'>Subject Code:</label>
                            <input
                                type='text'
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder='e.g. ENG'
                                maxLength={20}
                                className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                                required
                            />
                        </div>
                        <div className='flex flex-col gap-y-2 md:col-span-2'>
                            <label className='text-base font-medium text-[#1E1E1E]'>Subject Name:</label>
                            <input
                                type='text'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder='e.g. English'
                                className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                                required
                            />
                        </div>
                        {!live ? (
                            <div className='lg:col-span-3 flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#1E1E1E]'>Book Image:</label>
                                <ProfileUpload />
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                    <button
                        type='button'
                        onClick={() => navigate('/admin/class/subjects')}
                        className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full'
                    >
                        Discard Changes
                    </button>
                    <button
                        type='submit'
                        disabled={saving || !live}
                        className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </section>
    )
}

export default AddSubjects
