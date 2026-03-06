import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentRoute } from '@/routes/index'
import { BrowserRouter, Route, Routes } from 'react-router'

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route path="/*" element={<AgentRoute />} />
        </Routes>
        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  )
}
