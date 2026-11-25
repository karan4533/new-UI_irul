import React from 'react'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'

/** IntegrationNotice + loading/error FeedbackState for live academics lists. */
const AcademicsLiveNotice = ({ live, loading, error, label, endpoint }) => {
    if (!live) return null
    return (
        <div className='space-y-3 mb-4'>
            <IntegrationNotice
                state={error ? 'failed' : 'connected'}
                title={error ? `${label} API failed` : `${label} are live`}
                description={error || `Loaded from ${endpoint}. No browser mock fallback when live.`}
            />
            {loading ? (
                <FeedbackState compact kind='loading' title={`Loading ${label.toLowerCase()}`} description='Fetching from the academics API…' />
            ) : null}
            {error && !loading ? (
                <FeedbackState compact kind='error' title={`${label} unavailable`} description={error} />
            ) : null}
        </div>
    )
}

export default AcademicsLiveNotice
