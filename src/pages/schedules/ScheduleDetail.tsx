import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type ScheduleFull, type ScheduleShort, type ScheduleVersion } from '../../api/index'
import styles from './scheduleDetail.module.css'

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

interface Conflict {
  employeeId: number
  workDate: string
  type: string
  message: string
}

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

// Каждая смена — уникальный цвет и понятная метка
const SHIFTS: Record<string, { bg: string; text: string; label: string; desc: string }> = {
  '9-18': { bg: '#DBEAFE', text: '#1E40AF', label: '9–18', desc: 'Дневная смена' },
  '9-21': { bg: '#C7D2FE', text: '#3730A3', label: '9–21', desc: 'Длинная смена' },
  '8-17': { bg: '#D1FAE5', text: '#065F46', label: '8–17', desc: 'Ранняя смена' },
  '8-20': { bg: '#A7F3D0', text: '#064E3B', label: '8–20', desc: 'Длинная ранняя' },
  'В':    { bg: '#F1F5F9', text: '#64748B', label: 'В',    desc: 'Выходной' },
  'О':    { bg: '#FEF3C7', text: '#92400E', label: 'О',    desc: 'Отпуск' },
  'Б':    { bg: '#FEE2E2', text: '#991B1B', label: 'Б',    desc: 'Больничный' },
  'Д':    { bg: '#FCE7F3', text: '#9D174D', label: 'Д',    desc: 'Декрет' },
  'БС':   { bg: '#EDE9FE', text: '#5B21B6', label: 'БС',   desc: 'Без содержания' },
  'К':    { bg: '#ECFDF5', text: '#065F46', label: 'К',    desc: 'Командировка' },
  '':     { bg: 'transparent', text: '#CBD5E1', label: '—', desc: '' },
}

const SPECIAL = new Set(['О','Б','Д','БС','К'])
const DAY_NAMES = ['вс','пн','вт','ср','чт','пт','сб']

type CellKey = `${number}_${string}`
type CellMap = Record<CellKey, string>

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getInitials(first: string, last: string) {
  return `${last[0] ?? ''}${first[0] ?? ''}`.toUpperCase()
}

// Генерируем уникальный цвет аватара по id
const AVATAR_COLORS = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#ECFDF5', text: '#064E3B' },
]

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [schedule, setSchedule] = useState<ScheduleFull | null>(null)
  const [versions, setVersions] = useState<ScheduleVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [cells, setCells] = useState<CellMap>({})
  const [dirty, setDirty] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [revisionComment, setRevisionComment] = useState('')
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([])
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)

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

  const employeeMap: Record<number, { firstName: string; lastName: string; position?: string }> = {}
  schedule.entries.forEach(e => {
    if (!employeeMap[e.employeeId])
      employeeMap[e.employeeId] = { firstName: e.employeeFirstName, lastName: e.employeeLastName }
  })
  branchEmployees.forEach(e => {
    employeeMap[e.id] = { firstName: e.firstName, lastName: e.lastName, position: e.position }
  })
  const employees = Object.entries(employeeMap).map(([eid, info]) => ({ id: Number(eid), ...info }))

  const canEdit     = role === 'MANAGER'  && (schedule.status === 'DRAFT' || schedule.status === 'REVISION')
  const canSubmit   = role === 'MANAGER'  && schedule.status === 'DRAFT'
  const canApprove  = role === 'REVIEWER' && schedule.status === 'PENDING'
  const canRevision = role === 'REVIEWER' && schedule.status === 'PENDING'
  const canArchive  = schedule.status === 'APPROVED'

  const getDateStr = (day: number) => {
    const m = String(schedule.month).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${schedule.year}-${m}-${d}`
  }

  const getCellConflict = (employeeId: number, dateStr: string) =>
    conflicts.find(c => c.employeeId === employeeId && c.workDate === dateStr)

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
        })).filter(e => e.shiftType !== '')
      )
      const updated = await api.updateEntries(schedule.id, { entries })
      setSchedule(updated)
      setDirty(false)
      const foundConflicts = await api.checkConflicts(schedule.id)
      setConflicts(foundConflicts)
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

  // Подсчёт рабочих дней для сотрудника
  const getWorkDays = (empId: number) =>
    days.filter(d => {
      const v = cells[`${empId}_${getDateStr(d)}`] || ''
      return v !== '' && v !== 'В' && !SPECIAL.has(v)
    }).length

  // Статистика по колонке (дню)
  const getDayStats = (day: number) => {
    const dateStr = getDateStr(day)
    let working = 0
    employees.forEach(emp => {
      const v = cells[`${emp.id}_${dateStr}`] || ''
      if (v && v !== 'В' && !SPECIAL.has(v)) working++
    })
    return working
  }

  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <nav className={styles.navbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <div className={styles.navCenter}>
          <span className={styles.navMonth}>{MONTH_NAMES[schedule.month - 1]}</span>
          <span className={styles.navYear}>{schedule.year}</span>
          <span className={styles.navDot} />
          <span className={styles.navBranch}>{schedule.branchName}</span>
        </div>
        <div className={styles.navActions}>
          {dirty && canEdit && (
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
          {canSubmit && !dirty && (
            <button className={`${styles.btn} ${styles.btnSubmit}`}
              onClick={() => doAction('submit')} disabled={actionLoading === 'submit'}>
              {actionLoading === 'submit' ? '...' : 'На согласование'}
            </button>
          )}
          {canApprove && (
            <button className={`${styles.btn} ${styles.btnApprove}`}
              onClick={() => doAction('approve')} disabled={actionLoading === 'approve'}>
              {actionLoading === 'approve' ? '...' : 'Утвердить'}
            </button>
          )}
          {canRevision && (
            <button className={`${styles.btn} ${styles.btnRevision}`}
              onClick={() => setShowRevisionModal(true)}>
              На доработку
            </button>
          )}
          {canArchive && (
            <button className={`${styles.btn} ${styles.btnArchive}`}
              onClick={() => doAction('archive')} disabled={actionLoading === 'archive'}>
              {actionLoading === 'archive' ? '...' : 'В архив'}
            </button>
          )}
          <button
            className={`${styles.btn} ${styles.btnHistory} ${showVersions ? styles.btnHistoryActive : ''}`}
            onClick={() => setShowVersions(!showVersions)}>
            История
            {versions.length > 0 && <span className={styles.historyBadge}>{versions.length}</span>}
          </button>
        </div>
      </nav>

      {/* ── Status strip ── */}
      <div className={styles.statusStrip}>
        <span className={`${styles.statusPill} ${styles[STATUS_CLASS[schedule.status]]}`}>
          {STATUS_LABELS[schedule.status]}
        </span>
        <div className={styles.stripMeta}>
          <span>v{schedule.version}</span>
          <span className={styles.stripDot} />
          <span>{schedule.authorUsername}</span>
          {schedule.templateName && <>
            <span className={styles.stripDot} />
            <span>{schedule.templateName}</span>
          </>}
          <span className={styles.stripDot} />
          <span>{employees.length} сотр.</span>
        </div>
        {canEdit && <span className={styles.editBadge}>Редактирование</span>}
      </div>

      {/* ── Revision notice ── */}
      {schedule.status === 'REVISION' && versions.length > 0 && (() => {
        const last = versions[versions.length - 1]
        return last?.comment ? (
          <div className={styles.revisionBanner}>
            <div className={styles.revisionBannerIcon}>!</div>
            <div>
              <div className={styles.revisionBannerTitle}>Комментарий проверяющего</div>
              <div className={styles.revisionBannerText}>{last.comment}</div>
            </div>
          </div>
        ) : null
      })()}

      {/* ── Version history panel ── */}
      {showVersions && (
        <div className={styles.versionsPanel}>
          <div className={styles.versionsPanelHead}>
            <span className={styles.versionsPanelTitle}>История версий</span>
            <button className={styles.closePanelBtn} onClick={() => setShowVersions(false)}>✕</button>
          </div>
          {versions.length === 0 ? (
            <p className={styles.emptyVersions}>История пуста</p>
          ) : (
            <div className={styles.versionList}>
              {[...versions].reverse().map((v, i) => (
                <div key={v.id} className={`${styles.versionRow} ${i === 0 ? styles.versionRowLatest : ''}`}>
                  <span className={styles.versionNum}>v{v.versionNumber}</span>
                  <span className={`${styles.versionStatus} ${styles[STATUS_CLASS[v.status] || 'draft']}`}>
                    {STATUS_LABELS[v.status] || v.status}
                  </span>
                  <span className={styles.versionUser}>{v.changedByUsername}</span>
                  <span className={styles.versionDate}>{new Date(v.changedAt).toLocaleString('ru-RU')}</span>
                  {v.comment && (
                    <div className={styles.versionComment}>{v.comment}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Conflicts ── */}
      {conflicts.length > 0 && (
        <div className={styles.conflictBanner}>
          <span className={styles.conflictIcon}>⚠</span>
          <span className={styles.conflictTitle}>Конфликтов: {conflicts.length}</span>
          <div className={styles.conflictList}>
            {conflicts.map((c, i) => {
              const emp = employees.find(e => e.id === c.employeeId)
              return (
                <span key={i} className={styles.conflictItem}>
                  {emp?.lastName} {emp?.firstName} · {c.workDate}: {c.message}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className={styles.legendRow}>
        {Object.entries(SHIFTS).filter(([k]) => k !== '').map(([key, s]) => (
          <div key={key} className={styles.legendItem}>
            <span className={styles.legendChip} style={{ background: s.bg, color: s.text }}>
              {s.label}
            </span>
            <span className={styles.legendDesc}>{s.desc}</span>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {employees.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <p>Нет сотрудников в этом графике</p>
        </div>
      ) : (
        <div className={styles.tableOuter}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thEmp}>Сотрудник</th>
                  {days.map(d => {
                    const date = new Date(schedule.year, schedule.month - 1, d)
                    const dow = date.getDay()
                    const isWknd = dow === 0 || dow === 6
                    const isToday =
                      new Date().getDate() === d &&
                      new Date().getMonth() + 1 === schedule.month &&
                      new Date().getFullYear() === schedule.year
                    const working = getDayStats(d)
                    return (
                      <th
                        key={d}
                        className={[
                          styles.thDay,
                          isWknd ? styles.thDayWeekend : '',
                          isToday ? styles.thDayToday : '',
                          hoveredCol === d ? styles.thDayHovered : '',
                        ].join(' ')}
                        onMouseEnter={() => setHoveredCol(d)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <div className={styles.thDayNum}>{d}</div>
                        <div className={styles.thDayName}>{DAY_NAMES[dow]}</div>
                        {!isWknd && (
                          <div className={styles.thDayWorking} title={`${working} работают`}>
                            {working}
                          </div>
                        )}
                      </th>
                    )
                  })}
                  <th className={styles.thTotal}>Р.Д.</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, rowIdx) => {
                  const workDays = getWorkDays(emp.id)
                  const avatarColor = AVATAR_COLORS[emp.id % AVATAR_COLORS.length]
                  return (
                    <tr key={emp.id} className={rowIdx % 2 === 1 ? styles.rowAlt : styles.row}>
                      <td className={styles.tdEmp}>
                        <div
                          className={styles.avatar}
                          style={{ background: avatarColor.bg, color: avatarColor.text }}
                        >
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div className={styles.empInfo}>
                          <span className={styles.empName}>{emp.lastName} {emp.firstName}</span>
                          {emp.position && <span className={styles.empRole}>{emp.position}</span>}
                        </div>
                      </td>
                      {days.map(d => {
                        const key: CellKey = `${emp.id}_${getDateStr(d)}`
                        const value = cells[key] || ''
                        const date = new Date(schedule.year, schedule.month - 1, d)
                        const dow = date.getDay()
                        const isWknd = dow === 0 || dow === 6
                        const shift = SHIFTS[value] || SHIFTS['']
                        const conflict = getCellConflict(emp.id, getDateStr(d))
                        const isHoveredCol = hoveredCol === d

                        return (
                          <td
                            key={d}
                            className={[
                              styles.tdCell,
                              isWknd ? styles.tdCellWeekend : '',
                              conflict ? styles.tdCellConflict : '',
                              isHoveredCol ? styles.tdCellHovered : '',
                            ].join(' ')}
                            title={conflict?.message || shift.desc}
                          >
                            {canEdit ? (
                              <select
                                className={styles.cellSelect}
                                style={{ background: conflict ? '#FEE2E2' : shift.bg, color: conflict ? '#991B1B' : shift.text }}
                                value={value}
                                onChange={e => handleCellChange(emp.id, d, e.target.value)}
                              >
                                <option value="">—</option>
                                <option value="9-18">9–18 · Дневная</option>
                                <option value="9-21">9–21 · Длинная</option>
                                <option value="8-17">8–17 · Ранняя</option>
                                <option value="8-20">8–20 · Длинная ранняя</option>
                                <option value="В">В · Выходной</option>
                                <option value="О">О · Отпуск</option>
                                <option value="Б">Б · Больничный</option>
                                <option value="БС">БС · Без содержания</option>
                                <option value="К">К · Командировка</option>
                                <option value="Д">Д · Декрет</option>
                              </select>
                            ) : (
                              <div
                                className={styles.cellChip}
                                style={{ background: value ? shift.bg : 'transparent', color: shift.text }}
                              >
                                {shift.label}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className={styles.tdTotal}>
                        <span className={styles.totalBadge}>{workDays}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Revision Modal ── */}
      {showRevisionModal && (
        <div className={styles.overlay} onClick={() => setShowRevisionModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Вернуть на доработку</h2>
            <p className={styles.modalSub}>Опишите что нужно исправить — менеджер увидит ваш комментарий</p>
            <label className={styles.modalLabel}>Комментарий</label>
            <textarea
              className={styles.textarea}
              value={revisionComment}
              onChange={e => setRevisionComment(e.target.value)}
              placeholder="Например: не хватает смен на выходные..."
              rows={4}
              autoFocus
            />
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnCancel}`}
                onClick={() => { setShowRevisionModal(false); setRevisionComment('') }}>
                Отмена
              </button>
              <button className={`${styles.btn} ${styles.btnRevision}`}
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