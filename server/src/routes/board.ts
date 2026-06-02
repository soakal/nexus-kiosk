import { Router, Request, Response } from 'express'
import multer from 'multer'
import {
  parseXlsm,
  saveJobsFile,
  getMergedJobs,
  getBoardConfig,
  saveBoardConfig,
  getDerivedUsers,
  setJobStatus,
  setShipDateOverride,
  addNote,
  deleteNote,
} from '../services/boardService.js'
import { STATUS_ORDER } from '../types/board.js'
import type { Job, Actor } from '../types/board.js'

export const boardRouter = Router()

// ---------------------------------------------------------------------------
// Presence store — in-memory, ephemeral (survives only while server is up)
// jobNumber → Map<userId, { userName, expiresAt }>
// ---------------------------------------------------------------------------
interface PresenceEntry { userName: string; expiresAt: number }
const presenceStore = new Map<string, Map<string, PresenceEntry>>()

function cleanPresence() {
  const now = Date.now()
  for (const [job, editors] of presenceStore.entries()) {
    for (const [uid, entry] of editors.entries()) {
      if (entry.expiresAt <= now) editors.delete(uid)
    }
    if (editors.size === 0) presenceStore.delete(job)
  }
}

boardRouter.get('/presence', (_req: Request, res: Response) => {
  cleanPresence()
  const result: Record<string, { userId: string; userName: string }[]> = {}
  for (const [job, editors] of presenceStore.entries()) {
    result[job] = Array.from(editors.entries()).map(([userId, { userName }]) => ({ userId, userName }))
  }
  res.json(result)
})

boardRouter.post('/presence/:jobNumber', (req: Request, res: Response) => {
  const { userId, userName } = req.body as { userId?: string; userName?: string }
  if (!userId || !userName) { res.status(400).json({ error: 'userId and userName required' }); return }
  const job = req.params.jobNumber
  if (!presenceStore.has(job)) presenceStore.set(job, new Map())
  presenceStore.get(job)!.set(userId, { userName, expiresAt: Date.now() + 30000 })
  res.json({ ok: true })
})

boardRouter.delete('/presence/:jobNumber', (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string }
  if (userId) {
    const editors = presenceStore.get(req.params.jobNumber)
    editors?.delete(userId)
    if (editors?.size === 0) presenceStore.delete(req.params.jobNumber)
  }
  res.json({ ok: true })
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
})

// ---------------------------------------------------------------------------
// POST /import
// ---------------------------------------------------------------------------
boardRouter.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let jobs: Job[]
    let sourceFile: string
    let warnings: string[] = []

    if (req.file) {
      const result = parseXlsm(req.file.buffer, req.file.originalname)
      jobs = result.jobs
      warnings = result.warnings
      sourceFile = req.file.originalname
    } else if (Array.isArray(req.body.jobs)) {
      jobs = req.body.jobs as Job[]
      sourceFile = 'manual-import'
    } else {
      res.status(400).json({ error: 'No file or jobs array provided' })
      return
    }

    saveJobsFile(jobs, sourceFile)
    res.json({ imported: jobs.length, warnings })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /jobs
// ---------------------------------------------------------------------------
boardRouter.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = getMergedJobs()
    res.json(jobs)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /config
// ---------------------------------------------------------------------------
boardRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = getBoardConfig()
    res.json(config)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// POST /config
// ---------------------------------------------------------------------------
boardRouter.post('/config', async (req: Request, res: Response) => {
  try {
    const updated = saveBoardConfig(req.body)
    res.json(updated)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /users
// ---------------------------------------------------------------------------
boardRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const cfg = getBoardConfig()
    const users = getDerivedUsers(cfg)
    res.json(users)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /jobs/:jobNumber/status
// ---------------------------------------------------------------------------
boardRouter.patch('/jobs/:jobNumber/status', async (req: Request, res: Response) => {
  try {
    const { status, actor } = req.body as { status: string; actor?: Actor }

    if (!STATUS_ORDER.includes(status as never)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    setJobStatus(req.params.jobNumber, status as (typeof STATUS_ORDER)[number], actor)

    const jobs = getMergedJobs()
    const job = jobs.find((j) => j.jobNumber === req.params.jobNumber)
    res.json(job ?? { error: 'Job not found' })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /jobs/:jobNumber/ship-date
// ---------------------------------------------------------------------------
boardRouter.patch('/jobs/:jobNumber/ship-date', async (req: Request, res: Response) => {
  try {
    const { shipDateOverride, actor } = req.body as { shipDateOverride?: string | null; actor?: Actor }

    setShipDateOverride(req.params.jobNumber, shipDateOverride ?? null, actor)

    const jobs = getMergedJobs()
    res.json(jobs.find((j) => j.jobNumber === req.params.jobNumber))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// POST /jobs/:jobNumber/notes
// ---------------------------------------------------------------------------
boardRouter.post('/jobs/:jobNumber/notes', async (req: Request, res: Response) => {
  try {
    const { text, actor } = req.body as { text?: string; actor?: Actor }

    if (!text || !actor) {
      res.status(400).json({ error: 'text and actor required' })
      return
    }

    const note = addNote(req.params.jobNumber, text, actor)
    res.status(201).json(note)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// DELETE /jobs/:jobNumber/notes/:noteId
// ---------------------------------------------------------------------------
boardRouter.delete('/jobs/:jobNumber/notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { actor } = req.body as { actor?: Actor }
    if (!actor) {
      res.status(400).json({ error: 'actor required' })
      return
    }
    const result = deleteNote(req.params.jobNumber, req.params.noteId, actor)
    if (!result.ok) {
      res.status(403).json({ error: result.error })
      return
    }
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})
