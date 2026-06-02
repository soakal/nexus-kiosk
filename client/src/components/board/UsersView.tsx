import { useState, useEffect } from 'react'
import { useBoardUsers, useBoardConfig, useUpdateBoardConfig } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { JobStatus, BoardUser, DEFAULT_BOARD_CONFIG } from '../../types/board'
import { statusLabel } from './boardColors'

const STATUS_LIST: JobStatus[] = ['none', 'in_progress', 'ready_to_ship', 'shipped']

function roleLabel(role: BoardUser['role']): string {
  switch (role) {
    case 'pm':       return 'PM'
    case 'materials': return 'Materials'
    case 'super':    return 'Super User'
    case 'manual':   return 'Extra'
    default:         return role
  }
}

export default function UsersView() {
  const { users } = useBoardUsers()
  const { config } = useBoardConfig()
  const updateConfig = useUpdateBoardConfig()

  const activeUser = useAppStore((s) => s.activeUser)
  const setActiveUser = useAppStore((s) => s.setActiveUser)

  // ── color state ───────────────────────────────────────────────────────────
  const [localColors, setLocalColors] = useState<Record<JobStatus, string>>(
    () => ({ ...DEFAULT_BOARD_CONFIG.statusColors, ...config.statusColors })
  )

  // Sync localColors when config loads / changes
  useEffect(() => {
    setLocalColors({ ...DEFAULT_BOARD_CONFIG.statusColors, ...config.statusColors })
  }, [config.statusColors])

  const [savedFlash, setSavedFlash] = useState(false)

  const handleSaveColors = () => {
    updateConfig.mutate(
      { statusColors: localColors },
      {
        onSuccess: () => {
          setSavedFlash(true)
          setTimeout(() => setSavedFlash(false), 2000)
        },
      }
    )
  }

  return (
    <div className="divide-y divide-slate-800">

      {/* ── Section 1: Who are you? ─────────────────────────────────────────── */}
      <div className="py-4 px-1">
        <h3 className="text-slate-300 font-semibold text-sm mb-3">Who are you?</h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {users.map((user) => {
            const isSelected = activeUser?.id === user.id
            return (
              <button
                key={user.id}
                onClick={() => setActiveUser(user)}
                className={[
                  'bg-slate-800 rounded-lg p-3 cursor-pointer border-2 text-left transition-colors',
                  isSelected
                    ? 'border-blue-500'
                    : 'border-transparent hover:border-slate-600',
                ].join(' ')}
              >
                <p className="font-medium text-slate-200 text-sm">{user.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{roleLabel(user.role)}</p>
                {user.role === 'super' && (
                  <p className="text-amber-400 text-xs mt-1">👁 Sees everything</p>
                )}
              </button>
            )
          })}
        </div>

        {activeUser && (
          <div className="mt-3">
            <button
              onClick={() => setActiveUser(null)}
              className="text-slate-500 hover:text-slate-300 text-xs border border-slate-700 rounded px-3 py-1 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: Tab Status Colors ──────────────────────────────────────── */}
      <div className="py-4 px-1">
        <h3 className="text-slate-300 font-semibold text-sm mb-3">Tab Status Colors</h3>

        <div className="flex flex-col gap-2 mb-3">
          {STATUS_LIST.map((status) => (
            <div key={status} className="flex items-center gap-3">
              <span className="text-slate-400 text-sm w-32 shrink-0">
                {statusLabel(status)}
              </span>
              <div
                className="w-6 h-6 rounded border border-slate-700 shrink-0"
                style={{ backgroundColor: localColors[status] }}
              />
              <input
                type="color"
                value={localColors[status]}
                onChange={(e) =>
                  setLocalColors((prev) => ({ ...prev, [status]: e.target.value }))
                }
                className="w-8 h-6 cursor-pointer rounded border-0 bg-transparent p-0"
                title={`Color for ${statusLabel(status)}`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveColors}
            disabled={updateConfig.isPending}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
          >
            {updateConfig.isPending ? 'Saving...' : 'Save Colors'}
          </button>
          {savedFlash && (
            <span className="text-green-400 text-xs">Saved!</span>
          )}
        </div>
      </div>

    </div>
  )
}
