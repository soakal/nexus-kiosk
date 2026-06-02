import { useState, useEffect } from 'react'
import { BoardJob, BoardUser, BoardConfig, JobStatus } from '../../types/board'
import StatusCheckboxes from './StatusCheckboxes'
import ShipDateEditor from './ShipDateEditor'
import NotesSection from './NotesSection'
import { statusLabel } from './boardColors'
import {
  useSetJobStatus,
  useSetJobShipDate,
  useAddJobNote,
  useDeleteJobNote,
  usePresence,
} from '../../hooks/useBoard'
import { claimPresence, releasePresence } from '../../api/boardApi'

interface Props {
  job: BoardJob
  activeUser: BoardUser | null
  config: BoardConfig
}

function formatShipDate(dateStr: string | null): string {
  if (!dateStr) return 'No date'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function JobCard({ job, activeUser, config }: Props) {
  const [notesOpen, setNotesOpen] = useState(job.notes.length > 0)

  // Pending local state for deferred save
  const [pendingStatus, setPendingStatus] = useState<JobStatus>(job.status)
  const [pendingShipDate, setPendingShipDate] = useState<string | null>(job.effectiveShipDate)

  // Re-sync when saved values change (after successful Apply + refetch)
  useEffect(() => { setNotesOpen(job.notes.length > 0) }, [job.notes.length])
  useEffect(() => { setPendingStatus(job.status) }, [job.status])
  useEffect(() => { setPendingShipDate(job.effectiveShipDate) }, [job.effectiveShipDate])

  const setJobStatus = useSetJobStatus()
  const setJobShipDate = useSetJobShipDate()
  const addJobNote = useAddJobNote()
  const deleteJobNote = useDeleteJobNote()

  const statusDirty = pendingStatus !== job.status
  const dateDirty = pendingShipDate !== job.effectiveShipDate
  const isDirty = statusDirty || dateDirty
  const isSaving = setJobStatus.isPending || setJobShipDate.isPending

  // Presence: broadcast when dirty, show warning when someone else is editing
  const presenceMap = usePresence()
  const userId = activeUser?.id
  const userName = activeUser?.name
  useEffect(() => {
    if (!isDirty || !userId || !userName) return
    claimPresence(job.jobNumber, userId, userName)
    const interval = setInterval(() => claimPresence(job.jobNumber, userId, userName), 15000)
    return () => {
      clearInterval(interval)
      releasePresence(job.jobNumber, userId)
    }
  }, [isDirty, userId, userName, job.jobNumber])

  const otherEditors = (presenceMap[job.jobNumber] ?? []).filter(e => e.userId !== userId)

  const handleApply = () => {
    if (!activeUser) return
    if (statusDirty) {
      setJobStatus.mutate({ jobNumber: job.jobNumber, status: pendingStatus, actor: activeUser })
    }
    if (dateDirty) {
      setJobShipDate.mutate({ jobNumber: job.jobNumber, shipDateOverride: pendingShipDate, actor: activeUser })
    }
    // Clear presence immediately rather than waiting for the next effect-cleanup tick
    if (userId) releasePresence(job.jobNumber, userId)
  }

  const handleCancel = () => {
    setPendingStatus(job.status)
    setPendingShipDate(job.effectiveShipDate)
    // Clear presence immediately so the lock releases the moment the user cancels
    if (userId) releasePresence(job.jobNumber, userId)
  }

  const handleAddNote = (text: string) => {
    if (!activeUser) return
    addJobNote.mutate({ jobNumber: job.jobNumber, text, actor: activeUser })
  }

  const handleDeleteNote = (noteId: string) => {
    if (!activeUser) return
    deleteJobNote.mutate({ jobNumber: job.jobNumber, noteId, actor: activeUser })
  }

  const statusColor = config.statusColors[pendingStatus]

  return (
    <div
      className="rounded-xl border border-slate-700/50 p-4 mb-3 border-l-4"
      style={{ borderLeftColor: statusColor, backgroundColor: `${statusColor}18` }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-100 text-lg font-bold">{job.jobNumber}</span>
            {job.isNew && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
                New
              </span>
            )}
          </div>
          <div className="text-slate-400 text-sm mt-0.5">
            {job.customer} &middot; PM: {job.pm}
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-300 text-sm text-right">
          <span>{formatShipDate(pendingShipDate)}</span>
          {(job.shipDateOverridden || dateDirty) && (
            <span className="text-amber-400 ml-1" title="Ship date overridden">&#9888;</span>
          )}
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 mt-2">
        <span className="text-slate-500 text-xs">MM: {job.materialsManager}</span>
        <StatusCheckboxes
          jobNumber={job.jobNumber}
          status={pendingStatus}
          disabled={!activeUser}
          onStatusChange={setPendingStatus}
          statusColors={config.statusColors}
        />
        <span
          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}22`,
            border: `1px solid ${statusColor}55`,
          }}
        >
          {statusLabel(pendingStatus)}
        </span>
      </div>

      {/* Ship date row */}
      <div className="mt-2">
        <ShipDateEditor
          jobNumber={job.jobNumber}
          effectiveShipDate={pendingShipDate}
          shipDateOverridden={job.shipDateOverridden || dateDirty}
          disabled={!activeUser}
          onDateChange={setPendingShipDate}
        />
      </div>

      {/* Notes toggle */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setNotesOpen((o) => !o)}
          className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          {notesOpen ? '▾' : '▸'} Notes ({job.notes.length})
        </button>
        {!activeUser && (
          <span className="text-slate-600 text-xs">&larr; Select a user to edit</span>
        )}
      </div>

      {/* Notes section */}
      {notesOpen && (
        <div className="mt-3">
          <NotesSection
            notes={job.notes}
            activeUser={activeUser}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            isSubmitting={addJobNote.isPending}
          />
        </div>
      )}

      {/* Other-user editing warning */}
      {otherEditors.length > 0 && (
        <div className="mt-2 px-2 py-1.5 bg-amber-900/30 border border-amber-700/40 rounded-lg text-amber-400 text-xs">
          {otherEditors.map(e => e.userName).join(' & ')} {otherEditors.length === 1 ? 'is' : 'are'} editing this job
        </div>
      )}

      {/* Apply / Cancel — only shown when there are unsaved changes */}
      {isDirty && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-700/50 pt-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isSaving || !activeUser}
            className="px-4 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  )
}
