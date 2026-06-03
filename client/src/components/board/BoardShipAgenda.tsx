import { useMemo } from 'react'
import { BoardJob, BoardConfig, BoardUser } from '../../types/board'
import { statusLabel } from './boardColors'
import { samePerson } from '../../utils/personIdentity'

interface Props {
  jobs: BoardJob[]
  config: BoardConfig
  daysAhead?: number
  activeUser?: BoardUser | null
  onSelectJob: (jobNumber: string) => void
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function parseShipDay(iso: string): Date {
  return startOfDay(new Date(iso + 'T00:00:00'))
}

function formatSectionDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isUsersJob(job: BoardJob, user: BoardUser | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'pm') return samePerson(job.pm, user.name)
  if (user.role === 'materials') return samePerson(job.materialsManager, user.name)
  return false
}

export function BoardShipAgenda({
  jobs,
  config,
  daysAhead = 30,
  activeUser,
  onSelectJob,
}: Props) {
  const sections = useMemo(() => {
    const today = startOfDay(new Date())
    const end = addDays(today, daysAhead)
    const byDate = new Map<string, BoardJob[]>()

    for (const job of jobs) {
      if (!job.effectiveShipDate) continue
      const day = parseShipDay(job.effectiveShipDate)
      if (day < today || day > end) continue
      const key = job.effectiveShipDate
      const list = byDate.get(key) ?? []
      list.push(job)
      byDate.set(key, list)
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, dayJobs]) => ({
        dateKey,
        label: formatSectionDate(parseShipDay(dateKey)),
        jobs: [...dayJobs].sort((a, b) => a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true })),
      }))
  }, [jobs, daysAhead])

  const totalJobs = sections.reduce((n, s) => n + s.jobs.length, 0)

  return (
    <section aria-label="Upcoming ship dates">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
        Upcoming ship dates
        <span className="text-slate-600 font-normal normal-case tracking-normal">
          {' '}
          — next {daysAhead} days
        </span>
      </h2>
      {activeUser && (activeUser.role === 'pm' || activeUser.role === 'materials') && (
        <p className="text-xs text-slate-500 mb-3">
          Tap a job to scroll to it in the list above. Yours are highlighted.
        </p>
      )}

      {totalJobs === 0 ? (
        <p className="text-sm text-slate-500 py-4">No ship dates in the next {daysAhead} days.</p>
      ) : (
        <div className="space-y-4 pb-4">
          {sections.map((section) => (
            <div key={section.dateKey}>
              <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </h3>
              <div className="space-y-1">
                {section.jobs.map((job) => {
                  const mine = isUsersJob(job, activeUser)
                  const accent = config.statusColors[job.status]
                  return (
                    <button
                      key={job.jobNumber}
                      type="button"
                      onClick={() => onSelectJob(job.jobNumber)}
                      className={`w-full flex items-stretch gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        mine
                          ? 'bg-blue-500/10 ring-1 ring-blue-500/30 hover:bg-blue-500/15'
                          : 'hover:bg-slate-800/80'
                      }`}
                    >
                      <span
                        className="w-1 flex-shrink-0 rounded-full self-stretch"
                        style={{ backgroundColor: accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">
                            {job.jobNumber}
                          </span>
                          {mine && (
                            <span className="shrink-0 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                              Yours
                            </span>
                          )}
                          {job.isNew && (
                            <span className="shrink-0 text-[10px] font-bold uppercase text-red-400">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {[job.customer, statusLabel(job.status)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default BoardShipAgenda
