import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { parseXlsm, mapSpreadsheetStatusToJobStatus } from '/home/vrsi/nexus-kiosk/server/dist/services/boardService.js'

const path = process.argv[2]
const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })
const sheet = wb.Sheets[wb.SheetNames.includes('Active Projects') ? 'Active Projects' : wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })
const first = rows[0].map((v) => String(v ?? '').trim())
const isNum = first.every((v) => v === '' || /^\d+$/.test(v))
const hi = isNum ? 1 : 0
const headers = rows[hi]
console.log('HEADERS status/note:')
headers.forEach((h, i) => {
  const s = String(h ?? '').toLowerCase()
  if (s.includes('status') || s.includes('note') || s.includes('comment')) console.log(i, JSON.stringify(h))
})

let statusCol = null
let noteCol = null
let jobCol = null
for (let i = 0; i < headers.length; i++) {
  const s = String(headers[i] ?? '').toLowerCase().replace(/\s+/g, ' ')
  if (statusCol === null && s.includes('status')) statusCol = i
  if (noteCol === null && (s === 'notes' || (s.includes('note') && !s.includes('ship')))) noteCol = i
  if (jobCol === null && (s === 'job' || (s.includes('job') && (s.includes('#') || s.includes('num'))))) jobCol = i
}
console.log('cols', { statusCol, noteCol, jobCol })

const dataStart = hi + 1
for (const jn of ['9201-016', '9481-009', '8857-001']) {
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r]
    if (String(row[jobCol] ?? '').trim() === jn) {
      const rawSt = statusCol != null ? String(row[statusCol] ?? '') : ''
      console.log(jn, 'rawStatus', JSON.stringify(rawSt), 'mapped', mapSpreadsheetStatusToJobStatus(rawSt))
      break
    }
  }
}

const counts = {}
for (let r = dataStart; r < rows.length; r++) {
  const row = rows[r]
  const jn = String(row[jobCol] ?? '').trim()
  if (!jn) continue
  const rawSt = statusCol != null ? String(row[statusCol] ?? '').trim() : ''
  const mapped = mapSpreadsheetStatusToJobStatus(rawSt)
  const note = noteCol != null ? String(row[noteCol] ?? '').trim() : ''
  if (note && !mapped) {
    const key = rawSt || '(blank)'
    counts[key] = (counts[key] || 0) + 1
  }
}
console.log('Statuses for rows WITH notes but NO map (top 15):')
Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([k, v]) => console.log(v, k))
