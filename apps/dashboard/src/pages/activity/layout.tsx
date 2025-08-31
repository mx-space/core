import { Outlet } from 'react-router'

export default function ActivityLayout() {
  return (
    <div className="min-h-[calc(100vh-64px)] p-6">
      <Outlet />
    </div>
  )
}
