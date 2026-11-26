import React from 'react'
import { Route } from 'react-router-dom'
import TcRequestApprovalList from '../Pages/Admin/TcRequest/TcRequestApprovalList'
import ViewTcRequestApproval from '../Pages/Admin/TcRequest/ViewTcRequestApproval'

/**
 * Mount the live TC list/detail workspace under any role base path.
 * Backend permissions still enforce stage/NOC/decide actions.
 */
export function TcRequestRoleRoutes({ basePath }) {
    const root = String(basePath || '').replace(/\/$/, '')
    if (!root) return null
    return (
        <>
            <Route path={`${root}/tc-request`} element={<TcRequestApprovalList basePath={`${root}/tc-request`} />} />
            <Route
                path={`${root}/tc-request/view/:id`}
                element={<ViewTcRequestApproval basePath={`${root}/tc-request`} />}
            />
        </>
    )
}
