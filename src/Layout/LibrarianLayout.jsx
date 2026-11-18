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
                    description='Library catalog, members, issue and return use FastAPI /api/v1/ops/library-* collections. Announcements are read-only. No students directory, finance, or admin-user access.'
                />
            ) : null}
            <LibrarianRoutes />
        </AppShell>
    )
}

export default LibrarianLayout
