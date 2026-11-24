import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { ROLES, useAuth } from './AuthContext'
import { getParentByEmail } from '../Pages/Parent/parentData'
import {
    getMappedStudentsForParent,
    getStudentProfileById,
    isStudentMappedToParent,
} from '../Pages/Parent/parentStudentMappingData'
import { isLiveApiEnabled } from '../services/api/tokenStore'
import { listMyChildren } from '../services/api/studentApiService'

const STORAGE_PREFIX = 'schoolerp_parent_active_child'

const ParentChildContext = createContext(null)

const readStoredChildId = (parentKey) => {
    try {
        return sessionStorage.getItem(`${STORAGE_PREFIX}_${parentKey}`)
    } catch {
        return null
    }
}

const writeStoredChildId = (parentKey, studentId) => {
    try {
        if (studentId) {
            sessionStorage.setItem(`${STORAGE_PREFIX}_${parentKey}`, studentId)
        } else {
            sessionStorage.removeItem(`${STORAGE_PREFIX}_${parentKey}`)
        }
    } catch {
        /* ignore */
    }
}

const mapLiveChild = (row) => ({
    id: row.id,
    uuid: row.id,
    backendId: row.id,
    name: row.name || '',
    className: row.className || '',
    section: row.section || '',
    classSection: row.classSection || '',
    rollNumber: row.rollNumber ?? '',
    admissionNumber: row.admissionNumber || '',
    placementStatus: row.placementStatus || '',
    grade: row.grade ?? null,
    source: 'backend',
})

export const ParentChildProvider = ({ children }) => {
    const { role, email } = useAuth()
    const live = isLiveApiEnabled()
    const parentAccount = useMemo(() => {
        if (role !== ROLES.PARENT || !email) return null
        return getParentByEmail(email)
    }, [role, email])

    const parentStorageKey = parentAccount?.id || email || 'parent'

    const [activeStudentId, setActiveStudentId] = useState(null)
    const [initialized, setInitialized] = useState(false)
    const [liveChildren, setLiveChildren] = useState([])
    const [liveIdentityError, setLiveIdentityError] = useState('')
    const [liveIdentityReady, setLiveIdentityReady] = useState(!live)

    const seedChildren = useMemo(
        () => (parentAccount ? getMappedStudentsForParent(parentAccount.id) : []),
        [parentAccount],
    )

    useEffect(() => {
        if (role !== ROLES.PARENT || !live) {
            setLiveChildren([])
            setLiveIdentityError('')
            setLiveIdentityReady(true)
            return undefined
        }
        let cancelled = false
        setLiveIdentityReady(false)
        ;(async () => {
            const res = await listMyChildren()
            if (cancelled) return
            if (res.success && Array.isArray(res.data)) {
                setLiveChildren(res.data.map(mapLiveChild))
                setLiveIdentityError('')
            } else {
                setLiveChildren([])
                setLiveIdentityError(
                    typeof res.error === 'string'
                        ? res.error
                        : 'Could not load linked children from GET /api/v1/parents/me/children.',
                )
            }
            setLiveIdentityReady(true)
        })()
        return () => {
            cancelled = true
        }
    }, [role, email, live])

    const mappedChildren = live && liveIdentityReady ? liveChildren : seedChildren

    useEffect(() => {
        if (role !== ROLES.PARENT) {
            setActiveStudentId(null)
            setInitialized(true)
            return
        }

        if (live && !liveIdentityReady) {
            setInitialized(false)
            return
        }

        if (!live && !parentAccount) {
            setActiveStudentId(null)
            setInitialized(true)
            return
        }

        const allowedIds = new Set(mappedChildren.map((row) => String(row.id)))
        const storedId = readStoredChildId(parentStorageKey)
        if (storedId && allowedIds.has(String(storedId))) {
            setActiveStudentId(storedId)
        } else if (mappedChildren.length === 1) {
            setActiveStudentId(mappedChildren[0].id)
            writeStoredChildId(parentStorageKey, mappedChildren[0].id)
        } else {
            setActiveStudentId(null)
        }

        setInitialized(true)
    }, [role, parentAccount, mappedChildren, live, liveIdentityReady, parentStorageKey])

    const selectChild = useCallback(
        (studentId) => {
            const allowed = mappedChildren.some((row) => String(row.id) === String(studentId))
            if (!allowed) {
                if (!live && parentAccount && isStudentMappedToParent(parentAccount.id, studentId)) {
                    setActiveStudentId(studentId)
                    writeStoredChildId(parentStorageKey, studentId)
                    return true
                }
                return false
            }
            setActiveStudentId(studentId)
            writeStoredChildId(parentStorageKey, studentId)
            return true
        },
        [mappedChildren, live, parentAccount, parentStorageKey],
    )

    const clearActiveChild = useCallback(() => {
        setActiveStudentId(null)
        writeStoredChildId(parentStorageKey, null)
    }, [parentStorageKey])

    const activeStudent = useMemo(() => {
        if (!activeStudentId) return null
        if (live) {
            return mappedChildren.find((row) => String(row.id) === String(activeStudentId)) || null
        }
        return getStudentProfileById(activeStudentId)
    }, [activeStudentId, live, mappedChildren])

    const value = useMemo(
        () => ({
            parentAccount,
            mappedChildren,
            activeStudentId,
            activeStudent,
            selectChild,
            clearActiveChild,
            initialized,
            hasMultipleChildren: mappedChildren.length > 1,
            liveIdentityError,
            identitySource: live ? (liveIdentityError ? 'error' : 'backend') : 'local',
        }),
        [
            parentAccount,
            mappedChildren,
            activeStudentId,
            activeStudent,
            selectChild,
            clearActiveChild,
            initialized,
            liveIdentityError,
            live,
        ],
    )

    return (
        <ParentChildContext.Provider value={value}>
            {children}
        </ParentChildContext.Provider>
    )
}

export const useParentChild = () => {
    const context = useContext(ParentChildContext)
    if (!context) {
        throw new Error('useParentChild must be used within ParentChildProvider')
    }
    return context
}

export const useOptionalParentChild = () => useContext(ParentChildContext)
