import { Outlet } from 'react-router-dom'
import { BoardHeader } from './BoardHeader'

export function BoardLayout() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <BoardHeader />
      <main className="max-w-7xl mx-auto px-4 py-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
