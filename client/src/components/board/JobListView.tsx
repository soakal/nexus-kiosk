import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBoardJobs, useBoardConfig } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { JobCard } from './JobCard'
import { BoardJob } from '../../types/board'

interface Props {
  tab: 'project' | 'spare-parts'
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export function JobListView({ tab }: Props) {
  const { jobs, isLoading } = useBoardJobs()
  const { config } = useBoardConfig()
  const { activeUser } = useAppStore()
  const [showAll, setShowAll] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset filters whenever the active user changes
  useEffect(() => {
    setShowAll(false)
    setInputValue('')
    setSearch('')
  }, [activeUser?.id])

  // Scroll to top before paint whenever the committed search changes
  useLayoutEffect(() => {
    const el = document.getElementById('board-scroll')
    if (el) el.scrollTop = 0
  }, [search])

  const commitSearch = () => setSearch(inputValue)

  const clearSearch = () => {
    setInputValue('')
    setSearch('')
    inputRef.current?.focus()
  }

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

  const spare = norm(config.spareCarrier)
  const isSuper = !!config.superUser && norm(activeUser?.name) === norm(config.superUser)

  // Step 1: tab filter (super user bypasses — sees all jobs in both tabs)
  let tabFiltered: BoardJob[]
  if (isSuper) {
    tabFiltered = jobs
  } else if (tab === 'spare-parts') {
    tabFiltered = jobs.filter((j) => norm(j.pm) === spare)
  } else {
    tabFiltered = jobs.filter((j) => norm(j.pm) !== spare)
  }

  // Step 2: user filter
  let filtered: BoardJob[]
  if (!activeUser || isSuper || showAll || activeUser.role === 'manual') {
    filtered = tabFiltered
  } else if (activeUser.role === 'pm') {
    filtered = tabFiltered.filter((j) => norm(j.pm) === norm(activeUser.name))
  } else if (activeUser.role === 'materials') {
    filtered = tabFiltered.filter((j) => norm(j.materialsManager) === norm(activeUser.name))
  } else {
    filtered = tabFiltered
  }

  // Step 3: committed search filter (job#, customer, pm)
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
    <div>
      {/* Sticky search bar — pt-6 provides the top spacing (main has no top padding) */}
      <div className="sticky top-0 z-20 bg-[#0f1117] pt-6 pb-3 mb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
              placeholder="Search job number, customer, or PM…"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            {inputValue && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-lg leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={commitSearch}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shrink-0"
          >
            Search
          </button>
        </div>

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

      {/* key={search} forces the list to remount on every committed search */}
      {sorted.length === 0 ? (
        <p className="text-slate-500 text-sm mt-2">No jobs found.</p>
      ) : (
        <div key={search}>
          {sorted.map((job) => (
            <JobCard key={job.jobNumber} job={job} activeUser={activeUser} config={config} />
          ))}
        </div>
      )}
    </div>
  )
}

export default JobListView
