/**
 * Build a minimal valid single-page PDF (PDF 1.4) with Helvetica text.
 * Super Admin exports only. Content is ASCII so byte offsets match the file.
 */

function toAscii(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '-')
    .slice(0, 110)
}

function escapePdfText(value) {
  return toAscii(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * @param {{ title?: string, subtitle?: string, lines?: string[] }} options
 * @returns {Uint8Array}
 */
export function buildValidPdf({ title = 'QMIS Export', subtitle = '', lines = [] } = {}) {
  const maxLines = 48
  const bodyLines = [
    toAscii(title),
    subtitle ? toAscii(subtitle) : '',
    `Generated: ${new Date().toISOString()}`,
    '',
    ...lines.map((line) => toAscii(line)).slice(0, maxLines),
  ]

  const contentOps = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL']
  bodyLines.forEach((line, index) => {
    const text = line || ' '
    if (index === 0) {
      contentOps.push(`/F1 14 Tf (${escapePdfText(text)}) Tj`, 'T*', '/F1 11 Tf')
    } else {
      contentOps.push(`(${escapePdfText(text)}) Tj`, 'T*')
    }
  })
  contentOps.push('ET')
  const stream = `${contentOps.join('\n')}\n`

  const parts = []
  parts.push('%PDF-1.4\n')
  parts.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  parts.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  parts.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  )
  parts.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`)
  parts.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  let pdf = ''
  const offsets = [0]
  parts.forEach((part, index) => {
    if (index > 0) offsets.push(pdf.length)
    pdf += part
  })
  // Object 1 starts after header; recompute properly
  pdf = parts[0]
  const objOffsets = [0]
  for (let i = 1; i < parts.length; i += 1) {
    objOffsets.push(pdf.length)
    pdf += parts[i]
  }

  const xrefStart = pdf.length
  let xref = `xref\n0 ${objOffsets.length}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i < objOffsets.length; i += 1) {
    xref += `${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += xref
  pdf += `trailer\n<< /Size ${objOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  const out = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i += 1) out[i] = pdf.charCodeAt(i) & 0xff
  return out
}

export function downloadBytes(filename, bytes, mimeType) {
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Validate downloaded PDF bytes begin with %PDF- */
export function isPdfSignature(bytes) {
  if (!bytes || bytes.length < 5) return false
  return (
    bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d
  )
}
