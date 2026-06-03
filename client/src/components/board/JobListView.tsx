import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useBoardJobs, useBoardConfig, useBoardUsers, useUpdateBoardConfig } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { JobCard } from './JobCard'
import { filterJobsForTab, sortBoardJobsByShipDate } from './boardColors'
import { BoardJob } from '../../types/board'

interface Props {
  tab: 'project' | 'spare-parts' | 'archive'
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

function loadFilterList(key: string): string[] {
  const raw = sessionStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string' && x.trim()).map((x) => x.trim())
    }
  } catch {
    return raw.trim() ? [raw.trim()] : []
  }
  return []
}

function isSelected(selected: string[], name: string): boolean {
  return selected.some((s) => norm(s) === norm(name))
}

function PersonMultiSelect({
  label,
  names,
  selected,
  onChange,
}: {
  label: string
  names: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (names.length === 0) return null

  const toggle = (name: string) => {
    if (isSelected(selected, name)) {
      onChange(selected.filter((s) => norm(s) !== norm(name)))
    } else {
      onChange([...selected, name])
    }
  }

  const buttonLabel =
    selected.length === 0
      ? 'All'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <label className="text-slate-500 text-xs block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
          selected.length > 0
            ? 'bg-blue-600/20 border-blue-500/50 text-slate-100'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate text-left">{buttonLabel}</span>
        <span className="text-slate-500 shrink-0">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:right-auto sm:min-w-[16rem] top-full mt-1 z-40 max-h-64 overflow-y-auto rounded-xl border border-slate-600 bg-slate-800 shadow-xl py-1">
          <button
            type="button"
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-700/80 hover:text-slate-200"
          >
            Clear all
          </button>
          <div className="border-t border-slate-700/80 my-1" />
          {names.map((name) => {
            const checked = isSelected(selected, name)
            return (
              <label
                key={name}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700/60 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(name)}
                  className="rounded border-slate-500 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="truncate" title={name}>
                  {name}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function JobListView({ tab }: Props) {
  const { jobs, isLoading } = useBoardJobs()
  const { config } = useBoardConfig()
  const { users } = useBoardUsers()
  const updateConfig = useUpdateBoardConfig()
  const { activeUser } = useAppStore()
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAll, setShowAll] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [filterPms, setFilterPms] = useState<string[]>([])
  const [filterMms, setFilterMms] = useState<string[]>([])
  const [scrollToJobNumber, setScrollToJobNumber] = useState<string | null>(null)
  const [spareGearOpen, setSpareGearOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressScrollReset = useRef(false)

  // Session storage keys scoped to tab + user so tabs and users are independent
  const userId = activeUser?.id ?? 'none'
  const scrollKey = `board-scroll-${tab}-${userId}`
  const searchKey = `board-search-${tab}-${userId}`
  const showAllKey = `board-showall-${tab}-${userId}`
  const filterPmKey = `board-filter-pm-${tab}-${userId}`
  const filterMmKey = `board-filter-mm-${tab}-${userId}`

  // Restore scroll + search + showAll on mount; ?job= param takes priority over saved state
  useEffect(() => {
    const jobParam = searchParams.get('job')
    if (jobParam) {
      setInputValue(jobParam)
      setSearch(jobParam)
      setSearchParams({}, { replace: true })
      return
    }
    const savedSearch = sessionStorage.getItem(searchKey) ?? ''
    const savedShowAll = sessionStorage.getItem(showAllKey) === 'true'
    const savedFilterPm = loadFilterList(filterPmKey)
    const savedFilterMm = loadFilterList(filterMmKey)
    if (savedSearch) {
      suppressScrollReset.current = true
      setInputValue(savedSearch)
      setSearch(savedSearch)
    }
    if (savedShowAll) setShowAll(true)
    if (savedFilterPm.length) setFilterPms(savedFilterPm)
    if (savedFilterMm.length) setFilterMms(savedFilterMm)
    const savedScroll = sessionStorage.getItem(scrollKey)
    if (savedScroll) {
      // Delay so the restored search + rendered list settle before scrolling
      const t = setTimeout(() => {
        const el = document.getElementById('board-scroll')
        if (el) el.scrollTop = Number(savedScroll)
      }, 120)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist search when committed
  useEffect(() => {
    sessionStorage.setItem(searchKey, search)
  }, [search, searchKey])

  // Persist showAll
  useEffect(() => {
    sessionStorage.setItem(showAllKey, String(showAll))
  }, [showAll, showAllKey])

  useEffect(() => {
    if (filterPms.length) sessionStorage.setItem(filterPmKey, JSON.stringify(filterPms))
    else sessionStorage.removeItem(filterPmKey)
  }, [filterPms, filterPmKey])

  useEffect(() => {
    if (filterMms.length) sessionStorage.setItem(filterMmKey, JSON.stringify(filterMms))
    else sessionStorage.removeItem(filterMmKey)
  }, [filterMms, filterMmKey])

  // Persist scroll position
  useEffect(() => {
    const el = document.getElementById('board-scroll')
    if (!el) return
    const onScroll = () => sessionStorage.setItem(scrollKey, String(el.scrollTop))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollKey])

  // Refetch when user or tab changes (local state resets via route key)
  useEffect(() => {
    void queryClient.refetchQueries({ queryKey: ['board', 'jobs'] })
  }, [activeUser?.id, location.pathname, queryClient])

  // Scroll to top on new committed search (suppressed when restoring saved search)
  useLayoutEffect(() => {
    if (suppressScrollReset.current) { suppressScrollReset.current = false; return }
    const el = document.getElementById('board-scroll')
    if (el) el.scrollTop = 0
  }, [search])

  // Scroll to a job card after PM/MM filter (from chip row or card bubble)
  useLayoutEffect(() => {
    if (!scrollToJobNumber) return
    const t = setTimeout(() => {
      const el = document.getElementById(`job-card-${scrollToJobNumber}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToJobNumber(null)
    }, 80)
    return () => clearTimeout(t)
  }, [scrollToJobNumber, filterPms, filterMms, search])

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

  const tabFiltered = filterJobsForTab(jobs, tab, config)

  const uniquePms = Array.from(
    new Set(tabFiltered.map((j) => j.pm.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const uniqueMms = Array.from(
    new Set(tabFiltered.map((j) => j.materialsManager.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const showPersonFilters = tab !== 'archive'
  const personFilterActive = filterPms.length > 0 || filterMms.length > 0

  const toggleProjectManager = (name: string, anchorJobNumber?: string) => {
    setFilterPms((prev) => {
      if (isSelected(prev, name)) return prev.filter((s) => norm(s) !== norm(name))
      return [...prev, name]
    })
    if (anchorJobNumber) setScrollToJobNumber(anchorJobNumber)
  }

  const toggleMaterialsManager = (name: string, anchorJobNumber?: string) => {
    setFilterMms((prev) => {
      if (isSelected(prev, name)) return prev.filter((s) => norm(s) !== norm(name))
      return [...prev, name]
    })
    if (anchorJobNumber) setScrollToJobNumber(anchorJobNumber)
  }

  // Quick filters — match any selected PM and any selected MM (both apply when set)
  let quickFiltered = tabFiltered
  if (filterPms.length > 0) {
    quickFiltered = quickFiltered.filter((j) =>
      filterPms.some((n) => norm(j.pm) === norm(n)),
    )
  }
  if (filterMms.length > 0) {
    quickFiltered = quickFiltered.filter((j) =>
      filterMms.some((n) => norm(j.materialsManager) === norm(n)),
    )
  }

  if (tab === 'archive' && tabFiltered.length === 0) {
    return (
      <p className="text-slate-500 text-sm mt-6">
        No archived jobs yet. Jobs marked as <span className="text-green-400">Shipped</span> will appear here.
      </p>
    )
  }

  // Role filter — skipped when a Project Manager / Materials Manager quick filter is active
  let filtered: BoardJob[]
  if (
    tab === 'spare-parts' ||
    tab === 'archive' ||
    !activeUser ||
    isSuper ||
    showAll ||
    activeUser.role === 'manual' ||
    personFilterActive
  ) {
    filtered = quickFiltered
  } else if (activeUser.role === 'pm') {
    filtered = quickFiltered.filter((j) => norm(j.pm) === norm(activeUser.name))
  } else if (activeUser.role === 'materials') {
    filtered = quickFiltered.filter((j) => norm(j.materialsManager) === norm(activeUser.name))
  } else {
    filtered = quickFiltered
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

  const sorted = sortBoardJobsByShipDate(searched, tab)

  const canToggle = tab !== 'spare-parts' && tab !== 'archive' && !!activeUser && !isSuper && activeUser.role !== 'manual'
  const spareNotConfigured = tab === 'spare-parts' && !spare

  const filterSummary = (() => {
    const parts: string[] = []
    if (filterPms.length === 1) parts.push(`Project Manager: ${filterPms[0]}`)
    else if (filterPms.length > 1) parts.push(`${filterPms.length} Project Managers`)
    if (filterMms.length === 1) parts.push(`Materials Manager: ${filterMms[0]}`)
    else if (filterMms.length > 1) parts.push(`${filterMms.length} Materials Managers`)
    return parts.length ? ` · ${parts.join(' · ')}` : ''
  })()

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#0f1117] pt-6 pb-3 mb-3">
        {/* Row 1: Project Manager + Materials Manager filters (top, side by side) */}
        {showPersonFilters && (
          <div className="mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PersonMultiSelect
                label="Project Manager"
                names={uniquePms}
                selected={filterPms}
                onChange={setFilterPms}
              />
              <PersonMultiSelect
                label="Materials Manager"
                names={uniqueMms}
                selected={filterMms}
                onChange={setFilterMms}
              />
            </div>
            {(filterPms.length > 0 || filterMms.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {filterPms.map((name) => (
                  <span
                    key={`pm-${name}`}
                    className="inline-flex items-center gap-1 max-w-full rounded-full bg-blue-600/25 border border-blue-500/40 px-2.5 py-0.5 text-xs text-slate-200"
                    title={name}
                  >
                    <span className="text-blue-300/90 shrink-0">PM</span>
                    <span className="truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => setFilterPms((prev) => prev.filter((s) => norm(s) !== norm(name)))}
                      className="text-slate-400 hover:text-white shrink-0 ml-0.5"
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filterMms.map((name) => (
                  <span
                    key={`mm-${name}`}
                    className="inline-flex items-center gap-1 max-w-full rounded-full bg-violet-600/20 border border-violet-500/40 px-2.5 py-0.5 text-xs text-slate-200"
                    title={name}
                  >
                    <span className="text-violet-300/90 shrink-0">MM</span>
                    <span className="truncate">{name}</span>
                    <button
                      type="button"
                      onClick={() => setFilterMms((prev) => prev.filter((s) => norm(s) !== norm(name)))}
                      className="text-slate-400 hover:text-white shrink-0 ml-0.5"
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Row 2: search */}
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
            {q
              ? ` matching "${search.trim()}"`
              : filterSummary
              || (tab === 'archive'
              ? ' · newest ship date first'
              : ' · soonest ship date first')}
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
            <JobCard
              key={job.jobNumber}
              job={job}
              activeUser={activeUser}
              config={config}
              onSelectProjectManager={(name) => toggleProjectManager(name, job.jobNumber)}
              onSelectMaterialsManager={(name) => toggleMaterialsManager(name, job.jobNumber)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default JobListView
