import { JobStatus, STATUS_ORDER, BoardJob, BoardConfig } from '../../types/board'

export function worstStatus(jobs: BoardJob[]): JobStatus {
  const filtered = jobs.filter(job => job.status !== 'none')

  if (filtered.length === 0) {
    return 'none'
  }

  return filtered.reduce<JobStatus>((worst, current) => {
    const worstIndex = STATUS_ORDER.indexOf(worst)
    const currentIndex = STATUS_ORDER.indexOf(current.status)
    return currentIndex < worstIndex ? current.status : worst
  }, 'shipped')
}

export function tabColor(jobs: BoardJob[], config: BoardConfig): string {
  return config.statusColors[worstStatus(jobs)]
}

export function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'none':
      return 'Not Started'
    case 'in_progress':
      return 'In Progress'
    case 'ready_to_ship':
      return 'Ready to Ship'
    case 'shipped':
      return 'Shipped'
    default:
      return ''
  }
}

export function statusIndex(status: JobStatus): number {
  return STATUS_ORDER.indexOf(status)
}

const normPm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * A job is a spare-parts job if its PM matches the configured spare carrier
 * OR its job number starts with 'sp' (case-insensitive). Shared by BoardHeader
 * (tab coloring/counts) and JobListView (list filtering) so they always agree.
 */
export function isSpareJob(job: BoardJob, config: BoardConfig): boolean {
  const spare = normPm(config.spareCarrier)
  return normPm(job.pm) === spare || job.jobNumber.toLowerCase().startsWith('sp')
}
