import { NavLink, Link } from 'react-router-dom'
import { useBoardJobs, useBoardConfig } from '../../hooks/useBoard'
import { useAppStore } from '../../store/appStore'
import { tabColor } from './boardColors'

export function BoardHeader() {
  const { jobs } = useBoardJobs()
  const { config } = useBoardConfig()
  const { activeUser, setActiveUser } = useAppStore()

  const projectJobs = jobs.filter((j) => j.pm !== config.spareCarrier)
  const spareJobs = jobs.filter((j) => j.pm === config.spareCarrier)

  const projectColor = tabColor(projectJobs, config)
  const spareColor = tabColor(spareJobs, config)
  const usersColor = '#3b82f6'

  return (
    <header className="sticky top-0 z-50 bg-[#13171f] border-b border-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: logo + title */}
        <div className="flex items-center">
          <img
            src="/logos/vrsi-white-letters.png"
            alt="VRSI"
            className="h-6 w-auto opacity-90"
          />
          <span className="text-slate-300 text-sm ml-3 font-medium">Project Board</span>
        </div>

        {/* Center: tabs */}
        <nav className="flex items-end gap-1">
          <NavLink
            to="/board"
            end
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    borderBottom: `2px solid ${projectColor}`,
                    backgroundColor: projectColor + '18',
                  }
                : {}
            }
          >
            Project
          </NavLink>

          <NavLink
            to="/board/spare-parts"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    borderBottom: `2px solid ${spareColor}`,
                    backgroundColor: spareColor + '18',
                  }
                : {}
            }
          >
            Spare Parts
          </NavLink>

          <NavLink
            to="/board/users"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    borderBottom: `2px solid ${usersColor}`,
                    backgroundColor: usersColor + '18',
                  }
                : {}
            }
          >
            Users
          </NavLink>
        </nav>

        {/* Right: active user + dashboard link */}
        <div className="flex items-center">
          {activeUser ? (
            <span className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 border border-slate-700">
              Acting as: {activeUser.name}
              <button
                onClick={() => setActiveUser(null)}
                className="text-slate-500 hover:text-slate-200 transition-colors leading-none"
                aria-label="Clear active user"
              >
                &times;
              </button>
            </span>
          ) : (
            <span className="text-slate-600 text-xs">No user selected</span>
          )}
          <Link
            to="/"
            className="ml-4 text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>
    </header>
  )
}
