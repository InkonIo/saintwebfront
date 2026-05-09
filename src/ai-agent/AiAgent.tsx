import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './aiAgent.module.css'
import StepBranch from './steps/StepBranch'
import StepTemplate from './steps/StepTemplate'
import StepEmployees from './steps/StepEmployees'
import StepSchedule from './steps/StepSchedule'
import StepSubmit from './steps/StepSubmit'
import type { BranchDraft, TemplateDraft, EmployeeDraft, ScheduleDraft } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep =
  | { type: 'branch';    data: BranchDraft }
  | { type: 'template';  data: TemplateDraft }
  | { type: 'employees'; data: EmployeeDraft[] }
  | { type: 'schedule';  data: ScheduleDraft }
  | { type: 'submit';    data: { scheduleId: number } }

interface Message {
  id: string
  role: 'user' | 'ai' | 'system'
  text: string
  timestamp: Date
  wizard?: WizardStep
}

interface WizardCtx {
  branchId?: number
  templateId?: number
  scheduleId?: number
  employeesDone?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8080/api/v1'

const SUGGESTIONS = [
  'Создать всё с нуля',
  'Заполни смены на этот месяц',
  'Сколько рабочих дней у сотрудников?',
  'Покажи список сотрудников',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2) }
function formatTime(d: Date) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AiAgent() {
  const location = useLocation()
  const role = localStorage.getItem('role') || ''

  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [wizardCtx, setWizardCtx] = useState<WizardCtx>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open && messages.length === 0) {
      addMsg('ai', 'Привет! 👋 Я знаю всех сотрудников и графики. Что нужно сделать?')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messages.length])

  if (role !== 'MANAGER') return null

  // ─── Message helpers ──────────────────────────────────────────────────────

  const addMsg = (msgRole: Message['role'], text: string, wizard?: WizardStep) => {
    setMessages(prev => [...prev, {
      id: makeId(), role: msgRole, text, timestamp: new Date(), wizard,
    }])
  }

  const resolveWizard = (id: string, text: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, wizard: undefined, text } : m
    ))
  }

  const getCurrentScheduleId = (): number | null => {
    const match = location.pathname.match(/\/schedules\/(\d+)/)
    return match ? Number(match[1]) : null
  }

  // ─── SSE stream ──────────────────────────────────────────────────────────

  // FIX: принимает явный ctxOverride чтобы не зависеть от асинхронного setState
  const sendMessageWithCtx = async (text: string, ctxOverride: WizardCtx) => {
    if (!text.trim() || loading) return
    addMsg('user', text)
    setInput('')
    setLoading(true)

    const token = localStorage.getItem('token')
    const scheduleId = getCurrentScheduleId()

    const streamId = makeId()
    setMessages(prev => [...prev, { id: streamId, role: 'ai', text: '', timestamp: new Date() }])

    const progressMap: Record<number, { name: string; workDays: number; decret: number }> = {}

    try {
      const response = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: text,
          scheduleId,
          currentPage: location.pathname,
          wizardCtx: ctxOverride,  // используем явно переданный ctx
        }),
      })

      if (!response.ok) throw new Error(`Ошибка ${response.status}`)
      if (!response.body) throw new Error('Нет потока')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          const eventName = lines.find(l => l.startsWith('event:'))?.slice(6).trim() ?? 'text'
          const data = lines.find(l => l.startsWith('data:'))?.slice(5).replace(/^\s/, '').replace(/\r$/, '') ?? ''
          if (!data) continue

          switch (eventName) {

            case 'text':
              accumulatedText += data
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, text: accumulatedText } : m
              ))
              break

            case 'status':
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, text: `⏳ ${data}` } : m
              ))
              break

            case 'progress':
              try {
                const p = JSON.parse(data)
                progressMap[p.employeeId] = { name: p.name, workDays: p.workDays, decret: p.decret || 0 }
                const progressText = Object.values(progressMap)
                  .map(e => e.decret > 0 ? `✅ ${e.name}: декрет` : `✅ ${e.name}: ${e.workDays} р.д.`)
                  .join('\n')
                setMessages(prev => prev.map(m =>
                  m.id === streamId ? { ...m, text: progressText } : m
                ))
              } catch { /* ignore */ }
              break

            case 'done':
              try {
                const d = JSON.parse(data)
                if (!accumulatedText) {
                  setMessages(prev => prev.map(m =>
                    m.id === streamId
                      ? { ...m, text: `✅ Заполнено ${d.filledCells} ячеек\n${d.summary}` }
                      : m
                  ))
                }
              } catch { /* ignore */ }
              break

            case 'wizard': {
              try {
                const w = JSON.parse(data) as WizardStep
                setMessages(prev => prev.filter(m => m.id !== streamId))
                addMsg('ai', '', w)
              } catch { /* ignore */ }
              break
            }

            case 'error':
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, text: `❌ ${data}` } : m
              ))
              break
          }
        }
      }
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === streamId
          ? { ...m, text: `❌ ${e instanceof Error ? e.message : 'Ошибка соединения'}` }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }

  // Обычный sendMessage — просто берёт текущий wizardCtx из state
  const sendMessage = (text: string) => sendMessageWithCtx(text, wizardCtx)

  // ─── Wizard handlers ──────────────────────────────────────────────────────

  const handleConfirmBranch = async (msgId: string, draft: BranchDraft) => {
    setLoading(true)
    resolveWizard(msgId, `⏳ Создаю филиал "${draft.name}"...`)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()

      // FIX: строим новый ctx локально и сразу передаём — не ждём setState
      const newCtx: WizardCtx = { ...wizardCtx, branchId: created.id }
      setWizardCtx(newCtx)
      resolveWizard(msgId, `✅ Филиал "${draft.name}" создан`)
      await sendMessageWithCtx(
        `Филиал создан, id=${created.id}. Теперь создай шаблон для этого филиала.`,
        newCtx
      )
    } catch (e) {
      resolveWizard(msgId, `❌ ${e instanceof Error ? e.message : 'Ошибка создания филиала'}`)
      setLoading(false)
    }
  }

  const handleConfirmTemplate = async (msgId: string, draft: TemplateDraft) => {
    setLoading(true)
    resolveWizard(msgId, `⏳ Создаю шаблон "${draft.name}"...`)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...draft, branchId: wizardCtx.branchId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()

      // FIX: строим новый ctx локально и сразу передаём — не ждём setState
      const newCtx: WizardCtx = { ...wizardCtx, templateId: created.id }
      setWizardCtx(newCtx)
      resolveWizard(msgId, `✅ Шаблон "${draft.name}" создан`)
      await sendMessageWithCtx(
        `Шаблон создан, id=${created.id}. Теперь добавь сотрудников в филиал id=${wizardCtx.branchId}.`,
        newCtx
      )
    } catch (e) {
      resolveWizard(msgId, `❌ ${e instanceof Error ? e.message : 'Ошибка создания шаблона'}`)
      setLoading(false)
    }
  }

  const handleConfirmEmployees = async (msgId: string, drafts: EmployeeDraft[]) => {
    setLoading(true)
    resolveWizard(msgId, `⏳ Создаю ${drafts.length} сотрудников...`)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/employees/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ employees: drafts, branchId: wizardCtx.branchId }),
      })
      if (!res.ok) throw new Error(await res.text())

      // FIX: строим новый ctx локально и сразу передаём — не ждём setState
      const newCtx: WizardCtx = { ...wizardCtx, employeesDone: 'true' }
      setWizardCtx(newCtx)
      resolveWizard(msgId, `✅ ${drafts.length} сотрудников добавлено`)
      await sendMessageWithCtx(
        `Сотрудники добавлены. Теперь создай график для филиала id=${wizardCtx.branchId}, шаблон id=${wizardCtx.templateId}.`,
        newCtx
      )
    } catch (e) {
      resolveWizard(msgId, `❌ ${e instanceof Error ? e.message : 'Ошибка создания сотрудников'}`)
      setLoading(false)
    }
  }

  const handleConfirmSchedule = async (msgId: string, draft: ScheduleDraft) => {
    setLoading(true)
    resolveWizard(msgId, `⏳ Создаю график ${draft.month}/${draft.year}...`)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...draft,
          branchId: draft.branchId || wizardCtx.branchId,
          templateId: draft.templateId || wizardCtx.templateId,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json()
      setWizardCtx(prev => ({ ...prev, scheduleId: created.id }))
      resolveWizard(msgId, `✅ График #${created.id} создан`)
      addMsg('ai', '', { type: 'submit', data: { scheduleId: created.id } })
    } catch (e) {
      resolveWizard(msgId, `❌ ${e instanceof Error ? e.message : 'Ошибка создания графика'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSubmit = async (msgId: string, sid: number) => {
    setLoading(true)
    resolveWizard(msgId, `⏳ Отправляю на согласование...`)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/schedules/${sid}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      resolveWizard(msgId, `✅ График #${sid} отправлен на согласование!`)
      setWizardCtx({})
      addMsg('ai', '🎉 Готово! Филиал, шаблон, сотрудники и график — всё создано. Чем ещё могу помочь?')
    } catch (e) {
      resolveWizard(msgId, `❌ ${e instanceof Error ? e.message : 'Ошибка отправки'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelWizard = (msgId: string) => {
    resolveWizard(msgId, '↩️ Действие отменено')
    setWizardCtx({})
  }

  // ─── Render wizard card ───────────────────────────────────────────────────

  const renderWizard = (msgId: string, wizard: WizardStep) => {
    switch (wizard.type) {
      case 'branch':
        return <StepBranch draft={wizard.data} loading={loading}
          onConfirm={d => handleConfirmBranch(msgId, d)}
          onCancel={() => handleCancelWizard(msgId)} />
      case 'template':
        return <StepTemplate draft={wizard.data} loading={loading}
          onConfirm={d => handleConfirmTemplate(msgId, d)}
          onCancel={() => handleCancelWizard(msgId)} />
      case 'employees':
        return <StepEmployees drafts={wizard.data} loading={loading}
          onConfirm={d => handleConfirmEmployees(msgId, d)}
          onCancel={() => handleCancelWizard(msgId)} />
      case 'schedule':
        return <StepSchedule draft={wizard.data} loading={loading}
          onConfirm={d => handleConfirmSchedule(msgId, d)}
          onCancel={() => handleCancelWizard(msgId)} />
      case 'submit':
        return <StepSubmit scheduleId={wizard.data.scheduleId} loading={loading}
          onConfirm={() => handleConfirmSubmit(msgId, wizard.data.scheduleId)}
          onSkip={() => {
            resolveWizard(msgId, `✅ График #${wizard.data.scheduleId} сохранён как черновик`)
            setWizardCtx({})
            addMsg('ai', 'Окей, график сохранён как черновик. Чем ещё могу помочь?')
          }} />
    }
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const clearHistory = () => {
    const token = localStorage.getItem('token')
    fetch(`${BASE_URL}/ai/history`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {})
    setMessages([])
    setWizardCtx({})
    addMsg('ai', 'История очищена. Чем могу помочь?')
  }

  const scheduleId = getCurrentScheduleId()

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen(o => !o)} title="AI Ассистент">
        {open ? '✕' : '✨'}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderIcon}>🤖</div>
            <div className={styles.panelHeaderText}>
              <div className={styles.panelTitle}>AI Ассистент</div>
              <div className={styles.panelSub}>
                {scheduleId ? `Открыт график #${scheduleId}` : 'Знаю сотрудников и графики'}
              </div>
            </div>
            <button className={styles.panelCloseBtn} onClick={clearHistory} title="Очистить историю">🗑</button>
            <button className={styles.panelCloseBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.messages}>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`${styles.msgWrap} ${msg.role === 'user' ? styles.msgWrapUser : styles.msgWrapAi}`}
              >
                {msg.wizard
                  ? renderWizard(msg.id, msg.wizard)
                  : (
                    <div
                      className={`${styles.msgBubble} ${
                        msg.role === 'ai' ? styles.msgBubbleAi
                        : msg.role === 'user' ? styles.msgBubbleUser
                        : styles.msgBubbleSystem
                      }`}
                      style={{ whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {msg.role === 'ai' && msg.text === '' && loading
                        ? <span className={styles.typingDots}>
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                          </span>
                        : msg.text
                      }
                    </div>
                  )
                }
                {!msg.wizard && msg.role !== 'system' && (
                  <span className={styles.msgTime}>{formatTime(msg.timestamp)}</span>
                )}
              </div>
            ))}

            {messages.length <= 1 && !loading && (
              <div className={styles.quickActions}>
                {scheduleId && (
                  <button className={styles.quickBtnHighlight} onClick={() => sendMessage('Заполни смены в этом графике')}>
                    ✨ Заполнить этот график
                  </button>
                )}
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.quickBtn} onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputBar}>
            <textarea
              className={styles.chatInput}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши что нужно сделать..."
              rows={1}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}