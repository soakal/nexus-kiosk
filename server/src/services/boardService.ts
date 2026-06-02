import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'
import type {
  Job,
  JobNote,
  JobStatus,
  BoardJob,
  BoardUser,
  BoardConfig,
  Actor,
} from '../types/board.js'
import { DEFAULT_BOARD_CONFIG } from '../types/board.js'

// ---------------------------------------------------------------------------
// Path resolution (ESM: no __dirname)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.resolve(__dirname, '../../data')

const JOBS_FILE = path.join(DATA_DIR, 'jobs.json')
const BOARD_STATE_FILE = path.join(DATA_DIR, 'board-state.json')
const BOARD_CONFIG_FILE = path.join(DATA_DIR, 'board-config.json')

// ---------------------------------------------------------------------------
// Note ID counter (deterministic per process, no nondeterministic functions)
// ---------------------------------------------------------------------------
let noteCounter = 0

function generateNoteId(): string {
  return 'n_' + process.hrtime.bigint().toString() + '_' + (++noteCounter)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDataDir()
  // Atomic write: write to a temp file then rename onto the target. rename is
  // atomic on the same filesystem, so a crash/power-loss mid-write can never
  // leave a truncated/invalid JSON file.
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

// ---------------------------------------------------------------------------
// Serialize board-state read-modify-write mutations so two concurrent
// status/note/ship-date writes can't each read the old state and clobber each
// other (last-writer-wins data loss). All mutators run through this queue.
// ---------------------------------------------------------------------------
let boardStateMutationQueue: Promise<unknown> = Promise.resolve()

function runExclusive<T>(fn: () => T): Promise<T> {
  const run = boardStateMutationQueue.then(() => fn())
  // Keep the chain alive even if fn throws, so one failure doesn't wedge it.
  boardStateMutationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

// ---------------------------------------------------------------------------
// Date parsing helper
// ---------------------------------------------------------------------------
// Format a Date using its LOCAL components, not toISOString(). Excel parses
// text/Date cells as local midnight; toISOString() converts to UTC, which rolls
// the date back a day in every negative-UTC-offset timezone (all of N. America),
// silently storing ship dates off-by-one. Build yyyy-mm-dd from local parts.
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateValue(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return formatLocalDate(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    // If it already looks like yyyy-mm-dd use it as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    // Try parsing as a generic date string
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return formatLocalDate(d)
    return trimmed
  }
  if (typeof value === 'number') {
    // Excel serial date
    return XLSX.SSF.format('yyyy-mm-dd', value)
  }
  return null
}

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------
interface ColumnMap {
  jobNumber: number | null
  pm: number | null
  customer: number | null
  materialsManager: number | null
  pabsComplete: number | null
  shipToPm: number | null
  shipToCustomer: number | null
}

function detectColumns(headers: unknown[]): { colMap: ColumnMap; warnings: string[] } {
  const colMap: ColumnMap = {
    jobNumber: null,
    pm: null,
    customer: null,
    materialsManager: null,
    pabsComplete: null,
    shipToPm: null,
    shipToCustomer: null,
  }

  for (let i = 0; i < headers.length; i++) {
    const raw = String(headers[i] ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
    if (!raw) continue

    if (
      raw === 'job' ||
      (raw.includes('job') && (raw.includes('#') || raw.includes('num') || raw.includes('no')))
    ) {
      if (colMap.jobNumber === null) colMap.jobNumber = i
    } else if (
      (raw === 'pm' || raw.includes('project manager')) &&
      !raw.includes('ship')
    ) {
      if (colMap.pm === null) colMap.pm = i
    } else if (raw.includes('customer') || raw.includes('client')) {
      if (colMap.customer === null) colMap.customer = i
    } else if (raw.includes('material') && raw.includes('manag')) {
      if (colMap.materialsManager === null) colMap.materialsManager = i
    } else if (raw.includes('pab') && (raw.includes('complete') || raw.includes('finish'))) {
      if (colMap.pabsComplete === null) colMap.pabsComplete = i
    } else if (raw.includes('ship') && raw.includes('pm')) {
      if (colMap.shipToPm === null) colMap.shipToPm = i
    } else if (
      (raw.includes('ship') && raw.includes('customer')) ||
      raw === 'ship from vrsi'
    ) {
      if (colMap.shipToCustomer === null) colMap.shipToCustomer = i
    }
  }

  const warnings: string[] = []
  const fieldNames: Array<keyof ColumnMap> = [
    'jobNumber',
    'pm',
    'customer',
    'materialsManager',
    'pabsComplete',
    'shipToPm',
    'shipToCustomer',
  ]
  for (const field of fieldNames) {
    if (colMap[field] === null) {
      warnings.push(`Column not found for field: ${field}`)
    }
  }

  return { colMap, warnings }
}

// ---------------------------------------------------------------------------
// jobs.json
// ---------------------------------------------------------------------------
export interface JobsFile {
  jobs: Job[]
  importedAt: string
  sourceFile: string
  newJobNumbers: string[]
}

export function loadJobsFile(): JobsFile | null {
  return readJsonFile<JobsFile>(JOBS_FILE)
}

export function saveJobsFile(jobs: Job[], sourceFile: string): void {
  const existing = loadJobsFile()
  const existingNumbers = new Set(existing?.jobs.map((j) => j.jobNumber) ?? [])

  const currentNumbers = new Set(jobs.map((j) => j.jobNumber))

  // isNew must survive re-imports. A job flagged new in a prior import that is
  // still present (and never acknowledged) must STAY new — recomputing "not in
  // the previous file" alone would wrongly clear the badge on the next import.
  // So: union (jobs not seen in the previous import) with (prior newJobNumbers
  // that are still present in this import).
  const carriedOver = (existing?.newJobNumbers ?? []).filter((n) =>
    currentNumbers.has(n)
  )
  const freshlyNew = jobs
    .map((j) => j.jobNumber)
    .filter((n) => !existingNumbers.has(n))
  const newJobNumbers = Array.from(new Set([...carriedOver, ...freshlyNew]))

  const data: JobsFile = {
    jobs,
    importedAt: new Date().toISOString(),
    sourceFile,
    newJobNumbers,
  }
  writeJsonFile(JOBS_FILE, data)

  // Prune orphaned board-state: notes/status/ship-date overrides for jobs no
  // longer present in the spreadsheet would otherwise accumulate forever and,
  // worse, be silently inherited if a job number is later reused.
  pruneOrphanedBoardState(currentNumbers)
}

function pruneOrphanedBoardState(validJobNumbers: Set<string>): void {
  const state = getBoardStateFile()
  let changed = false
  for (const jobNumber of Object.keys(state)) {
    if (!validJobNumbers.has(jobNumber)) {
      delete state[jobNumber]
      changed = true
    }
  }
  if (changed) writeBoardState(state)
}

// ---------------------------------------------------------------------------
// XLSM parsing
// ---------------------------------------------------------------------------
export function parseXlsm(
  buffer: Buffer,
  originalName: string,
): { jobs: Job[]; warnings: string[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // Prefer "Active Projects" sheet; fall back to first sheet
  const sheetName = workbook.SheetNames.includes('Active Projects')
    ? 'Active Projects'
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]

  if (rows.length < 2) {
    return { jobs: [], warnings: ['Spreadsheet is empty'] }
  }

  // Active Projects has a numeric index row first — real headers are in row index 1
  const firstRow = (rows[0] as unknown[]).map((v) => String(v ?? '').trim())
  const isNumericHeader = firstRow.length > 0 && firstRow.every((v) => v === '' || /^\d+$/.test(v))
  const headerRowIndex = isNumericHeader ? 1 : 0
  const dataStartIndex = headerRowIndex + 1

  const headers = rows[headerRowIndex] as unknown[]
  const { colMap, warnings } = detectColumns(headers)

  const jobs: Job[] = []

  for (let r = dataStartIndex; r < rows.length; r++) {
    const row = rows[r] as unknown[]

    const jobNumberRaw =
      colMap.jobNumber !== null ? row[colMap.jobNumber] : undefined
    if (jobNumberRaw == null || String(jobNumberRaw).trim() === '') continue

    const getString = (col: number | null): string => {
      if (col === null) return ''
      const val = row[col]
      return val != null ? String(val).trim().toLowerCase() : ''
    }

    const getDate = (col: number | null): string | null => {
      if (col === null) return null
      return parseDateValue(row[col])
    }

    const job: Job = {
      jobNumber: String(jobNumberRaw).trim(),
      pm: getString(colMap.pm),
      customer: colMap.customer !== null
        ? (row[colMap.customer] != null ? String(row[colMap.customer]).trim() : '')
        : '',
      materialsManager: getString(colMap.materialsManager),
      pabsComplete: getDate(colMap.pabsComplete),
      shipToPm: getDate(colMap.shipToPm),
      shipToCustomer: getDate(colMap.shipToCustomer),
    }

    jobs.push(job)
  }

  return { jobs, warnings }
}

// ---------------------------------------------------------------------------
// board-state.json
// ---------------------------------------------------------------------------
type JobStateEntry = {
  status: JobStatus
  shipDateOverride: string | null
  notes: JobNote[]
  updatedAt: string
  updatedBy?: string
}

type BoardStateFile = {
  jobs: Record<string, JobStateEntry>
}

export function getBoardStateFile(): Record<string, JobStateEntry> {
  const file = readJsonFile<BoardStateFile>(BOARD_STATE_FILE)
  return file?.jobs ?? {}
}

export function writeBoardState(state: ReturnType<typeof getBoardStateFile>): void {
  writeJsonFile(BOARD_STATE_FILE, { jobs: state })
}

export function getJobState(jobNumber: string): JobStateEntry {
  const state = getBoardStateFile()
  return (
    state[jobNumber] ?? {
      status: 'none' as JobStatus,
      shipDateOverride: null,
      notes: [],
      updatedAt: '',
    }
  )
}

export function setJobStatus(jobNumber: string, status: JobStatus, actor?: Actor): Promise<void> {
  return runExclusive(() => {
    const state = getBoardStateFile()
    const existing = state[jobNumber] ?? {
      status: 'none' as JobStatus,
      shipDateOverride: null,
      notes: [],
      updatedAt: '',
    }
    state[jobNumber] = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name,
    }
    writeBoardState(state)
  })
}

export function setShipDateOverride(jobNumber: string, date: string | null, actor?: Actor): Promise<void> {
  return runExclusive(() => {
    const state = getBoardStateFile()
    const existing = state[jobNumber] ?? {
      status: 'none' as JobStatus,
      shipDateOverride: null,
      notes: [],
      updatedAt: '',
    }
    state[jobNumber] = {
      ...existing,
      shipDateOverride: date,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name,
    }
    writeBoardState(state)
  })
}

export function addNote(jobNumber: string, text: string, actor: Actor): Promise<JobNote> {
  return runExclusive(() => {
    const state = getBoardStateFile()
    const existing = state[jobNumber] ?? {
      status: 'none' as JobStatus,
      shipDateOverride: null,
      notes: [],
      updatedAt: '',
    }

    const note: JobNote = {
      id: generateNoteId(),
      authorId: actor.id,
      authorName: actor.name,
      text,
      createdAt: new Date().toISOString(),
    }

    state[jobNumber] = {
      ...existing,
      notes: [...existing.notes, note],
      updatedAt: new Date().toISOString(),
    }
    writeBoardState(state)
    return note
  })
}

export function deleteNote(jobNumber: string, noteId: string, actor: Actor): Promise<{ ok: boolean; error?: string }> {
  return runExclusive(() => {
    const state = getBoardStateFile()
    const existing = state[jobNumber]
    if (!existing) return { ok: true }

    const note = existing.notes.find((n) => n.id === noteId)
    if (note && note.authorId !== actor.id) {
      return { ok: false, error: 'Only the author can delete this note' }
    }

    state[jobNumber] = {
      ...existing,
      notes: existing.notes.filter((n) => n.id !== noteId),
      updatedAt: new Date().toISOString(),
    }
    writeBoardState(state)
    return { ok: true }
  })
}

// ---------------------------------------------------------------------------
// board-config.json
// ---------------------------------------------------------------------------
function deepMergeConfig(base: BoardConfig, override: Partial<BoardConfig>): BoardConfig {
  return {
    spareCarrier: override.spareCarrier ?? base.spareCarrier,
    superUser: override.superUser || base.superUser,
    statusColors: {
      ...base.statusColors,
      ...(override.statusColors ?? {}),
    },
    extraUsers: override.extraUsers ?? base.extraUsers,
  }
}

export function getBoardConfig(): BoardConfig {
  const stored = readJsonFile<Partial<BoardConfig>>(BOARD_CONFIG_FILE)
  if (!stored) return { ...DEFAULT_BOARD_CONFIG }
  return deepMergeConfig(DEFAULT_BOARD_CONFIG, stored)
}

export function saveBoardConfig(partial: Partial<BoardConfig>): BoardConfig {
  const current = getBoardConfig()
  const updated = deepMergeConfig(current, partial)
  writeJsonFile(BOARD_CONFIG_FILE, updated)
  return updated
}

// ---------------------------------------------------------------------------
// getMergedJobs
// ---------------------------------------------------------------------------
export function getMergedJobs(): BoardJob[] {
  const jobsFile = loadJobsFile()
  if (!jobsFile) return []

  const state = getBoardStateFile()
  const newSet = new Set(jobsFile.newJobNumbers ?? [])

  return jobsFile.jobs.map((job): BoardJob => {
    const jobState = state[job.jobNumber] ?? {
      status: 'none' as JobStatus,
      shipDateOverride: null,
      notes: [],
      updatedAt: '',
    }

    const effectiveShipDate = jobState.shipDateOverride ?? job.shipToCustomer ?? null
    const shipDateOverridden = jobState.shipDateOverride !== null

    return {
      ...job,
      status: jobState.status,
      notes: jobState.notes,
      effectiveShipDate,
      shipDateOverridden,
      isNew: newSet.has(job.jobNumber),
    }
  })
}

// ---------------------------------------------------------------------------
// getDerivedUsers
// ---------------------------------------------------------------------------
// Jon Shantry is a permanent user — always present regardless of config or import
const PERMANENT_SUPER = 'Jon Shantry'

export function getDerivedUsers(config: BoardConfig): BoardUser[] {
  const jobsFile = loadJobsFile()
  const jobs = jobsFile?.jobs ?? []

  const makeId = (name: string): string =>
    'u_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  // Collect unique names per role from job data
  const pmNames = new Set<string>()
  const materialsNames = new Set<string>()

  for (const job of jobs) {
    if (job.pm?.trim()) pmNames.add(job.pm.trim())
    if (job.materialsManager?.trim()) materialsNames.add(job.materialsManager.trim())
  }

  const users: BoardUser[] = []

  // Permanent super user — always first, always present
  users.push({ id: makeId(PERMANENT_SUPER), name: PERMANENT_SUPER, role: 'super' })

  // Configured super user (if different from permanent and non-empty)
  const seen = new Set<string>([PERMANENT_SUPER])
  const configuredSuper = config.superUser?.trim()
  if (configuredSuper && configuredSuper !== PERMANENT_SUPER) {
    seen.add(configuredSuper)
    users.push({ id: makeId(configuredSuper), name: configuredSuper, role: 'super' })
  }
  const rest: BoardUser[] = []

  for (const name of pmNames) {
    if (!seen.has(name)) {
      seen.add(name)
      rest.push({ id: makeId(name), name, role: 'pm' })
    }
  }

  for (const name of materialsNames) {
    if (!seen.has(name)) {
      seen.add(name)
      rest.push({ id: makeId(name), name, role: 'materials' })
    }
  }

  for (const name of config.extraUsers) {
    const trimmed = name.trim()
    if (!trimmed) continue
    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      rest.push({ id: makeId(trimmed), name: trimmed, role: 'manual' })
    }
  }

  // Sort rest alphabetically by name
  rest.sort((a, b) => a.name.localeCompare(b.name))

  return [...users, ...rest]
}
