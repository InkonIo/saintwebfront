import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/login/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Branches from './pages/branches/Branches'
import Schedules from './pages/schedules/Schedules'
import Templates from './pages/templates/Templates'
import ScheduleDetail from './pages/schedules/ScheduleDetail'
import Audit from './pages/audit/audit'
import Employees from './pages/employees/Employees'
import MySchedule from './pages/my-schedule/MySchedule'
import AiAgent from './ai-agent/AiAgent'
import type { JSX } from 'react'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

function EmployeeRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'EMPLOYEE') return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/branches" element={<PrivateRoute><Branches /></PrivateRoute>} />
        <Route path="/employees" element={<PrivateRoute><Employees /></PrivateRoute>} />
        <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
        <Route path="/schedules/:id" element={<PrivateRoute><ScheduleDetail /></PrivateRoute>} />
        <Route path="/templates" element={<PrivateRoute><Templates /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute><Audit /></PrivateRoute>} />
        <Route path="/my-schedule" element={<EmployeeRoute><MySchedule /></EmployeeRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <AiAgent />
    </BrowserRouter>
  )
}

export default App