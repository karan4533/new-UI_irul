import LibrarianRoutes from '../Routes/LibrarianRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const LibrarianLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='librarian'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Librarian workspace'
                    description='LIVE: catalog, members, issue/return, dashboard KPIs (/api/v1/ops/library-*). MOCK: book requisitions, SMS reminders. Announcements read-only. No students directory, finance, or admin-user access.'
                />
            ) : null}
            <LibrarianRoutes />
        </AppShell>
    )
}

export default LibrarianLayout
