import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const REQUIRED = ['LIVE', 'PARTIAL', 'MOCK', 'LOCAL ONLY', 'UNAVAILABLE']

test('DataSourceIndicator defines all required status variants', () => {
    const source = fs.readFileSync(path.resolve('src/Common/ui/DataSourceIndicator.jsx'), 'utf-8')
    for (const status of REQUIRED) {
        assert.ok(source.includes(`'${status}'`) || source.includes(`"${status}"`), `missing variant ${status}`)
    }
    assert.ok(source.includes('export default function DataSourceIndicator'))
    assert.ok(source.includes('DATA_SOURCE_VARIANTS'))
})

test('enterprise SA workspaces mount DataSourceIndicator (static source check)', () => {
    const root = path.resolve('src')
    const files = [
        'Common/DepartmentTicketing/DepartmentTicketingWorkspace.jsx',
        'Common/StoresProcurement/StoresProcurementWorkspace.jsx',
        'Common/FileRoom/FileRoomWorkspace.jsx',
        'Common/LostAndFound/LostAndFoundWorkspace.jsx',
        'Common/EmployeeActivityMonitoring/DepartmentActivityMonitoringWorkspace.jsx',
        'Common/Recognition/EnterpriseRecognitionPage.jsx',
        'Common/Visitors/VisitorsWorkspace.jsx',
        'Pages/SuperAdmin/ActivityLogs/ActivityLogList.jsx',
        'Pages/SuperAdmin/AuditReports/AuditReportsOverview.jsx',
        'Pages/SuperAdmin/AuditReports/AuditReportsSectionList.jsx',
    ]
    for (const rel of files) {
        const source = fs.readFileSync(path.join(root, rel), 'utf-8')
        assert.ok(source.includes('DataSourceIndicator'), `${rel} must render DataSourceIndicator`)
    }
})

test('VisitorsWorkspace uses LIVE ops gate-visitors path when live API enabled', () => {
    const source = fs.readFileSync(path.resolve('src/Common/Visitors/VisitorsWorkspace.jsx'), 'utf-8')
    assert.ok(source.includes('listGateVisitors'))
    assert.ok(source.includes('upsertGateVisitor'))
    assert.ok(source.includes("status='LIVE'"))
    assert.ok(source.includes('/api/v1/ops/gate-visitors') || source.includes('gate-visitors'))
})
