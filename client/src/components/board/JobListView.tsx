import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useBoardJobs, useBoardConfig, useBoardUsers, useUpdateBoardConfig } from '../../hooks/useBoard'
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
  const { users } = useBoardUsers()
  const updateConfig = useUpdateBoardConfig()
  const { activeUser } = useAppStore()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAll, setShowAll] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [spareGearOpen, setSpareGearOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pre-populate search from ?job= param set by calendar event click
  useEffect(() => {
    const jobParam = searchParams.get('job')
    if (jobParam) {
      setInputValue(jobParam)
      setSearch(jobParam)
      setSearchParams({}, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch fresh data whenever the active user changes
  // (local state resets are handled by key={activeUser?.id} on the route)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['board'] })
  }, [activeUser?.id])

  // Scroll to top before paint whenever the committed search changes
  useLayoutEffect(() => {
    const el = document.getElementById('board-scroll')
    if (el) el.scrollTop = 0
  }, [search])

  // Close gear popover on outside click
  useEffect(() => {
    if (!spareGearOpen) return
    const handler = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setSpareGearOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [spareGearOpen])

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
  const pmUsers = users.filter((u) => u.role === 'pm')

  // Step 1: tab filter — spare-parts always filters by spare carrier (even super user)
  let tabFiltered: BoardJob[]
  if (tab === 'spare-parts') {
    tabFiltered = jobs.filter((j) => norm(j.pm) === spare)
  } else if (isSuper) {
    tabFiltered = jobs
  } else {
    tabFiltered = jobs.filter((j) => norm(j.pm) !== spare)
  }

  // Step 2: user filter (spare-parts tab always shows all spare jobs unfiltered)
  let filtered: BoardJob[]
  if (tab === 'spare-parts' || !activeUser || isSuper || showAll || activeUser.role === 'manual') {
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

  const canToggle = tab !== 'spare-parts' && !!activeUser && !isSuper && activeUser.role !== 'manual'
  const spareNotConfigured = tab === 'spare-parts' && !spare

  return (
    <div>
      {/* Sticky search bar */}
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

          {/* Gear icon — only on spare-parts tab */}
          {tab === 'spare-parts' && (
            <div ref={gearRef} className="relative">
              <button
                type="button"
                onClick={() => setSpareGearOpen((o) => !o)}
                title="Change Spare Parts PM"
                className={`p-2 rounded-lg border transition-colors ${
                  spareGearOpen || spareNotConfigured
                    ? 'bg-slate-700 border-slate-500 text-slate-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                {/* gear SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>

              {/* Popover */}
              {spareGearOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-30 p-4">
                  <p className="text-slate-300 text-sm font-medium mb-3">Spare Parts Manager</p>
                  <p className="text-slate-500 text-xs mb-3">
                    Jobs assigned to this PM appear in the Spare Parts tab for all users.
                  </p>
                  <select
                    value={config.spareCarrier}
                    onChange={(e) => {
                      updateConfig.mutate(
                        { spareCarrier: e.target.value.trim().toLowerCase() },
                        { onSuccess: () => setSpareGearOpen(false) }
                      )
                    }}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">— Not set —</option>
                    {pmUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}{norm(u.name) === spare ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                  {spareNotConfigured && (
                    <p className="text-amber-400 text-xs mt-2">⚠ No PM selected — Spare Parts tab will be empty.</p>
                  )}
                </div>
              )}
            </div>
          )}
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
        <p className="text-slate-500 text-sm mt-2">
          {spareNotConfigured ? 'Click the gear ⚙ above to set a Spare Parts PM.' : 'No jobs found.'}
        </p>
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
