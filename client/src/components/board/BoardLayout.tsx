import { Outlet } from 'react-router-dom'
import { BoardHeader } from './BoardHeader'

export function BoardLayout() {
  return (
    <div className="h-screen flex flex-col bg-[#0f1117] text-slate-200">
      <BoardHeader />
      <main id="board-scroll" className="flex-1 min-h-0 overflow-y-auto max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default BoardLayout
