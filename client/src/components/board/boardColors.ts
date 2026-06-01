import { JobStatus, STATUS_ORDER, BoardJob, BoardConfig, DEFAULT_BOARD_CONFIG } from '../../types/board'

export function worstStatus(jobs: BoardJob[]): JobStatus {
  const filtered = jobs.filter(job => job.status !== 'none')

  if (filtered.length === 0) {
    return 'none'
  }

  return filtered.reduce((worst, current) => {
    const worstIndex = STATUS_ORDER.indexOf(worst)
    const currentIndex = STATUS_ORDER.indexOf(current.status)
    return currentIndex < worstIndex ? current.status : worst
  }, 'none')
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
