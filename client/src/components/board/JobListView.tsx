import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBoardJobs, useBoardConfig } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { JobCard } from './JobCard'
import { BoardJob } from '../../types/board'

interface Props {
  tab: 'project' | 'spare-parts'
}

export function JobListView({ tab }: Props) {
  const { jobs, isLoading } = useBoardJobs()
  const { config } = useBoardConfig()
  const { activeUser } = useAppStore()
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')
  const listTopRef = useRef<HTMLDivElement>(null)

  // Reset filters whenever the active user changes
  useEffect(() => { setShowAll(false); setSearch('') }, [activeUser?.id])

  // Scroll the list container to the top whenever the search term changes, so
  // the first matching result is visible without the user having to scroll up.
  // useLayoutEffect runs after the DOM is updated (filtered/shorter list) but
  // before paint, so the scroll reset is applied against the new content height.
  useLayoutEffect(() => {
    const scrollParent = listTopRef.current?.closest('main') as HTMLElement | null
    if (scrollParent) scrollParent.scrollTo({ top: 0 })
  }, [search])

  if (isLoading) {
    return (
      <div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-slate-800 rounded-xl h-32 mb-3" />
        ))}
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        No jobs imported yet. Go to the{' '}
        <Link to="/board/import" className="text-blue-400 hover:text-blue-300 underline">
          Import tab
        </Link>{' '}
        to upload an XLSM file.
      </p>
    )
  }

  const isSuper = activeUser?.name === config.superUser

  // Step 1: apply tab filter (super user bypasses — sees all jobs in both tabs)
  let tabFiltered: BoardJob[]
  if (isSuper) {
    tabFiltered = jobs
  } else if (tab === 'spare-parts') {
    tabFiltered = jobs.filter((j) => j.pm === config.spareCarrier)
  } else {
    tabFiltered = jobs.filter((j) => j.pm !== config.spareCarrier)
  }

  // Step 2: apply user filter
  let filtered: BoardJob[]
  if (!activeUser || isSuper || showAll || activeUser.role === 'manual') {
    filtered = tabFiltered
  } else if (activeUser.role === 'pm') {
    filtered = tabFiltered.filter((j) => j.pm === activeUser.name)
  } else if (activeUser.role === 'materials') {
    filtered = tabFiltered.filter((j) => j.materialsManager === activeUser.name)
  } else {
    filtered = tabFiltered
  }

  // Step 3: apply search filter (job#, customer, pm)
  const q = search.trim().toLowerCase()
  const searched = q
    ? filtered.filter((j) =>
        j.jobNumber.toLowerCase().includes(q) ||
        j.customer.toLowerCase().includes(q) ||
        j.pm.toLowerCase().includes(q)
      )
    : filtered

  // Sort by effectiveShipDate asc, null dates to the end
  const sorted = [...searched].sort((a, b) => {
    if (!a.effectiveShipDate && !b.effectiveShipDate) return 0
    if (!a.effectiveShipDate) return 1
    if (!b.effectiveShipDate) return -1
    return a.effectiveShipDate.localeCompare(b.effectiveShipDate)
  })

  const canToggle = !!activeUser && !isSuper && activeUser.role !== 'manual'

  return (
    <div ref={listTopRef}>
      {/* Sticky search + controls bar.
          -mt-6 + pt-6 pulls the bar up over <main>'s py-6 top padding so cards
          scrolling underneath are fully masked by the bar's background. */}
      <div className="sticky top-0 z-10 bg-[#0f1117] -mt-6 pt-6 pb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job #, customer, or PM…"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />

        <div className="flex items-center justify-between mt-2">
          <p className="text-slate-500 text-sm">
            {sorted.length} job{sorted.length !== 1 ? 's' : ''}
            {q ? ` matching "${search.trim()}"` : ' · sorted by ship date'}
          </p>
          {canToggle && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  !showAll ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                My Jobs
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  showAll ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Jobs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Job list */}
      {sorted.length === 0 ? (
        <p className="text-slate-500 text-sm mt-2">No jobs found.</p>
      ) : (
        sorted.map((job) => (
          <JobCard key={job.jobNumber} job={job} activeUser={activeUser} config={config} />
        ))
      )}
    </div>
  )
}

export default JobListView
