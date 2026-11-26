import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { RotateCcw, Save } from 'lucide-react'
import {
    ACADEMIC_YEARS,
    BOOKS_CLOSURE_TOGGLES,
    CURRENCIES,
    DATE_FORMATS,
    FINANCIAL_YEAR_STARTS,
    GENERAL_SETTINGS,
    NUMBER_FORMATS,
    TERM_STRUCTURES,
} from '../settingsData'
import {
    FormField,
    FormGrid,
    SettingRow,
    SettingsPanel,
    fieldClass,
} from './SettingsShared'
import { useFinance } from '../../financeDomain/FinanceContext'
import { formatDisplayDateTime } from '../../financeDomain/financeHelpers'
import { ConfirmAction, IntegrationNotice } from '../../../../Common/ui'
import LiveStatusBanner from '../../financeDomain/LiveStatusBanner'
import { getFinanceSettingsApi, updateFinanceSettingsApi } from '../../../../services/api/financeExtrasApiService.js'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore.js'

const LIVE_FIELDS = ['institutionName', 'gstin', 'pan', 'tan', 'tdsRatePercent', 'gstRatePercent', 'academicYear', 'currency', 'numberFormat', 'dateFormat', 'termStructure']

const GeneralTab = () => {
    const live = isLiveApiEnabled()
    const [general, setGeneral] = useState(GENERAL_SETTINGS)
    const [booksClosure, setBooksClosure] = useState(BOOKS_CLOSURE_TOGGLES)
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
    const { resetFinanceDemoData, financePersistence, rehydrateFromApi } = useFinance()
    const [remote, setRemote] = useState(null)
    const [loading, setLoading] = useState(live)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const applyRemote = useCallback((body) => {
        setRemote(body)
        setGeneral((prev) => ({ ...prev, ...body.settings }))
        setBooksClosure((prev) => prev.map((item) => ({ ...item, enabled: Boolean(body.settings.booksClosure?.[item.id]) })))
    }, [])

    const load = useCallback(async () => {
        if (!live) return
        setLoading(true)
        const res = await getFinanceSettingsApi()
        setLoading(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        applyRemote(res.data)
    }, [live, applyRemote])

    useEffect(() => {
        load()
    }, [load])

    const saveLive = async () => {
        setSaving(true)
        setNotice('')
        const payload = Object.fromEntries(LIVE_FIELDS.map((key) => [key, general[key]]))
        payload.tdsRatePercent = Number(payload.tdsRatePercent || 0)
        payload.gstRatePercent = Number(payload.gstRatePercent || 0)
        payload.booksClosure = Object.fromEntries(booksClosure.map((item) => [item.id, item.enabled]))
        const res = await updateFinanceSettingsApi(payload)
        setSaving(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        setNotice(res.data?.skipped ? 'No changes to save.' : `Saved: ${(res.data?.changed || []).join(', ')}.`)
        await load()
        await rehydrateFromApi?.()
    }

    const updateGeneral = (key, value) => {
        setGeneral((prev) => ({ ...prev, [key]: value }))
    }
    const academicYears = live
        ? [...new Set([general.academicYear, remote?.currentFinancialYear, ...(remote?.financialYears || []).map((fy) => fy.name.replace('FY', '').trim())].filter(Boolean))]
        : ACADEMIC_YEARS
    const choices = (key, fallback) => (live && remote?.choices?.[key]) || fallback

    const toggleBooksClosure = (id) => {
        setBooksClosure((prev) =>
            prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
        )
    }

    const handleResetDemoData = async () => {
        const result = await resetFinanceDemoData()
        setResetConfirmOpen(false)
        if (result?.success === false) {
            toast.error(typeof result.error === 'string' ? result.error : 'Could not reset finance data.')
            return
        }
        toast.success(
            result?.dataSource === 'backend'
                ? 'Finance campus snapshot reset and seeded on the server.'
                : 'Finance demo data has been restored to the original seed.',
        )
    }

    return (
        <div className='space-y-6'>
            {live ? (
                <>
                    <IntegrationNotice
                        state='connected'
                        title='Live finance settings (PostgreSQL)'
                        description='Institution, financial year and tax identifiers on this tab are saved on the server with validation and audit history. The financial year always runs April to March.'
                    />
                    <LiveStatusBanner loading={loading} error={error} notice={notice} onRetry={load} />
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='text-sm text-[#667085]'>
                            Current financial year: <span className='font-medium text-[#1E1E1E]'>FY {remote?.currentFinancialYear || '—'}</span>
                            {remote?.updatedAt ? ` · last saved ${formatDisplayDateTime(remote.updatedAt)} by ${remote.updatedBy}` : ' · not saved yet'}
                        </p>
                        <button type='button' onClick={saveLive} disabled={saving || loading || !remote} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white cursor-pointer disabled:opacity-60'>
                            <Save aria-hidden='true' size={16} /> {saving ? 'Saving…' : 'Save settings'}
                        </button>
                    </div>
                </>
            ) : null}
            <SettingsPanel title='Institution & financial year'>
                <FormGrid>
                    <FormField label='School / Institution Name'>
                        <input
                            type='text'
                            value={general.institutionName}
                            onChange={(event) => updateGeneral('institutionName', event.target.value)}
                            className={fieldClass}
                        />
                    </FormField>
                    <FormField label='GSTIN'>
                        <input
                            type='text'
                            value={general.gstin}
                            onChange={(event) => updateGeneral('gstin', event.target.value)}
                            className={fieldClass}
                        />
                    </FormField>
                    <FormField label='Current Academic Year'>
                        <select
                            value={general.academicYear}
                            onChange={(event) => updateGeneral('academicYear', event.target.value)}
                            className={fieldClass}
                        >
                            {academicYears.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label='Financial Year Start Month'>
                        <select
                            value={general.financialYearStart}
                            onChange={(event) => updateGeneral('financialYearStart', event.target.value)}
                            className={fieldClass}
                            disabled={live}
                            title={live ? 'The financial year is fixed to April–March.' : undefined}
                        >
                            {choices('financialYearStart', FINANCIAL_YEAR_STARTS).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                </FormGrid>
            </SettingsPanel>

            {live ? (
                <SettingsPanel title='Tax identifiers & default rates'>
                    <FormGrid>
                        <FormField label='PAN'>
                            <input type='text' value={general.pan || ''} onChange={(event) => updateGeneral('pan', event.target.value.toUpperCase())} placeholder='ABCDE1234F' className={fieldClass} />
                        </FormField>
                        <FormField label='TAN'>
                            <input type='text' value={general.tan || ''} onChange={(event) => updateGeneral('tan', event.target.value.toUpperCase())} placeholder='ABCD12345E' className={fieldClass} />
                        </FormField>
                        <FormField label='Default TDS rate on vendor payments (%)'>
                            <input type='number' min='0' max='100' step='0.01' value={general.tdsRatePercent ?? 0} onChange={(event) => updateGeneral('tdsRatePercent', event.target.value)} className={fieldClass} />
                        </FormField>
                        <FormField label='Default GST rate on taxable services (%)'>
                            <input type='number' min='0' max='100' step='0.01' value={general.gstRatePercent ?? 0} onChange={(event) => updateGeneral('gstRatePercent', event.target.value)} className={fieldClass} />
                        </FormField>
                    </FormGrid>
                    <p className='mt-3 text-xs text-[#667085]'>Rates are stored as defaults for reference. Vouchers do not yet deduct TDS or add GST automatically.</p>
                </SettingsPanel>
            ) : null}

            <SettingsPanel title='Currency & formatting'>
                <FormGrid>
                    <FormField label='Currency'>
                        <select
                            value={general.currency}
                            onChange={(event) => updateGeneral('currency', event.target.value)}
                            className={fieldClass}
                        >
                            {choices('currency', CURRENCIES).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label='Number Format'>
                        <select
                            value={general.numberFormat}
                            onChange={(event) => updateGeneral('numberFormat', event.target.value)}
                            className={fieldClass}
                        >
                            {choices('numberFormat', NUMBER_FORMATS).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label='Date Format'>
                        <select
                            value={general.dateFormat}
                            onChange={(event) => updateGeneral('dateFormat', event.target.value)}
                            className={fieldClass}
                        >
                            {choices('dateFormat', DATE_FORMATS).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label='Default Term Structure'>
                        <select
                            value={general.termStructure}
                            onChange={(event) => updateGeneral('termStructure', event.target.value)}
                            className={fieldClass}
                        >
                            {choices('termStructure', TERM_STRUCTURES).map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </FormField>
                </FormGrid>
            </SettingsPanel>

            <SettingsPanel title='Books closure' sub={live ? 'Saved as policy flags. Posting locks are not enforced by the server yet.' : undefined}>
                {booksClosure.map((item) => (
                    <SettingRow
                        key={item.id}
                        label={item.label}
                        sub={item.sub}
                        enabled={item.enabled}
                        onChange={() => toggleBooksClosure(item.id)}
                    />
                ))}
            </SettingsPanel>

            {!live && <SettingsPanel
                title='Demo data'
                sub='Local browser storage used by the current frontend prototype.'
            >
                <div className='space-y-3 text-sm text-[#667085]'>
                    <IntegrationNotice
                        state='demo'
                        title='Finance API not connected'
                        description='Transactions, receipts, cheque updates, and settings on this screen are stored only in this browser and are not suitable as financial records.'
                    />
                    <p>Local demo persistence: <span className='font-medium text-[#1E1E1E]'>Enabled</span></p>
                    <p>Storage key: <span className='font-mono text-xs text-[#1E1E1E]'>{financePersistence?.storageKey}</span></p>
                    <p>
                        Last saved:{' '}
                        <span className='text-[#1E1E1E]'>
                            {financePersistence?.lastSavedAt
                                ? formatDisplayDateTime(financePersistence.lastSavedAt)
                                : 'Not saved yet'}
                        </span>
                    </p>
                    <p className='text-xs'>
                        Clearing site data, using another browser, or another device removes this demo state.
                        Real production data must live in a Finance API and database.
                    </p>
                    <button
                        type='button'
                        onClick={() => setResetConfirmOpen(true)}
                        className='inline-flex items-center gap-2 text-sm font-medium text-[#FF5722] border border-[#FF5722] px-4 py-2 rounded-md hover:bg-[#FF5722] hover:text-white transition-colors cursor-pointer'
                    >
                        <RotateCcw size={16} />
                        Reset Finance Demo Data
                    </button>
                </div>
            </SettingsPanel>}
            <ConfirmAction
                open={resetConfirmOpen}
                onClose={() => setResetConfirmOpen(false)}
                onConfirm={handleResetDemoData}
                title='Reset all browser-stored finance data?'
                description='This removes local transactions, receipts, cheque updates and manual changes, then restores the original seed. Connected backend records are not affected.'
                confirmLabel='Reset local finance data'
                tone='danger'
            />
        </div>
    )
}

export default GeneralTab
