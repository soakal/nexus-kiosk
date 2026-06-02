import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')

  // Redirect to Users tab if no user selected
  useEffect(() => {
    if (!isLoading && !activeUser) {
      navigate('/board/users', { state: { selectPrompt: true } })
    }
  }, [activeUser, isLoading, navigate])

  // Reset filters whenever the active user changes
  useEffect(() => { setShowAll(false); setSearch('') }, [activeUser?.id])

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

  // Step 3: apply search filter
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
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search job #, customer, or PM…"
        className="w-full mb-3 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
      />

      {/* Count + toggle row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-500 text-sm">
          {sorted.length} job{sorted.length !== 1 ? 's' : ''} &middot; sorted by ship date
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

      {sorted.length === 0 ? (
        <p className="text-slate-500 text-sm">No jobs found.</p>
      ) : (
        sorted.map((job) => (
          <JobCard key={job.jobNumber} job={job} activeUser={activeUser} config={config} />
        ))
      )}
    </div>
  )
}

export default JobListView
