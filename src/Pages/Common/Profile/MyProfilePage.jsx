import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    User,
    Briefcase,
    Phone,
    MapPin,
    History,
    FileText,
    CalendarCheck,
    CalendarOff,
    Activity,
    Shield,
    Camera,
    Check,
    Save,
    FileCheck2,
    GraduationCap,
    ArrowRight,
    Download,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '../../../context/AuthContext'
import { ROLE_PREFIX } from '../../../constants/roles'
import { getProfileLabel } from '../../Authentication/profileOptions'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    changeMyPassword,
    getMyProfile,
    updateMyProfile,
} from '../../../services/api/profileApiService'
import { listAuditLogs } from '../../../services/api/auditLogsApiService'
import { listLeaveRequests } from '../../../services/api/leaveApiService'

const TABS = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'professional', label: 'Professional Details', icon: Briefcase },
    { id: 'contact', label: 'Contact Details', icon: Phone },
    { id: 'address', label: 'Address & Residence', icon: MapPin },
    { id: 'employment', label: 'Employment History', icon: History },
    { id: 'documents', label: 'Documents Vault', icon: FileText },
    { id: 'attendance', label: 'Attendance Summary', icon: CalendarCheck },
    { id: 'leave', label: 'Leave Balances', icon: CalendarOff },
    { id: 'activity', label: 'Activity History', icon: Activity },
    { id: 'security', label: 'Security & 2FA', icon: Shield },
]

const emptyPersonal = {
    fullName: '',
    gender: '',
    dob: '',
    bloodGroup: '',
    nationality: '',
    languages: '',
}

const emptyContact = {
    officialEmail: '',
    personalEmail: '',
    phone: '',
    emergencyContact: '',
}

const emptyAddress = {
    permanentAddress: '',
    currentAddress: '',
    street: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
}

function formatJoined(value) {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MyProfilePage = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const { role, name: authName, email } = useAuth()
    const roleLabel = getProfileLabel(role)
    const displayFallback = authName || (roleLabel ?? 'Staff User')

    const isStudentOrParent = role === 'student' || role === 'parent'
    const roleTabs = useMemo(() => {
        if (isStudentOrParent) {
            return [...TABS, { id: 'tc', label: 'Transfer Certificate (TC)', icon: GraduationCap }]
        }
        return [...TABS, { id: 'relieving', label: 'Relieving & NOC Clearance', icon: FileCheck2 }]
    }, [isStudentOrParent])

    const [activeTab, setActiveTab] = useState('personal')
    const [savedSuccess, setSavedSuccess] = useState(false)
    const [loading, setLoading] = useState(live)
    const [saving, setSaving] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [profileMeta, setProfileMeta] = useState({
        employeeId: '—',
        department: '—',
        manager: '—',
        joined: '—',
        designation: roleLabel || '—',
        status: 'Active',
        name: displayFallback,
    })
    const [personalInfo, setPersonalInfo] = useState({
        ...emptyPersonal,
        fullName: displayFallback,
    })
    const [contactInfo, setContactInfo] = useState({
        ...emptyContact,
        officialEmail: email || '',
    })
    const [addressInfo, setAddressInfo] = useState(emptyAddress)
    const [professional, setProfessional] = useState({
        designation: roleLabel || '',
        department: '',
        employmentType: '',
        reportingManager: '',
        joiningDate: '',
        qualification: '',
        yearsOfExperience: '',
        previousSchool: '',
    })
    const [activityRows, setActivityRows] = useState([])
    const [leaveRows, setLeaveRows] = useState([])
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [passwordBusy, setPasswordBusy] = useState(false)

    const applyProfile = useCallback((data) => {
        if (!data) return
        setProfileMeta({
            employeeId: data.employeeId || data.staffCode || '—',
            department: data.department || '—',
            manager: data.reportingManager || '—',
            joined: formatJoined(data.joiningDate),
            designation: data.designation || roleLabel || '—',
            status: data.status || 'Active',
            name: data.name || displayFallback,
        })
        setPersonalInfo({
            fullName: data.name || '',
            gender: data.gender || '',
            dob: data.dateOfBirth || '',
            bloodGroup: data.bloodGroup || '',
            nationality: data.nationality || '',
            languages: data.languages || '',
        })
        setContactInfo({
            officialEmail: data.email || email || '',
            personalEmail: data.personalEmail || '',
            phone: data.mobileNumber || '',
            emergencyContact: data.emergencyContact || '',
        })
        const permanent =
            data.permanentAddress ||
            [data.street, data.city, data.state, data.pincode, data.country].filter(Boolean).join(', ')
        setAddressInfo({
            permanentAddress: permanent,
            currentAddress: data.currentAddress || permanent,
            street: data.street || '',
            city: data.city || '',
            state: data.state || '',
            country: data.country || '',
            pincode: data.pincode || '',
        })
        setProfessional({
            designation: data.designation || roleLabel || '',
            department: data.department || '',
            employmentType: data.employmentType || '',
            reportingManager: data.reportingManager || '',
            joiningDate: data.joiningDate || '',
            qualification: data.qualification || '',
            yearsOfExperience: data.yearsOfExperience || '',
            previousSchool: data.previousSchool || '',
        })
    }, [displayFallback, email, roleLabel])

    const loadProfile = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            return
        }
        setLoading(true)
        setLoadError('')
        const res = await getMyProfile()
        if (!res.success) {
            setLoadError(res.error || 'Unable to load profile.')
            setLoading(false)
            return
        }
        applyProfile(res.data)
        setLoading(false)
    }, [applyProfile])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    useEffect(() => {
        if (!live || activeTab !== 'activity') return undefined
        let cancelled = false
        ;(async () => {
            const res = await listAuditLogs('audit-logs')
            if (cancelled || !res.success) return
            const uid = String(profileMeta.employeeId || '')
            const mine = (res.data || [])
                .filter((row) => {
                    if (email && (row.userEmail || '').toLowerCase() === email.toLowerCase()) return true
                    if (row.userId && uid && String(row.userId) === uid) return true
                    return false
                })
                .slice(0, 20)
            setActivityRows(mine)
        })()
        return () => {
            cancelled = true
        }
    }, [live, activeTab, email, profileMeta.employeeId])

    useEffect(() => {
        if (!live || activeTab !== 'leave') return undefined
        let cancelled = false
        ;(async () => {
            const res = await listLeaveRequests({ box: 'mine' })
            if (cancelled || !res.success) return
            setLeaveRows(Array.isArray(res.data) ? res.data.slice(0, 12) : [])
        })()
        return () => {
            cancelled = true
        }
    }, [live, activeTab])

    const handleSave = async (e) => {
        e?.preventDefault?.()
        if (!live) {
            setSavedSuccess(true)
            setTimeout(() => setSavedSuccess(false), 3000)
            toast.info('Live API is off — changes were not saved to the server.')
            return
        }
        setSaving(true)
        const nameParts = String(personalInfo.fullName || '').trim().split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
        const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
        const res = await updateMyProfile({
            firstName,
            middleName,
            lastName,
            gender: personalInfo.gender,
            mobileNumber: contactInfo.phone,
            dateOfBirth: personalInfo.dob,
            bloodGroup: personalInfo.bloodGroup,
            nationality: personalInfo.nationality,
            languages: personalInfo.languages,
            personalEmail: contactInfo.personalEmail,
            emergencyContact: contactInfo.emergencyContact,
            permanentAddress: addressInfo.permanentAddress,
            currentAddress: addressInfo.currentAddress,
            street: addressInfo.street,
            city: addressInfo.city,
            state: addressInfo.state,
            country: addressInfo.country,
            pincode: addressInfo.pincode,
            joiningDate: professional.joiningDate,
            reportingManager: professional.reportingManager,
            employmentType: professional.employmentType,
            department: professional.department,
            qualification: professional.qualification,
            yearsOfExperience: professional.yearsOfExperience,
            previousSchool: professional.previousSchool,
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Could not save profile.')
            return
        }
        applyProfile(res.data)
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
        toast.success('Profile saved.')
    }

    const handlePasswordUpdate = async () => {
        if (!live) {
            toast.info('Live API is off — password was not changed.')
            return
        }
        if (!currentPassword || !newPassword) {
            toast.error('Enter current and new password.')
            return
        }
        setPasswordBusy(true)
        const res = await changeMyPassword(currentPassword, newPassword)
        setPasswordBusy(false)
        if (!res.success) {
            toast.error(res.error || 'Password update failed.')
            return
        }
        setCurrentPassword('')
        setNewPassword('')
        toast.success('Password updated.')
    }

    const displayName = profileMeta.name || displayFallback

    return (
        <div className='space-y-6 pb-8 font-inter'>
            <div className='rounded-[1.25rem] border border-slate-200/80 bg-white p-6 shadow-xs'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-6'>
                    <div className='flex items-center gap-5'>
                        <div className='relative'>
                            <div className='size-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold ring-4 ring-blue-50'>
                                {String(displayName)
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase() || '?'}
                            </div>
                            <button
                                type='button'
                                aria-label='Update photo'
                                className='absolute bottom-0 right-0 flex size-6.5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs hover:bg-blue-700 transition-colors'
                                onClick={() => toast.info('Profile photo upload is not available yet.')}
                            >
                                <Camera size={13} />
                            </button>
                        </div>

                        <div>
                            <div className='flex items-center gap-2.5 flex-wrap'>
                                <h1 className='text-xl font-bold tracking-tight text-slate-900'>{displayName}</h1>
                                <span className='rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100'>
                                    {roleLabel}
                                </span>
                                <span className='flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100'>
                                    <span className='size-1.5 rounded-full bg-emerald-500' />
                                    {profileMeta.status === 'Active' ? 'Active Employment' : profileMeta.status}
                                </span>
                            </div>
                            <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500'>
                                <span>
                                    Employee ID: <strong className='text-slate-700'>{profileMeta.employeeId}</strong>
                                </span>
                                <span>·</span>
                                <span>
                                    Dept: <strong className='text-slate-700'>{profileMeta.department}</strong>
                                </span>
                                <span>·</span>
                                <span>
                                    Manager: <strong className='text-slate-700'>{profileMeta.manager}</strong>
                                </span>
                                <span>·</span>
                                <span>
                                    Joined: <strong className='text-slate-700'>{profileMeta.joined}</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className='flex items-center gap-2 self-start sm:self-center flex-wrap'>
                        {!isStudentOrParent ? (
                            <button
                                type='button'
                                onClick={() => setActiveTab('relieving')}
                                className='inline-flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition-colors cursor-pointer'
                            >
                                <FileCheck2 size={14} />
                                Apply for Relieving & NOC
                            </button>
                        ) : (
                            <button
                                type='button'
                                onClick={() => setActiveTab('tc')}
                                className='inline-flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition-colors cursor-pointer'
                            >
                                <GraduationCap size={14} />
                                Apply for Student TC
                            </button>
                        )}
                        <button
                            type='button'
                            onClick={handleSave}
                            disabled={saving || loading}
                            className='inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60'
                        >
                            <Save size={14} />
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {loading && (
                    <p className='mt-4 text-xs text-slate-500'>Loading profile from server…</p>
                )}
                {loadError && (
                    <div className='mt-4 flex items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200'>
                        <span>{loadError}</span>
                        <button type='button' onClick={loadProfile} className='underline cursor-pointer'>
                            Retry
                        </button>
                    </div>
                )}
                {savedSuccess && (
                    <div className='mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200'>
                        <Check size={16} />
                        Profile updates saved.
                    </div>
                )}
            </div>

            <div className='flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 rounded-2xl shadow-2xs sidebar-scroll-hide'>
                {roleTabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type='button'
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className='rounded-[1.25rem] border border-slate-200/80 bg-white p-6 shadow-xs'>
                {activeTab === 'personal' && (
                    <form onSubmit={handleSave} className='space-y-5'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Personal Identity & Demographics
                        </h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs'>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Full Name</label>
                                <input
                                    type='text'
                                    value={personalInfo.fullName}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Date of Birth</label>
                                <input
                                    type='date'
                                    value={personalInfo.dob}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, dob: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Gender</label>
                                <select
                                    value={personalInfo.gender}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                >
                                    <option value=''>Select</option>
                                    <option>Female</option>
                                    <option>Male</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Blood Group</label>
                                <input
                                    type='text'
                                    value={personalInfo.bloodGroup}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, bloodGroup: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Nationality</label>
                                <input
                                    type='text'
                                    value={personalInfo.nationality}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, nationality: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Languages Spoken</label>
                                <input
                                    type='text'
                                    value={personalInfo.languages}
                                    onChange={(e) => setPersonalInfo({ ...personalInfo, languages: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'professional' && (
                    <form onSubmit={handleSave} className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Institutional Appointment & Position
                        </h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                            <div className='rounded-xl bg-slate-50 p-3.5'>
                                <p className='text-slate-400 font-medium'>Designation</p>
                                <p className='font-bold text-slate-900 mt-1 text-sm'>{professional.designation || '—'}</p>
                            </div>
                            <div>
                                <label className='block text-slate-400 font-medium mb-1'>Department</label>
                                <input
                                    type='text'
                                    value={professional.department}
                                    onChange={(e) => setProfessional({ ...professional, department: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block text-slate-400 font-medium mb-1'>Employment Type</label>
                                <input
                                    type='text'
                                    value={professional.employmentType}
                                    onChange={(e) => setProfessional({ ...professional, employmentType: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block text-slate-400 font-medium mb-1'>Reporting Authority</label>
                                <input
                                    type='text'
                                    value={professional.reportingManager}
                                    onChange={(e) => setProfessional({ ...professional, reportingManager: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block text-slate-400 font-medium mb-1'>Date of Joining</label>
                                <input
                                    type='date'
                                    value={professional.joiningDate}
                                    onChange={(e) => setProfessional({ ...professional, joiningDate: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block text-slate-400 font-medium mb-1'>Qualification</label>
                                <input
                                    type='text'
                                    value={professional.qualification}
                                    onChange={(e) => setProfessional({ ...professional, qualification: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'contact' && (
                    <form onSubmit={handleSave} className='space-y-5'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Communications & Emergency Directory
                        </h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Official School Email</label>
                                <input
                                    type='email'
                                    disabled
                                    value={contactInfo.officialEmail}
                                    className='w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 cursor-not-allowed'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Personal Email</label>
                                <input
                                    type='email'
                                    value={contactInfo.personalEmail}
                                    onChange={(e) => setContactInfo({ ...contactInfo, personalEmail: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Primary Mobile Phone</label>
                                <input
                                    type='tel'
                                    value={contactInfo.phone}
                                    onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Emergency Contact Details</label>
                                <input
                                    type='text'
                                    value={contactInfo.emergencyContact}
                                    onChange={(e) => setContactInfo({ ...contactInfo, emergencyContact: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'address' && (
                    <form onSubmit={handleSave} className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Residential Address Information
                        </h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            <div>
                                <label className='block font-bold text-slate-900 mb-1'>Permanent Address</label>
                                <textarea
                                    rows={4}
                                    value={addressInfo.permanentAddress}
                                    onChange={(e) => setAddressInfo({ ...addressInfo, permanentAddress: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-bold text-slate-900 mb-1'>Current Residence Address</label>
                                <textarea
                                    rows={4}
                                    value={addressInfo.currentAddress}
                                    onChange={(e) => setAddressInfo({ ...addressInfo, currentAddress: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                            {['city', 'state', 'country', 'pincode'].map((key) => (
                                <div key={key}>
                                    <label className='block font-medium text-slate-700 mb-1 capitalize'>{key}</label>
                                    <input
                                        type='text'
                                        value={addressInfo[key]}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, [key]: e.target.value })}
                                        className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                    />
                                </div>
                            ))}
                        </div>
                    </form>
                )}

                {activeTab === 'employment' && (
                    <form onSubmit={handleSave} className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Prior Experience & Academic Qualifications
                        </h2>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Years of Experience</label>
                                <input
                                    type='text'
                                    value={professional.yearsOfExperience}
                                    onChange={(e) => setProfessional({ ...professional, yearsOfExperience: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Previous School / Employer</label>
                                <input
                                    type='text'
                                    value={professional.previousSchool}
                                    onChange={(e) => setProfessional({ ...professional, previousSchool: e.target.value })}
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                    </form>
                )}

                {activeTab === 'documents' && (
                    <div className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Verified Statutory & Verification Documents
                        </h2>
                        <p className='text-slate-500'>
                            Document vault uploads are managed through HR / File Room. No documents are listed on your profile yet.
                        </p>
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Biometric Punch Records & Attendance Scorecard
                        </h2>
                        <p className='text-slate-500'>
                            Staff attendance punch summaries will appear here when biometric attendance is linked to your login.
                        </p>
                    </div>
                )}

                {activeTab === 'leave' && (
                    <div className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Leave Requests
                        </h2>
                        {leaveRows.length === 0 ? (
                            <p className='text-slate-500'>No leave requests found for your account.</p>
                        ) : (
                            <div className='space-y-2'>
                                {leaveRows.map((row) => (
                                    <div key={row.id || row.leaveRequestId} className='rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3'>
                                        <div>
                                            <p className='font-semibold text-slate-800'>{row.leaveType || 'Leave'}</p>
                                            <p className='text-slate-500 mt-0.5'>
                                                {row.fromDate} – {row.toDate} · {row.status}
                                            </p>
                                        </div>
                                        <span className='font-mono text-[10px] text-slate-400'>{row.leaveRequestId || row.id}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className='space-y-4 text-xs'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            User Session Audit & Transaction Log
                        </h2>
                        {activityRows.length === 0 ? (
                            <p className='text-slate-500'>No recent activity recorded for your account.</p>
                        ) : (
                            <div className='space-y-2.5'>
                                {activityRows.map((act) => (
                                    <div key={act.id} className='flex items-center justify-between rounded-xl bg-slate-50 p-3'>
                                        <div>
                                            <p className='font-medium text-slate-800'>{act.action}</p>
                                            <p className='text-slate-400 text-[11px] mt-0.5'>{act.timestamp}</p>
                                        </div>
                                        <span className='font-mono text-[10px] text-slate-400'>{act.ipAddress || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className='space-y-5 text-xs max-w-xl'>
                        <h2 className='text-sm font-semibold tracking-tight text-slate-900 border-b border-slate-100 pb-2.5'>
                            Password & Account Security
                        </h2>
                        <div className='space-y-3 pt-2'>
                            <p className='font-bold text-slate-900'>Change Workspace Password</p>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>Current Password</label>
                                <input
                                    type='password'
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder='••••••••••••'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <div>
                                <label className='block font-medium text-slate-700 mb-1'>New Password</label>
                                <input
                                    type='password'
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder='••••••••••••'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                            <button
                                type='button'
                                onClick={handlePasswordUpdate}
                                disabled={passwordBusy}
                                className='rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black transition-colors cursor-pointer disabled:opacity-60'
                            >
                                {passwordBusy ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'relieving' && (
                    <div className='space-y-5 text-xs'>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                            <div>
                                <h2 className='text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2'>
                                    <FileCheck2 size={16} className='text-indigo-600' />
                                    Staff Relieving & Multi-Department NOC
                                </h2>
                                <p className='text-slate-500 mt-0.5'>
                                    Use the relieving workspace to submit and track department clearances.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={() => navigate(`${ROLE_PREFIX[role] || '/super-admin'}/relieving-request`)}
                                className='inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer'
                            >
                                Open Full Relieving Workspace <ArrowRight size={13} />
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'tc' && (
                    <div className='space-y-5 text-xs'>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                            <div>
                                <h2 className='text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2'>
                                    <GraduationCap size={16} className='text-indigo-600' />
                                    Student Transfer Certificate (TC) Requests
                                </h2>
                                <p className='text-slate-500 mt-0.5'>Submit and track TC requests from the student portal.</p>
                            </div>
                            <button
                                type='button'
                                onClick={() => navigate('/student/tc-request')}
                                className='inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer'
                            >
                                View All Requests <ArrowRight size={13} /> <Download size={12} className='opacity-0' />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default MyProfilePage
