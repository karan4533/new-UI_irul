import React, { useId, useState } from 'react'
import { Calendar, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'react-toastify'
import { Dialog } from '../../../Common/ui'
import { buildValidPdf, downloadBytes, downloadTextFile, isPdfSignature } from './buildValidPdf'

/**
 * Super Admin export dialog.
 * - PDF: builds a real minimal PDF (valid %PDF- signature).
 * - CSV: plain text/csv (honest spreadsheet substitute; no fake .xlsx bytes).
 * Does not invent backend APIs; exports the rows passed from the page.
 */
const SuperAdminExportModal = ({
  exportModal,
  setExportModal,
  title = 'Export data',
  exportDescription = 'Choose a date range label and format. PDF files are generated as real PDF documents.',
  recordCount = null,
  getExportLines,
  documentTitle = 'QMIS Super Admin Export',
}) => {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [format, setFormat] = useState('pdf')
  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [toDate, setToDate] = useState(today)
  const [isExporting, setIsExporting] = useState(false)
  const groupId = useId().replace(/:/g, '')

  const close = () => {
    setIsExporting(false)
    setExportModal(false)
  }

  const submit = (event) => {
    event?.preventDefault?.()
    setIsExporting(true)

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      toast.error('From Date cannot be later than To Date.')
      setIsExporting(false)
      return
    }

    const lines = typeof getExportLines === 'function'
      ? getExportLines({ format, fromDate, toDate })
      : []
    const subtitle = `Date range: ${fromDate} to ${toDate} · Records: ${recordCount ?? lines.length}`

    try {
      if (format === 'pdf') {
        const bytes = buildValidPdf({
          title: documentTitle,
          subtitle,
          lines: lines.length ? lines : ['No rows available for this export.'],
        })
        if (!isPdfSignature(bytes)) {
          toast.error('PDF generation failed validation (%PDF- signature missing).')
          setIsExporting(false)
          return
        }
        downloadBytes(`super-admin-export-${fromDate}-to-${toDate}.pdf`, bytes, 'application/pdf')
        toast.success('PDF downloaded. Open it in a PDF reader to verify.')
      } else {
        const csvBody = lines.length ? lines.join('\n') : 'No rows available for this export.'
        const csv = `Title,${JSON.stringify(documentTitle)}\nRange,${fromDate} to ${toDate}\n\n${csvBody}\n`
        downloadTextFile(`super-admin-export-${fromDate}-to-${toDate}.csv`, csv, 'text/csv;charset=utf-8')
        toast.success('CSV downloaded.')
      }
      close()
    } catch (error) {
      toast.error(typeof error?.message === 'string' ? error.message : 'Export failed.')
      setIsExporting(false)
    }
  }

  return (
    <Dialog
      open={exportModal}
      onClose={close}
      title={title}
      description={exportDescription}
      size='sm'
      footer={(
        <>
          <button type='button' onClick={close} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold hover:bg-slate-50 transition cursor-pointer'>
            Cancel
          </button>
          <button type='button' onClick={submit} disabled={isExporting} className='min-h-10 inline-flex items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-5 text-sm font-semibold text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50'>
            <Download size={16} />
            <span>Export {format === 'csv' ? 'CSV' : 'PDF'}</span>
          </button>
        </>
      )}
    >
      <div className='space-y-4 text-xs pt-1'>
        {recordCount != null ? (
          <p className='text-slate-600 font-medium'>
            Exporting <span className='text-[var(--erp-indigo)] font-bold'>{recordCount} records</span> for the selected period label.
          </p>
        ) : null}

        <fieldset className='space-y-1.5'>
          <legend className='text-xs font-semibold text-slate-800 flex items-center gap-1.5'>
            <Calendar size={14} className='text-[var(--erp-indigo)]' />
            <span>Date range label</span>
          </legend>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1'>
            <div>
              <label htmlFor={`${groupId}-from`} className='block text-[11px] font-medium text-slate-500 mb-1'>From Date</label>
              <input id={`${groupId}-from`} type='date' value={fromDate} onChange={(e) => setFromDate(e.target.value)} className='w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--erp-indigo)] focus:outline-none' />
            </div>
            <div>
              <label htmlFor={`${groupId}-to`} className='block text-[11px] font-medium text-slate-500 mb-1'>To Date</label>
              <input id={`${groupId}-to`} type='date' value={toDate} onChange={(e) => setToDate(e.target.value)} className='w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[var(--erp-indigo)] focus:outline-none' />
            </div>
          </div>
        </fieldset>

        <fieldset className='pt-1'>
          <legend className='mb-2 text-xs font-semibold text-slate-800'>File format</legend>
          <div className='grid grid-cols-2 gap-3'>
            <label htmlFor={`${groupId}-pdf`} className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition ${format === 'pdf' ? 'border-[var(--erp-indigo)] bg-[#F1F2FF] text-[var(--erp-indigo)] font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <input id={`${groupId}-pdf`} type='radio' name={`export-format-${groupId}`} value='pdf' checked={format === 'pdf'} onChange={() => setFormat('pdf')} className='accent-[var(--erp-indigo)]' />
              <FileText size={18} className='shrink-0' />
              <div className='leading-tight'>
                <span className='block text-xs font-semibold'>PDF (.pdf)</span>
                <span className='text-[10px] opacity-75 font-normal'>Valid PDF document</span>
              </div>
            </label>
            <label htmlFor={`${groupId}-csv`} className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition ${format === 'csv' ? 'border-[var(--erp-indigo)] bg-[#F1F2FF] text-[var(--erp-indigo)] font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <input id={`${groupId}-csv`} type='radio' name={`export-format-${groupId}`} value='csv' checked={format === 'csv'} onChange={() => setFormat('csv')} className='accent-[var(--erp-indigo)]' />
              <FileSpreadsheet size={18} className='shrink-0' />
              <div className='leading-tight'>
                <span className='block text-xs font-semibold'>CSV (.csv)</span>
                <span className='text-[10px] opacity-75 font-normal'>Spreadsheet text</span>
              </div>
            </label>
          </div>
        </fieldset>
      </div>
    </Dialog>
  )
}

export default SuperAdminExportModal
