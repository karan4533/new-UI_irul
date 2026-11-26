export default function LiveStatusBanner({ loading, error, notice, onRetry }) {
    return (
        <>
            {error ? (
                <div role='alert' className='flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                    <span>{error}</span>
                    {onRetry ? <button type='button' onClick={onRetry} className='underline cursor-pointer'>Retry</button> : null}
                </div>
            ) : null}
            {notice ? (
                <div role='status' className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'>{notice}</div>
            ) : null}
            {loading ? <p role='status' className='text-sm text-[var(--erp-muted)]'>Loading from the server…</p> : null}
        </>
    )
}
