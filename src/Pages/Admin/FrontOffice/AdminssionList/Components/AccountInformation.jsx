import React from 'react'

const inputClass = 'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

/**
 * Contact emails for the admission record — not portal credentials.
 * Client rule: no separate parent login; student portal created on Finance payment.
 */
const AccountInformation = ({ form, onChange, isEnrolled = false }) => {
    const update = (key, value) => onChange?.(key, value)

    return (
        <div className='space-y-4 lg:mt-8 mt-2'>
            <div className='rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950'>
                <p className='font-semibold'>No separate parent portal login</p>
                <p className='mt-1'>
                    Store parent / student contact emails here for communication only.
                    Student portal access is created automatically after Finance collects the admission payment.
                    Guardians view the student profile — they do not get a separate login.
                </p>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6'>
                <div className='flex flex-col gap-y-2 lg:col-span-2'>
                    <label htmlFor='parentAccountEmail' className='text-base font-medium text-[#1E1E1E]'>
                        Parent contact email
                    </label>
                    <input
                        id='parentAccountEmail'
                        type='email'
                        value={form.parentAccountEmail || ''}
                        onChange={(e) => update('parentAccountEmail', e.target.value)}
                        readOnly={isEnrolled}
                        className={`${inputClass} ${isEnrolled ? 'bg-[#F5F5F5]' : ''}`}
                        placeholder='parent@example.com'
                        autoComplete='off'
                    />
                </div>
                <div className='flex flex-col gap-y-2 lg:col-span-2'>
                    <label htmlFor='studentAccountEmail' className='text-base font-medium text-[#1E1E1E]'>
                        Student contact email (for portal after payment)
                    </label>
                    <input
                        id='studentAccountEmail'
                        type='email'
                        value={form.studentAccountEmail || ''}
                        onChange={(e) => update('studentAccountEmail', e.target.value)}
                        readOnly={isEnrolled}
                        className={`${inputClass} ${isEnrolled ? 'bg-[#F5F5F5]' : ''}`}
                        placeholder='student@example.com'
                        autoComplete='off'
                    />
                </div>
            </div>
        </div>
    )
}

export default AccountInformation
