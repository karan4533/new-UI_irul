import React from 'react'
import { FeedbackState } from '../../../Common/ui'
import UploadDocuments from './Components/UploadDocuments'

const VehicleDocuments = () => (
    <section className='space-y-6'>
        <FeedbackState
            kind='empty'
            title='BLOCKED — vehicle document upload has no API'
            description='No ops collection or file storage endpoint exists for driver vehicle documents. The form below is UI-only and does not persist on the server.'
        />
        <div className='bg-white rounded-2xl shadow-md p-4 md:p-6 opacity-80'>
            <div className='mb-6'>
                <h2 className='text-xl font-semibold text-[#1E1E1E]'>
                    Documents Upload
                    {' '}
                    <span className='text-sm font-normal text-[#667085]'>
                        — Demonstration form only. Max file Size 2Mb (not saved)
                    </span>
                </h2>
            </div>
            <UploadDocuments />
        </div>
    </section>
)

export default VehicleDocuments
