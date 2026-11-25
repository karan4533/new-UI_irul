/**
 * Build a CSV string and trigger a browser download.
 * Returns true when download was initiated; throws on empty/invalid input.
 */
export function downloadCsv(filename, headers, rows) {
    if (!Array.isArray(headers) || headers.length === 0) {
        throw new Error('CSV export requires at least one column header.')
    }
    const escapeCell = (value) => {
        const text = value == null ? '' : String(value)
        if (/[",\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`
        }
        return text
    }
    const lines = [headers.map(escapeCell).join(',')]
    const safeRows = Array.isArray(rows) ? rows : []
    for (const row of safeRows) {
        if (Array.isArray(row)) {
            lines.push(row.map(escapeCell).join(','))
        } else if (row && typeof row === 'object') {
            lines.push(headers.map((key) => escapeCell(row[key])).join(','))
        }
    }
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
}
