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

  if (isLoading) {
    return (
      <div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-slate-800 rounded-xl h-32 mb-3"
          />
        ))}
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        No jobs imported yet. Go to the{' '}
        <Link to="/board/users" className="text-blue-400 hover:text-blue-300 underline">
          Users tab
        </Link>{' '}
        to import an XLSM file.
      </p>
    )
  }

  // Filter
  let filtered: BoardJob[]
  if (activeUser?.name === config.superUser) {
    filtered = jobs
  } else if (tab === 'spare-parts') {
    filtered = jobs.filter((j) => j.pm === config.spareCarrier)
  } else {
    filtered = jobs.filter((j) => j.pm !== config.spareCarrier)
  }

  // Sort by effectiveShipDate asc, null dates to the end
  const sorted = [...filtered].sort((a, b) => {
    if (!a.effectiveShipDate && !b.effectiveShipDate) return 0
    if (!a.effectiveShipDate) return 1
    if (!b.effectiveShipDate) return -1
    return a.effectiveShipDate.localeCompare(b.effectiveShipDate)
  })

  if (sorted.length === 0) {
    return <p className="text-slate-500 text-sm">No jobs in this category.</p>
  }

  return (
    <div>
      <p className="text-slate-500 text-sm mb-4">
        {sorted.length} job{sorted.length !== 1 ? 's' : ''} &middot; sorted by ship date
      </p>
      {sorted.map((job) => (
        <JobCard key={job.jobNumber} job={job} activeUser={activeUser} config={config} />
      ))}
    </div>
  )
}
