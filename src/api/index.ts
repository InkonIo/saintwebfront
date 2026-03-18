// const BASE_URL = 'https://examweb.up.railway.app/api/v1'

const BASE_URL = 'http://localhost:8080/api/v1'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

export interface RegisterPayload {
  username: string
  email: string
  password: string
  role: 'MANAGER' | 'REVIEWER'
}

export interface LoginPayload {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
  username: string
  email: string
  role: string
}

export interface ScheduleShort {
  id: number
  branchId: number
  branchName: string
  month: number
  year: number
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REVISION' | 'ARCHIVED'
  version: number
  authorUsername: string
  createdAt: string
  updatedAt: string
}

export interface ScheduleEntry {
  id: number
  employeeId: number
  employeeFirstName: string
  employeeLastName: string
  workDate: string
  shiftType: string
}

export interface ScheduleFull extends ScheduleShort {
  templateId: number
  templateName: string
  entries: ScheduleEntry[]
}

export interface ScheduleVersion {
  id: number
  versionNumber: number
  changedByUsername: string
  changedAt: string
  status: string
  comment: string
}

export interface CreateSchedulePayload {
  branchId: number
  templateId: number
  month: number
  year: number
}

export interface UpdateEntriesPayload {
  entries: { employeeId: number; workDate: string; shiftType: string }[]
}

export interface Branch {
  id: number
  name: string
  address: string
  createdAt: string
  updatedAt: string
}

export interface Template {
  id: number
  name: string
  description: string
  createdAt: string
}

export interface Notification {
  id: number
  type: string
  message: string
  isRead: boolean
  createdAt: string
  schedule?: { id: number }
}

export interface AuditLog {
  id: number
  username: string
  userRole: string
  action: string
  entityType: string
  entityId: number
  details: string
  ipAddress: string
  createdAt: string
}

export const api = {
  // Auth
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Registration failed')
    return res.json()
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Login failed')
    return res.json()
  },

  // Schedules
  getSchedules: async (): Promise<ScheduleShort[]> => {
    const res = await fetch(`${BASE_URL}/schedules`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch schedules')
    return res.json()
  },

  getScheduleById: async (id: number): Promise<ScheduleFull> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch schedule')
    return res.json()
  },

  getScheduleVersions: async (id: number): Promise<ScheduleVersion[]> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/versions`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch versions')
    return res.json()
  },

  getSchedulesByBranch: async (branchId: number): Promise<ScheduleShort[]> => {
    const res = await fetch(`${BASE_URL}/schedules/branch/${branchId}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch branch schedules')
    return res.json()
  },

  createSchedule: async (payload: CreateSchedulePayload): Promise<ScheduleFull> => {
    const res = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create schedule')
    return res.json()
  },

  submitSchedule: async (id: number): Promise<ScheduleShort> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/submit`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to submit')
    return res.json()
  },

  approveSchedule: async (id: number): Promise<ScheduleShort> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to approve')
    return res.json()
  },

  revisionSchedule: async (id: number, comment: string): Promise<ScheduleShort> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/revision`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ comment }),
    })
    if (!res.ok) throw new Error('Failed to revision')
    return res.json()
  },

  archiveSchedule: async (id: number): Promise<ScheduleShort> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/archive`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to archive')
    return res.json()
  },

  updateEntries: async (id: number, payload: UpdateEntriesPayload): Promise<ScheduleFull> => {
    const res = await fetch(`${BASE_URL}/schedules/${id}/entries`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to update entries')
    return res.json()
  },

  // Branches
  getBranches: async (): Promise<Branch[]> => {
    const res = await fetch(`${BASE_URL}/branches`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch branches')
    return res.json()
  },

  createBranch: async (payload: { name: string; address: string }): Promise<Branch> => {
    const res = await fetch(`${BASE_URL}/branches`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create branch')
    return res.json()
  },

  updateBranch: async (id: number, payload: { name: string; address: string }): Promise<Branch> => {
    const res = await fetch(`${BASE_URL}/branches/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to update branch')
    return res.json()
  },

  deleteBranch: async (id: number): Promise<void> => {
    const res = await fetch(`${BASE_URL}/branches/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete branch')
  },

  // Templates
  getTemplates: async (): Promise<Template[]> => {
    const res = await fetch(`${BASE_URL}/templates`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch templates')
    return res.json()
  },

  createTemplate: async (payload: { name: string; description: string }): Promise<Template> => {
    const res = await fetch(`${BASE_URL}/templates`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create template')
    return res.json()
  },

  deleteTemplate: async (id: number): Promise<void> => {
    const res = await fetch(`${BASE_URL}/templates/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete template')
  },

// Notifications
getNotifications: async () => {
  const res = await fetch(`${BASE_URL}/notifications`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch notifications')
  return res.json()
},

getUnreadCount: async (): Promise<number> => {
  const res = await fetch(`${BASE_URL}/notifications/unread-count`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch unread count')
  return res.json()
},

markAllRead: async (): Promise<void> => {
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to mark as read')
},

getAuditLogs: async (): Promise<AuditLog[]> => {
  const res = await fetch(`${BASE_URL}/audit`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch audit')
  return res.json()
},

getAuditBySchedule: async (scheduleId: number): Promise<AuditLog[]> => {
  const res = await fetch(`${BASE_URL}/audit/schedule/${scheduleId}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch audit')
  return res.json()
},

  // Password Reset
  forgotPassword: async (email: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) throw new Error('Failed to send code')
  },

  verifyCode: async (email: string, code: string): Promise<string> => {
    const res = await fetch(`${BASE_URL}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) throw new Error('Invalid code')
    const data = await res.json()
    return data.token
  },

  resetPassword: async (resetToken: string, newPassword: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    })
    if (!res.ok) throw new Error('Failed to reset password')
  },
}

