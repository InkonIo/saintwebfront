import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type ScheduleFull, type ScheduleShort, type ScheduleVersion } from '../../api/index'

const BASE_URL = 'http://localhost:8080/api/v1'
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

interface BranchEmployee {
  id: number
  firstName: string
  lastName: string
  position: string
}
import styles from './scheduleDetail.module.css'

const MONTH_NAMES = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
]

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING: 'На согласовании',
  APPROVED: 'Утверждён',
  REVISION: 'На доработке',
  ARCHIVED: 'Архив',
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'draft', PENDING: 'pending', APPROVED: 'approved',
  REVISION: 'revision', ARCHIVED: 'archived',
}

const SHIFT_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  '9-18': { bg: '#dbeafe', color: '#1d4ed8', label: 'Д' },
  '9-21': { bg: '#bfdbfe', color: '#1d4ed8', label: 'Д+' },
  '8-17': { bg: '#e0f2fe', color: '#0369a1', label: 'Д' },
  '8-20': { bg: '#bae6fd', color: '#0369a1', label: 'Д+' },
  'В':    { bg: '#f1f5f9', color: '#64748b', label: 'В' },
  'О':    { bg: '#fef9c3', color: '#a16207', label: 'ОТ' },
  'Б':    { bg: '#fee2e2', color: '#b91c1c', label: 'БЛ' },
  'БС':   { bg: '#f3e8ff', color: '#7e22ce', label: 'БС' },
  'К':    { bg: '#d1fae5', color: '#065f46', label: 'К' },
  'Д':    { bg: '#fce7f3', color: '#9d174d', label: 'Д' },
  '':     { bg: 'transparent', color: '#cbd5e1', label: '—' },
}

type CellKey = `${number}_${string}`
type CellMap = Record<CellKey, string>

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState<ScheduleFull | null>(null)
  const [versions, setVersions] = useState<ScheduleVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [cells, setCells] = useState<CellMap>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [revisionComment, setRevisionComment] = useState('')
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([])

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const role = user.role || localStorage.getItem('role') || ''

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.getScheduleById(Number(id)),
      api.getScheduleVersions(Number(id)),
    ]).then(([s, v]) => {
      setSchedule(s)
      setVersions(v)
      const map: CellMap = {}
      s.entries.forEach(e => { map[`${e.employeeId}_${e.workDate}`] = e.shiftType })
      setCells(map)
      // Load branch employees so table shows even when entries are empty
      fetch(`${BASE_URL}/employees/branch/${s.branchId}`, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then((emps: BranchEmployee[]) => setBranchEmployees(emps))
        .catch(() => {})
    }).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      <span>Загрузка графика...</span>
    </div>
  )
  if (!schedule) return (
    <div className={styles.loadingPage}>
      <span>График не найден</span>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>Вернуться назад</button>
    </div>
  )

  const daysCount = getDaysInMonth(schedule.year, schedule.month)
  const days = Array.from({ length: daysCount }, (_, i) => i + 1)

  // Build employees list: prefer branchEmployees (always full list),
  // fall back to entries-derived list if branch fetch hasn't returned yet
  const employeeMap: Record<number, { firstName: string; lastName: string; position?: string }> = {}
  // First seed from entries (in case branch fetch is slow)
  schedule.entries.forEach(e => {
    if (!employeeMap[e.employeeId])
      employeeMap[e.employeeId] = { firstName: e.employeeFirstName, lastName: e.employeeLastName }
  })
  // Then override/add from branchEmployees (active employees of this branch)
  branchEmployees.forEach(e => {
    employeeMap[e.id] = { firstName: e.firstName, lastName: e.lastName, position: e.position }
  })
  const employees = Object.entries(employeeMap).map(([eid, info]) => ({ id: Number(eid), ...info }))

  const canEdit   = role === 'MANAGER'  && (schedule.status === 'DRAFT' || schedule.status === 'REVISION')
  const canSubmit = role === 'MANAGER'  && schedule.status === 'DRAFT'
  const canApprove   = role === 'REVIEWER' && schedule.status === 'PENDING'
  const canRevision  = role === 'REVIEWER' && schedule.status === 'PENDING'
  const canArchive   = schedule.status === 'APPROVED'

  const getDateStr = (day: number) => {
    const m = String(schedule.month).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${schedule.year}-${m}-${d}`
  }

  const handleCellChange = (employeeId: number, day: number, value: string) => {
    setCells(prev => ({ ...prev, [`${employeeId}_${getDateStr(day)}` as CellKey]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = employees.flatMap(emp =>
        days.map(day => ({
          employeeId: emp.id,
          workDate: getDateStr(day),
          shiftType: cells[`${emp.id}_${getDateStr(day)}`] || '',
        })).filter(e => e.shiftType !== '' && e.shiftType != null && e.shiftType !== undefined)
      )
      const updated = await api.updateEntries(schedule.id, { entries })
      setSchedule(updated)
      setDirty(false)
    } catch { alert('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const doAction = async (action: string) => {
    setActionLoading(action)
    try {
      let updated: ScheduleShort | ScheduleFull | undefined
      if (action === 'submit')  updated = await api.submitSchedule(schedule.id)
      if (action === 'approve') updated = await api.approveSchedule(schedule.id)
      if (action === 'archive') updated = await api.archiveSchedule(schedule.id)
      if (updated) setSchedule(s => s ? { ...s, ...updated } : s)
      setVersions(await api.getScheduleVersions(schedule.id))
    } catch { alert('Ошибка') }
    finally { setActionLoading('') }
  }

  const doRevision = async () => {
    if (!revisionComment.trim()) return
    setActionLoading('revision')
    try {
      const updated = await api.revisionSchedule(schedule.id, revisionComment)
      setSchedule(s => s ? { ...s, ...updated } : s)
      setShowRevisionModal(false)
      setRevisionComment('')
      setVersions(await api.getScheduleVersions(schedule.id))
    } catch { alert('Ошибка') }
    finally { setActionLoading('') }
  }

  const DAY_NAMES = ['вс','пн','вт','ср','чт','пт','сб']

  return (
    <div className={styles.page}>

      {/* ── Top navbar ── */}
      <nav className={styles.navbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>

        <div className={styles.navCenter}>
          <span className={styles.navTitle}>
            {MONTH_NAMES[schedule.month - 1]} {schedule.year}
          </span>
          <span className={styles.navSep}>·</span>
          <span className={styles.navBranch}>{schedule.branchName}</span>
        </div>

        <div className={styles.navActions}>
          {dirty && canEdit && (
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
          )}
          {canSubmit && (
            <button className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => doAction('submit')} disabled={actionLoading === 'submit'}>
              {actionLoading === 'submit' ? '...' : '📤 На согласование'}
            </button>
          )}
          {canApprove && (
            <button className={`${styles.btn} ${styles.btnApprove}`}
              onClick={() => doAction('approve')} disabled={actionLoading === 'approve'}>
              {actionLoading === 'approve' ? '...' : '✅ Утвердить'}
            </button>
          )}
          {canRevision && (
            <button className={`${styles.btn} ${styles.btnWarning}`}
              onClick={() => setShowRevisionModal(true)}>
              🔄 На доработку
            </button>
          )}
          {canArchive && (
            <button className={`${styles.btn} ${styles.btnGray}`}
              onClick={() => doAction('archive')} disabled={actionLoading === 'archive'}>
              {actionLoading === 'archive' ? '...' : '🗄 Архивировать'}
            </button>
          )}
          <button
            className={`${styles.btn} ${styles.btnOutline} ${showVersions ? styles.btnOutlineActive : ''}`}
            onClick={() => setShowVersions(!showVersions)}>
            🕐 История {versions.length > 0 && <span className={styles.versionBadge}>{versions.length}</span>}
          </button>
        </div>
      </nav>

      {/* ── Info bar ── */}
      <div className={styles.infoBar}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Статус</span>
          <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[schedule.status]]}`}>
            {STATUS_LABELS[schedule.status]}
          </span>
        </div>
        <div className={styles.infoDivider} />
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Версия</span>
          <span className={styles.infoValue}>v{schedule.version}</span>
        </div>
        <div className={styles.infoDivider} />
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Автор</span>
          <span className={styles.infoValue}>{schedule.authorUsername}</span>
        </div>
        {schedule.templateName && <>
          <div className={styles.infoDivider} />
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Шаблон</span>
            <span className={styles.infoValue}>{schedule.templateName}</span>
          </div>
        </>}
        <div className={styles.infoDivider} />
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Сотрудников</span>
          <span className={styles.infoValue}>{employees.length}</span>
        </div>
        {canEdit && (
          <div className={styles.editHint}>
            ✏️ Режим редактирования активен
          </div>
        )}
      </div>

      {/* ── Revision notice ── */}
      {schedule.status === 'REVISION' && versions.length > 0 && (() => {
        const last = versions[versions.length - 1]
        return last?.comment ? (
          <div className={styles.revisionNotice}>
            <span className={styles.revisionIcon}>💬</span>
            <div>
              <div className={styles.revisionTitle}>Комментарий проверяющего:</div>
              <div className={styles.revisionText}>{last.comment}</div>
            </div>
          </div>
        ) : null
      })()}

      {/* ── Version history ── */}
      {showVersions && (
        <div className={styles.versionsPanel}>
          <div className={styles.versionsPanelHeader}>
            <h3 className={styles.versionsTitle}>📋 История версий</h3>
            <button className={styles.closeBtn} onClick={() => setShowVersions(false)}>✕</button>
          </div>
          {versions.length === 0 ? (
            <p className={styles.emptyVersions}>История пуста</p>
          ) : (
            <div className={styles.versionsList}>
              {[...versions].reverse().map((v, i) => (
                <div key={v.id} className={`${styles.versionItem} ${i === 0 ? styles.versionItemLatest : ''}`}>
                  <div className={styles.versionLeft}>
                    <span className={styles.versionNum}>v{v.versionNumber}</span>
                  </div>
                  <div className={styles.versionRight}>
                    <div className={styles.versionMeta}>
                      <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[v.status] || 'draft']}`}>
                        {STATUS_LABELS[v.status] || v.status}
                      </span>
                      <span className={styles.versionUser}>{v.changedByUsername}</span>
                      <span className={styles.versionDate}>
                        {new Date(v.changedAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    {v.comment && (
                      <div className={styles.versionComment}>
                        <span className={styles.versionCommentIcon}>💬</span>
                        {v.comment}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div className={styles.legendBar}>
        <span className={styles.legendLabel}>Обозначения:</span>
        {Object.entries(SHIFT_COLORS).filter(([k]) => k !== '').map(([type, s]) => (
          <span key={type} className={styles.legendItem}>
            <span className={styles.legendChip} style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
            <span className={styles.legendText}>
              {type === 'DAY' ? 'Дневная' : type === 'NIGHT' ? 'Ночная' : 'Выходной'}
            </span>
          </span>
        ))}
        <span className={styles.legendItem}>
          <span className={styles.legendChip} style={{ background: '#f1f5f9', color: '#94a3b8' }}>—</span>
          <span className={styles.legendText}>Не указано</span>
        </span>
      </div>

      {/* ── Schedule Table ── */}
      {employees.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <p>Нет сотрудников в этом графике</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thEmployee}>Сотрудник</th>
                {days.map(d => {
                  const date = new Date(schedule.year, schedule.month - 1, d)
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                  return (
                    <th key={d} className={`${styles.thDay} ${isWeekend ? styles.thWeekend : ''}`}>
                      <div className={styles.thDayNum}>{d}</div>
                      <div className={styles.thDayName}>{DAY_NAMES[date.getDay()]}</div>
                    </th>
                  )
                })}
                <th className={styles.thTotal}>Итого</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, rowIdx) => {
                const workDays = days.filter(d => {
                  const v = cells[`${emp.id}_${getDateStr(d)}`] || ''
                  return v === 'DAY' || v === 'NIGHT'
                }).length
                return (
                  <tr key={emp.id} className={`${styles.row} ${rowIdx % 2 === 1 ? styles.rowAlt : ''}`}>
                    <td className={styles.tdEmployee}>
                      <div className={styles.empAvatar}>
                        {emp.lastName[0]}{emp.firstName[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{emp.lastName} {emp.firstName}</div>
                        {emp.position && (
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{emp.position}</div>
                        )}
                      </div>
                    </td>
                    {days.map(d => {
                      const key: CellKey = `${emp.id}_${getDateStr(d)}`
                      const value = cells[key] || ''
                      const date = new Date(schedule.year, schedule.month - 1, d)
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const shift = SHIFT_COLORS[value] || SHIFT_COLORS['']
                      return (
                        <td key={d} className={`${styles.tdCell} ${isWeekend ? styles.tdWeekend : ''}`}>
                          {canEdit ? (
                            <select
                              className={styles.cellSelect}
                              style={{ background: shift.bg, color: shift.color }}
                              value={value}
                              onChange={e => handleCellChange(emp.id, d, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="9-18">9-18 (Дневная)</option>
                              <option value="9-21">9-21 (Дневная +)</option>
                              <option value="8-17">8-17 (Дневная)</option>
                              <option value="8-20">8-20 (Дневная +)</option>
                              <option value="В">В — Выходной</option>
                              <option value="О">О — Отпуск</option>
                              <option value="Б">Б — Больничный</option>
                              <option value="БС">БС — Без содержания</option>
                              <option value="К">К — Командировка</option>
                              <option value="Д">Д — Декрет</option>
                            </select>
                          ) : (
                            <span
                              className={styles.cellView}
                              style={{ background: value ? shift.bg : 'transparent', color: shift.color }}
                            >
                              {shift.label}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className={styles.tdTotal}>
                      <span className={styles.totalChip}>{workDays}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Revision Modal ── */}
      {showRevisionModal && (
        <div className={styles.overlay} onClick={() => setShowRevisionModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>🔄</div>
            <h2 className={styles.modalTitle}>Вернуть на доработку</h2>
            <p className={styles.modalSub}>Укажите причину — менеджер увидит её в карточке графика</p>
            <label className={styles.modalLabel}>Комментарий *</label>
            <textarea
              className={styles.textarea}
              value={revisionComment}
              onChange={e => setRevisionComment(e.target.value)}
              placeholder="Например: не хватает смен на выходные..."
              rows={4}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => { setShowRevisionModal(false); setRevisionComment('') }}>
                Отмена
              </button>
              <button className={`${styles.btn} ${styles.btnWarning}`}
                onClick={doRevision}
                disabled={actionLoading === 'revision' || !revisionComment.trim()}>
                {actionLoading === 'revision' ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}