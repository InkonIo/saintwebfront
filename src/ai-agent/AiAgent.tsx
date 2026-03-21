import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/index'
import styles from './aiAgent.module.css'
import type { AgentMessage, AgentState, BranchDraft, TemplateDraft, EmployeeDraft, ScheduleDraft, AgentStep } from './types'
import StepBranch from './steps/StepBranch'
import StepTemplate from './steps/StepTemplate'
import StepEmployees from './steps/StepEmployees'
import StepSchedule from './steps/StepSchedule'
import StepSubmit from './steps/StepSubmit'

const BASE_URL = 'http://localhost:8080/api/v1'
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const STEPS: { key: AgentStep; label: string; icon: string }[] = [
  { key: 'branch',    label: 'Филиал',   icon: '🏢' },
  { key: 'template',  label: 'Шаблон',   icon: '📋' },
  { key: 'employees', label: 'Люди',     icon: '👥' },
  { key: 'schedule',  label: 'График',   icon: '📅' },
  { key: 'submit',    label: 'Отправка', icon: '📤' },
]

const QUICK_ACTIONS = [
  { label: '🏢 Создать филиал',   intent: 'branch' },
  { label: '📋 Создать шаблон',   intent: 'template' },
  { label: '👥 Добавить людей',   intent: 'employees' },
  { label: '📅 Создать график',   intent: 'schedule' },
  { label: '🔄 Настроить с нуля', intent: 'full' },
]

function makeId() { return Math.random().toString(36).slice(2) }
function formatTime(d: Date) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const initialState: AgentState = {
  step: 'idle', messages: [], apiKey: '',
  branchDraft: null, templateDraft: null, employeeDrafts: [],
  scheduleDraft: null, createdBranchId: null, createdTemplateId: null,
  createdScheduleId: null, isLoading: false,
}

export default function AiAgent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const [state, setState] = useState<AgentState>(() => {
    try {
      const saved = localStorage.getItem('aiAgent_state')
      if (saved) {
        const parsed = JSON.parse(saved)
        parsed.messages = (parsed.messages || []).map((m: AgentMessage) => ({
          ...m, timestamp: new Date(m.timestamp),
        }))
        return { ...initialState, ...parsed, isLoading: false }
      }
    } catch { /* ignore */ }
    return initialState
  })

  const [input, setInput] = useState('')
  const [contextInput, setContextInput] = useState('')
  const [stepLoading, setStepLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const role = localStorage.getItem('role') || ''

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages, state.step])

  useEffect(() => {
    if (state.step !== 'idle') {
      try {
        localStorage.setItem('aiAgent_state', JSON.stringify({
          step: state.step,
          messages: state.messages.slice(-50),
          createdBranchId: state.createdBranchId,
          createdTemplateId: state.createdTemplateId,
          createdScheduleId: state.createdScheduleId,
        }))
      } catch { /* ignore */ }
    }
  }, [state])

  if (role !== 'MANAGER') return null

  // ── Helpers ──
  const addMsg = (msgRole: AgentMessage['role'], text: string) => {
    const msg: AgentMessage = { id: makeId(), role: msgRole, text, timestamp: new Date() }
    setState(prev => ({ ...prev, messages: [...prev.messages, msg] }))
  }

  const addStreamingMsg = (): string => {
    const id = makeId()
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { id, role: 'ai' as const, text: '', timestamp: new Date() }],
    }))
    return id
  }

  const updateStreamingMsg = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, text } : m),
    }))
  }

  const setLoading = (v: boolean) => setState(prev => ({ ...prev, isLoading: v }))

  const getCurrentScheduleId = (): number | null => {
    const match = location.pathname.match(/\/schedules\/(\d+)/)
    return match ? Number(match[1]) : null
  }

  // ── Главный метод: SSE чат через бэкенд ──
  const sendToBackend = async (message: string) => {
    const token = localStorage.getItem('token')
    const scheduleId = getCurrentScheduleId() || state.createdScheduleId

    setLoading(true)

    const response = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ message, scheduleId, currentPage: location.pathname }),
    })

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`)
    if (!response.body) throw new Error('Нет потока')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const streamMsgId = makeId()
    setState(prev => ({
      ...prev,
      isLoading: false,
      messages: [...prev.messages, { id: streamMsgId, role: 'ai' as const, text: '', timestamp: new Date() }],
    }))

    const progressMap: Record<number, { name: string; workDays: number; decret: number }> = {}
    const buildProgressText = () =>
      Object.values(progressMap).length > 0
        ? Object.values(progressMap).map(e =>
            e.decret > 0 ? `✅ ${e.name}: декрет` : `✅ ${e.name}: ${e.workDays} р.д.`
          ).join('\n')
        : '⏳ Обрабатываю...'

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          const eventLine = lines.find(l => l.startsWith('event:'))
          const dataLine  = lines.find(l => l.startsWith('data:'))
          if (!dataLine) continue

          const eventName = eventLine ? eventLine.slice(6).trim() : 'text'
          const data = dataLine.slice(5).trim()

          if (eventName === 'text') {
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m => m.id === streamMsgId ? { ...m, text: data } : m),
            }))
          }
          if (eventName === 'status') {
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m => m.id === streamMsgId ? { ...m, text: `⏳ ${data}` } : m),
            }))
          }
          if (eventName === 'progress') {
            try {
              const p = JSON.parse(data)
              progressMap[p.employeeId] = { name: p.name, workDays: p.workDays, decret: p.decret || 0 }
              setState(prev => ({
                ...prev,
                messages: prev.messages.map(m => m.id === streamMsgId ? { ...m, text: buildProgressText() } : m),
              }))
            } catch { /* ignore */ }
          }
          if (eventName === 'done') {
            try {
              const d = JSON.parse(data)
              setState(prev => ({
                ...prev,
                messages: prev.messages.filter(m => m.id !== streamMsgId),
                createdScheduleId: scheduleId || prev.createdScheduleId,
              }))
              addMsg('system', `✅ График заполнен! ${d.filledCells} ячеек`)
              addMsg('ai', `${d.summary}\n\nОткрыть график?`)
            } catch { /* ignore */ }
            return
          }
          if (eventName === 'error') {
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m => m.id === streamMsgId ? { ...m, text: `❌ ${data}` } : m),
            }))
            return
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Start: полный флоу с нуля ──
  const handleStart = async () => {
    setState(prev => ({
      ...prev, step: 'branch', messages: [],
      createdBranchId: null, createdTemplateId: null, createdScheduleId: null,
    }))
    addMsg('ai', `Привет! 👋 Настроим всё с нуля.\n\n🏢 Филиал\n📋 Шаблон\n👥 Сотрудники\n📅 График\n📤 Отправка\n\nГенерирую предложение...`)
    await generateBranch(contextInput)
  }

  // ── Чат-режим ──
  const enterChatMode = async () => {
    setState(prev => ({ ...prev, step: 'chat', messages: [], isLoading: true }))

    try {
      const [branches, templates, schedules] = await Promise.all([
        api.getBranches().catch(() => []),
        api.getTemplates().catch(() => []),
        api.getSchedules().catch(() => []),
      ])
      if (branches.length > 0) setState(prev => ({ ...prev, createdBranchId: branches[0].id }))
      if (templates.length > 0) setState(prev => ({ ...prev, createdTemplateId: templates[0].id }))
      if (schedules.length > 0) setState(prev => ({ ...prev, createdScheduleId: schedules[schedules.length - 1].id }))
    } catch { /* ignore */ }

    setLoading(false)
    await sendToBackend('Привет! Что есть в системе и чем можешь помочь?')
  }

  // ── Быстрые кнопки ──
  const handleChatIntent = async (intent: string, userText?: string) => {
    if (intent === 'full') { await handleStart(); return }
    if (intent === 'branch') {
      setState(prev => ({ ...prev, step: 'branch' }))
      await generateBranch(userText || '')
      return
    }
    if (intent === 'template') {
      setState(prev => ({ ...prev, step: 'template' }))
      await generateTemplate()
      return
    }
    if (intent === 'employees') {
      const branches = await api.getBranches().catch(() => [])
      if (branches.length === 0) { addMsg('ai', 'Сначала нужен филиал!'); return }
      const branchId = state.createdBranchId || branches[0].id
      setState(prev => ({ ...prev, step: 'employees', createdBranchId: branchId }))
      await generateEmployees(5)
      return
    }
    if (intent === 'schedule') {
      const branches = await api.getBranches().catch(() => [])
      const templates = await api.getTemplates().catch(() => [])
      if (!branches.length || !templates.length) {
        addMsg('ai', 'Нужны филиал и шаблон для создания графика.')
        return
      }
      const branchId = state.createdBranchId || branches[0].id
      const templateId = state.createdTemplateId || templates[0].id
      setState(prev => ({ ...prev, step: 'schedule', createdBranchId: branchId, createdTemplateId: templateId }))
      const now = new Date()
      await generateSchedule(now.getMonth() + 1, now.getFullYear())
      return
    }
    if (intent === 'fill_schedule') {
      const sid = getCurrentScheduleId() || state.createdScheduleId
      if (!sid) { addMsg('ai', 'Открой нужный график и напиши снова.'); return }
      await sendToBackend(`Заполни смены в графике #${sid}`)
      return
    }
    await sendToBackend(userText || intent)
  }

  // ── Step: Branch ──
  const generateBranch = async (context: string) => {
    setLoading(true)
    // Даём дефолтный черновик сразу — пусть пользователь редактирует
    setState(prev => ({
      ...prev,
      branchDraft: { name: '', address: '' },
      isLoading: false,
    }))
    addMsg('ai', `📍 Введи название и адрес филиала${context ? ` (контекст: ${context})` : ''}!`)
  }

  const confirmBranch = async (draft: BranchDraft) => {
    setStepLoading(true)
    try {
      const created = await api.createBranch(draft)
      const isChatMode = state.createdTemplateId !== null
      setState(prev => ({ ...prev, createdBranchId: created.id, branchDraft: null, step: isChatMode ? 'chat' : 'template' }))
      addMsg('system', `✅ Филиал "${created.name}" создан! (ID: ${created.id})`)
      if (isChatMode) {
        addMsg('ai', `Филиал создан! Что делаем дальше?`)
      } else {
        addMsg('ai', `Отлично! Теперь создадим шаблон...`)
        await generateTemplate()
      }
    } catch {
      addMsg('ai', '❌ Ошибка при создании филиала')
    } finally {
      setStepLoading(false)
    }
  }

  // ── Step: Template ──
  const generateTemplate = async () => {
    setLoading(true)
    setState(prev => ({
      ...prev,
      templateDraft: { name: 'Стандартный график 5/2', description: 'Пятидневная рабочая неделя' },
      isLoading: false,
    }))
    addMsg('ai', `📋 Предлагаю стандартный шаблон — отредактируй если нужно!`)
  }

  const confirmTemplate = async (draft: TemplateDraft) => {
    setStepLoading(true)
    const wasChat = state.createdBranchId !== null && state.step === 'template'
    try {
      const created = await api.createTemplate(draft)
      setState(prev => ({ ...prev, createdTemplateId: created.id, templateDraft: null, step: wasChat ? 'chat' : 'employees' }))
      addMsg('system', `✅ Шаблон "${created.name}" создан! (ID: ${created.id})`)
      if (wasChat) {
        addMsg('ai', `Шаблон создан! Что делаем дальше?`)
      } else {
        addMsg('ai', `Теперь добавим сотрудников. Сколько человек?`)
      }
    } catch {
      addMsg('ai', '❌ Ошибка при создании шаблона')
    } finally {
      setStepLoading(false)
    }
  }

  // ── Step: Employees ──
  const generateEmployees = async (count: number) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          message: `Предложи список из ${count} сотрудников для филиала. Контекст: ${contextInput || 'обычный офис'}. Верни JSON с полем employees: [{firstName, lastName, position}]`,
          currentPage: location.pathname,
        }),
      })
      // Бэкенд вернёт SSE, но для employees нам нужен JSON
      // Читаем как обычный текст через не-stream запрос
      const text = await res.text()
      // Ищем JSON в ответе
      const match = text.match(/\{[\s\S]*"employees"[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setState(prev => ({ ...prev, employeeDrafts: parsed.employees || [], isLoading: false }))
        addMsg('ai', `👥 Предлагаю ${parsed.employees?.length} сотрудников. Редактируй!`)
      } else {
        // Дефолт если AI не вернул нужный формат
        const defaults = Array.from({ length: count }, () => ({
          firstName: '', lastName: '', position: 'Сотрудник',
        }))
        setState(prev => ({ ...prev, employeeDrafts: defaults, isLoading: false }))
        addMsg('ai', `👥 Заполни данные ${count} сотрудников!`)
      }
    } catch {
      setLoading(false)
      const defaults = Array.from({ length: count }, () => ({ firstName: '', lastName: '', position: '' }))
      setState(prev => ({ ...prev, employeeDrafts: defaults, isLoading: false }))
      addMsg('ai', `👥 Заполни данные сотрудников вручную!`)
    }
  }

  const confirmEmployees = async (drafts: EmployeeDraft[]) => {
    const branchId = state.createdBranchId
    if (!branchId) return
    setStepLoading(true)
    let created = 0
    const wasChat = state.createdTemplateId !== null
    try {
      for (const emp of drafts) {
        await fetch(`${BASE_URL}/employees`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...emp, branchId }),
        })
        created++
      }
      setState(prev => ({ ...prev, employeeDrafts: [], step: wasChat ? 'chat' : 'schedule' }))
      addMsg('system', `✅ Создано ${created} сотрудников!`)
      if (wasChat) {
        addMsg('ai', `Сотрудники добавлены! Что делаем дальше?`)
      } else {
        addMsg('ai', `Теперь создадим график!`)
        const now = new Date()
        await generateSchedule(now.getMonth() + 1, now.getFullYear())
      }
    } catch {
      addMsg('ai', `❌ Ошибка (создано: ${created})`)
    } finally {
      setStepLoading(false)
    }
  }

  // ── Step: Schedule ──
  const generateSchedule = async (month: number, year: number) => {
    const draft: ScheduleDraft = {
      month, year,
      branchId: state.createdBranchId!,
      templateId: state.createdTemplateId!,
    }
    setState(prev => ({ ...prev, scheduleDraft: draft, isLoading: false }))
    addMsg('ai', `📅 Предлагаю график на ${month}/${year}. Измени если нужно!`)
  }

  const confirmSchedule = async (draft: ScheduleDraft) => {
    setStepLoading(true)
    try {
      const created = await api.createSchedule({
        branchId: draft.branchId,
        templateId: draft.templateId,
        month: draft.month,
        year: draft.year,
      })
      setState(prev => ({ ...prev, createdScheduleId: created.id, scheduleDraft: null, step: 'submit' }))
      addMsg('system', `✅ График создан! (ID: ${created.id})`)
      addMsg('ai', `🎉 Почти готово! Отправить на согласование?`)
    } catch {
      addMsg('ai', '❌ Ошибка при создании графика')
    } finally {
      setStepLoading(false)
    }
  }

  // ── Step: Submit ──
  const confirmSubmit = async () => {
    if (!state.createdScheduleId) return
    setStepLoading(true)
    try {
      await api.submitSchedule(state.createdScheduleId)
      setState(prev => ({ ...prev, step: 'chat' }))
      addMsg('system', `✅ График отправлен на согласование!`)
      addMsg('ai', `Всё настроено! 🎉 Чем ещё могу помочь?`)
    } catch {
      addMsg('ai', '❌ Ошибка при отправке')
    } finally {
      setStepLoading(false)
    }
  }

  const skipSubmit = () => {
    setState(prev => ({ ...prev, step: 'chat' }))
    addMsg('system', 'График сохранён как черновик')
    addMsg('ai', `Ок! Чем ещё могу помочь?`)
  }

  // ── Chat input handler ──
  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return
    addMsg('user', text)
    setInput('')

    const lower = text.toLowerCase()

    // Чат-режим — всё через бэкенд
    if (state.step === 'chat' || state.step === 'done') {
      try {
        await sendToBackend(text)
      } catch (e) {
        addMsg('ai', `❌ ${e instanceof Error ? e.message : 'Ошибка соединения'}`)
      }
      return
    }

    // Employees — количество
    if (state.step === 'employees') {
      const num = parseInt(text)
      if (!isNaN(num) && num > 0 && num <= 20) { await generateEmployees(num); return }
      if (lower.includes('пять')) { await generateEmployees(5); return }
      if (lower.includes('три'))  { await generateEmployees(3); return }
      if (lower.includes('десять')) { await generateEmployees(10); return }
      await generateEmployees(5)
      return
    }

    // Остальные шаги — через бэкенд
    setLoading(true)
    const streamId = addStreamingMsg()
    setState(prev => ({ ...prev, isLoading: false }))
    try {
      await sendToBackend(text)
      // Убираем пустой стрим если sendToBackend добавил своё сообщение
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== streamId || m.text !== ''),
      }))
    } catch {
      updateStreamingMsg(streamId, 'Понял! Продолжаем.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleUserMessage(input)
    }
  }

  const getStepIndex = () => STEPS.findIndex(s => s.key === state.step)

  const reset = () => {
    localStorage.removeItem('aiAgent_state')
    // Очищаем историю на бэкенде
    const token = localStorage.getItem('token')
    fetch(`${BASE_URL}/ai/history`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {})
    setState(initialState)
    setContextInput('')
    setInput('')
  }

  const isChatMode = state.step === 'chat'
  const isSetupMode = ['branch', 'template', 'employees', 'schedule', 'submit'].includes(state.step)

  return (
    <>
      {/* Floating button */}
      <button
        className={`${styles.fab} ${!open && state.step === 'idle' ? styles.fabPulse : ''}`}
        onClick={() => setOpen(o => !o)}
        title="AI Ассистент"
      >
        {open ? '✕' : '✨'}
      </button>

      {/* Panel */}
      {open && (
        <div className={styles.panel}>

          {/* Header */}
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderIcon}>🤖</div>
            <div className={styles.panelHeaderText}>
              <div className={styles.panelTitle}>AI Ассистент</div>
              <div className={styles.panelSub}>
                {state.step === 'idle' ? 'Знаю всех сотрудников и графики'
                  : isChatMode ? 'Свободный режим — пиши что нужно'
                  : `Шаг: ${STEPS.find(s => s.key === state.step)?.label || ''}`}
              </div>
            </div>
            <button className={styles.panelCloseBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Progress bar */}
          {isSetupMode && (
            <div className={styles.progressBar}>
              {STEPS.map((s, i) => {
                const current = getStepIndex()
                const isDone = i < current
                const isActive = i === current
                return (
                  <div key={s.key} className={styles.progressStep}>
                    <div className={`${styles.progressDot} ${isDone ? styles.progressDotDone : ''} ${isActive ? styles.progressDotActive : ''}`}>
                      {isDone ? '✓' : s.icon}
                    </div>
                    <span className={`${styles.progressLabel} ${isActive ? styles.progressLabelActive : ''}`}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Idle screen — БЕЗ поля для API ключа */}
          {state.step === 'idle' && (
            <div className={styles.apiKeyScreen}>
              <div className={styles.apiKeyTitle}>🚀 AI Ассистент</div>
              <div className={styles.apiKeyDesc}>
                Я знаю всех твоих сотрудников и графики. Просто скажи что нужно сделать!
              </div>
              <label className={styles.fieldLabel}>Контекст (необязательно)</label>
              <textarea
                className={styles.contextInput}
                placeholder="Например: IT-компания, офис в Алматы..."
                value={contextInput}
                onChange={e => setContextInput(e.target.value)}
                rows={2}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.apiKeyStartBtn} style={{ flex: 1 }} onClick={handleStart}>
                  🔄 С нуля
                </button>
                <button
                  className={styles.apiKeyStartBtn}
                  style={{ flex: 1, background: '#10b981' }}
                  onClick={() => enterChatMode()}
                >
                  💬 Чат
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {state.step !== 'idle' && (
            <div className={styles.messages}>
              {state.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.msgWrap} ${msg.role === 'user' ? styles.msgWrapUser : styles.msgWrapAi}`}
                >
                  <div
                    className={`${styles.msgBubble} ${
                      msg.role === 'ai' ? styles.msgBubbleAi
                        : msg.role === 'user' ? styles.msgBubbleUser
                        : styles.msgBubbleSystem
                    }`}
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {msg.text}
                  </div>
                  {msg.role !== 'system' && (
                    <span className={styles.msgTime}>{formatTime(msg.timestamp)}</span>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {state.isLoading && (
                <div className={styles.typingDots}>
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                  <div className={styles.typingDot} />
                </div>
              )}

              {/* Step cards */}
              {!state.isLoading && state.step === 'branch' && state.branchDraft && (
                <StepBranch
                  draft={state.branchDraft}
                  onConfirm={confirmBranch}
                  onCancel={() => generateBranch(contextInput)}
                  loading={stepLoading}
                />
              )}
              {!state.isLoading && state.step === 'template' && state.templateDraft && (
                <StepTemplate
                  draft={state.templateDraft}
                  onConfirm={confirmTemplate}
                  onCancel={() => generateTemplate()}
                  loading={stepLoading}
                />
              )}
              {!state.isLoading && state.step === 'employees' && state.employeeDrafts.length > 0 && (
                <StepEmployees
                  drafts={state.employeeDrafts}
                  onConfirm={confirmEmployees}
                  onCancel={() => generateEmployees(5)}
                  loading={stepLoading}
                />
              )}
              {!state.isLoading && state.step === 'schedule' && state.scheduleDraft && (
                <StepSchedule
                  draft={state.scheduleDraft}
                  onConfirm={confirmSchedule}
                  onCancel={() => { const now = new Date(); generateSchedule(now.getMonth() + 1, now.getFullYear()) }}
                  loading={stepLoading}
                />
              )}
              {!state.isLoading && state.step === 'submit' && state.createdScheduleId && (
                <StepSubmit
                  scheduleId={state.createdScheduleId}
                  onConfirm={confirmSubmit}
                  onSkip={skipSubmit}
                  loading={stepLoading}
                />
              )}

              {/* Чат-режим: быстрые кнопки */}
              {isChatMode && !state.isLoading && (
                <div className={styles.quickActions}>
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.intent}
                      className={styles.quickBtn}
                      onClick={() => { addMsg('user', a.label); handleChatIntent(a.intent) }}
                    >
                      {a.label}
                    </button>
                  ))}
                  {state.createdScheduleId && (
                    <button
                      className={styles.quickBtn}
                      onClick={() => { navigate(`/schedules/${state.createdScheduleId}`); setOpen(false) }}
                    >
                      📂 Открыть график
                    </button>
                  )}
                  {getCurrentScheduleId() && (
                    <button
                      className={styles.quickBtnHighlight}
                      onClick={() => {
                        addMsg('user', 'Заполни смены в этом графике')
                        handleChatIntent('fill_schedule')
                      }}
                    >
                      ✨ Заполнить этот график
                    </button>
                  )}
                  <button className={styles.quickBtnReset} onClick={reset}>↩ Сбросить</button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input bar */}
          {state.step !== 'idle' && (
            <div className={styles.inputBar}>
              <textarea
                className={styles.chatInput}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  state.step === 'employees' ? 'Сколько сотрудников? (напр. 5)...' :
                  isChatMode ? 'Напиши что нужно сделать...' :
                  'Напиши пожелания или вопрос...'
                }
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={() => handleUserMessage(input)}
                disabled={!input.trim() || state.isLoading}
              >
                ➤
              </button>
            </div>
          )}

        </div>
      )}
    </>
  )
}