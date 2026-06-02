import { NavLink, Link } from 'react-router-dom'
import { useBoardJobs, useBoardConfig, useBoardUsers } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { tabColor } from './boardColors'

export function BoardHeader() {
  const { jobs } = useBoardJobs()
  const { config } = useBoardConfig()
  const { users } = useBoardUsers()
  const { activeUser, setActiveUser } = useAppStore()

  const projectJobs = jobs.filter((j) => j.pm !== config.spareCarrier)
  const spareJobs = jobs.filter((j) => j.pm === config.spareCarrier)

  const projectColor = tabColor(projectJobs, config)
  const spareColor = tabColor(spareJobs, config)
  const usersColor = '#3b82f6'

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) { setActiveUser(null); return }
    const user = users.find((u) => u.id === id)
    if (user) setActiveUser(user)
  }

  return (
    <header className="sticky top-0 z-50 bg-[#13171f] border-b border-slate-800">
      {/* Top row: logo + title + user switcher + back link */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <img
            src="/logos/vrsi-white-letters.png"
            alt="VRSI"
            className="h-6 w-auto opacity-90"
          />
          <span className="text-slate-300 text-sm ml-3 font-medium">Projects</span>
        </div>

        <div className="flex items-center gap-3">
          {/* User switcher dropdown */}
          <select
            value={activeUser?.id ?? ''}
            onChange={handleUserChange}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-slate-500 cursor-pointer"
          >
            <option value="">— Select user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <Link
            to="/"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>

      {/* Tabs row */}
      <div className="flex items-end gap-1 px-4">
        <NavLink
          to="/board"
          end
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-medium rounded-t transition-colors ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`
          }
          style={({ isActive }) =>
            isActive ? { borderBottom: `2px solid ${projectColor}`, backgroundColor: projectColor + '18' } : {}
          }
        >
          Project
        </NavLink>

        <NavLink
          to="/board/spare-parts"
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-medium rounded-t transition-colors ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`
          }
          style={({ isActive }) =>
            isActive ? { borderBottom: `2px solid ${spareColor}`, backgroundColor: spareColor + '18' } : {}
          }
        >
          Spare Parts
        </NavLink>

        <NavLink
          to="/board/users"
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-medium rounded-t transition-colors ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`
          }
          style={({ isActive }) =>
            isActive ? { borderBottom: `2px solid ${usersColor}`, backgroundColor: usersColor + '18' } : {}
          }
        >
          Users
        </NavLink>

        <NavLink
          to="/board/import"
          className={({ isActive }) =>
            `px-3 py-2 text-sm font-medium rounded-t transition-colors ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`
          }
          style={({ isActive }) =>
            isActive ? { borderBottom: '2px solid #6366f1', backgroundColor: '#6366f118' } : {}
          }
        >
          Import
        </NavLink>
      </div>
    </header>
  )
}
