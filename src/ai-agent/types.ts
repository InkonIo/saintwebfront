export type AgentStep = 'idle' | 'branch' | 'template' | 'employees' | 'schedule' | 'submit' | 'done' | 'chat'

export interface AgentMessage {
  id: string
  role: 'ai' | 'user' | 'system'
  text: string
  timestamp: Date
  action?: AgentAction
}

export interface AgentAction {
  type: 'confirm_branch' | 'confirm_template' | 'confirm_employees' | 'confirm_schedule' | 'confirm_submit'
  data: unknown
}

export interface BranchDraft {
  name: string
  address: string
}

export interface TemplateDraft {
  name: string
  description: string
}

export interface EmployeeDraft {
  firstName: string
  lastName: string
  position: string
}

export interface ScheduleDraft {
  month: number
  year: number
  branchId: number
  templateId: number
}

export interface AgentState {
  step: AgentStep
  messages: AgentMessage[]
  apiKey: string
  branchDraft: BranchDraft | null
  templateDraft: TemplateDraft | null
  employeeDrafts: EmployeeDraft[]
  scheduleDraft: ScheduleDraft | null
  createdBranchId: number | null
  createdTemplateId: number | null
  createdScheduleId: number | null
  isLoading: boolean
}