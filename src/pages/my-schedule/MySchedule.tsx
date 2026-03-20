import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './mySchedule.module.css'

interface ScheduleEntry {
  id: number
  scheduleId: number
  workDate: string
  shiftType: string
}

interface Analytics {
  fullName: string
  totalDays: number
  workDays: number
  dayOff: number
  vacationDays: number
  sickDays: number
}

interface Notification {
  id: number
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

const BASE_URL = 'http://localhost:8080/api/v1'
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']



const shiftMeta = (shift: string) => {
  const s = shift.toUpperCase()
  if (s === 'В')  return { label: 'Выходной',        color: '#e2e8f0', text: '#64748b', dot: '#94a3b8' }
  if (s === 'О')  return { label: 'Отпуск',           color: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' }
  if (s === 'Б')  return { label: 'Больничный',       color: '#fef3c7', text: '#92400e', dot: '#f59e0b' }
  if (s === 'БС') return { label: 'Без содержания',   color: '#fce7f3', text: '#9d174d', dot: '#ec4899' }
  if (s === 'К')  return { label: 'Командировка',     color: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' }
  if (s === 'Д')  return { label: 'Декрет',           color: '#fdf2f8', text: '#831843', dot: '#db2777' }
  return { label: shift, color: '#dcfce7', text: '#14532d', dot: '#22c55e' }
}

export default function MySchedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<ScheduleEntry | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const username = localStorage.getItem('username') ?? ''

  

  useEffect(() => {
  Promise.all([
    fetch(`${BASE_URL}/my/schedule`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${BASE_URL}/my/analytics`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${BASE_URL}/notifications`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${BASE_URL}/notifications/unread-count`, { headers: authHeaders() }).then(r => r.json()),
  ])
    .then(([entriesData, analyticsData, notifsData, unreadData]) => {
      setEntries(Array.isArray(entriesData) ? entriesData : [])
      setAnalytics(analyticsData)
      setNotifications(Array.isArray(notifsData) ? notifsData : [])
      setUnreadCount(typeof unreadData === 'number' ? unreadData : 0)
    })
    .catch(console.error)
    .finally(() => setLoading(false))
}, [])

  const logout = () => { localStorage.clear(); window.location.href = '/login' }

  const markAllRead = async () => {
  await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'POST',
    headers: authHeaders(),
  })
  setUnreadCount(0)
  setNotifications(n => n.map(x => ({ ...x, isRead: true })))
}

  // Календарная сетка
  const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate()
  // Пн=0 ... Вс=6
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const entryMap: Record<string, ScheduleEntry> = {}
  entries.forEach(e => { entryMap[e.workDate] = e })

  const prevMonth = () => setCurrentMonth(p => {
    const d = new Date(p.year, p.month - 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const nextMonth = () => setCurrentMonth(p => {
    const d = new Date(p.year, p.month + 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  if (loading) return (
    <div className={styles.loadingScreen}>
      <motion.div
        className={styles.loadingDot}
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ repeat: Infinity, duration: 1 }}
      />
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <motion.nav
  className={styles.navbar}
  initial={{ y: -60, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.4 }}
>
  <div className={styles.navBrand}>
    <span className={styles.navIcon}>◈</span>
    Мой график
  </div>
  <div className={styles.navRight}>
    <div className={styles.navUser}>{username}</div>

    {/* Колокольчик */}
    <div className={styles.bellWrap}>
      <button className={styles.bellBtn} onClick={() => { setShowNotifs(v => !v); if (unreadCount > 0) markAllRead() }}>
        🔔
        {unreadCount > 0 && (
          <motion.span
            className={styles.bellBadge}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {showNotifs && (
          <motion.div
            className={styles.notifDropdown}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.notifHeader}>Уведомления</div>
            {notifications.length === 0 ? (
              <div className={styles.notifEmpty}>Нет уведомлений</div>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div key={n.id} className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}>
                  <div className={styles.notifMsg}>{n.message}</div>
                  <div className={styles.notifTime}>
                    {new Date(n.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <button className={styles.logoutBtn} onClick={logout}>Выйти</button>
  </div>
</motion.nav>

      <div className={styles.content}>
        {/* Приветствие + статы */}
        {analytics && (
          <motion.div
            className={styles.heroCard}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className={styles.heroLeft}>
              <div className={styles.heroGreeting}>Привет,</div>
              <div className={styles.heroName}>{analytics.fullName}</div>
            </div>
            <div className={styles.statsRow}>
              {[
                { num: analytics.workDays,    label: 'Рабочих',    color: '#22c55e' },
                { num: analytics.dayOff,       label: 'Выходных',   color: '#94a3b8' },
                { num: analytics.vacationDays, label: 'Отпуск',     color: '#3b82f6' },
                { num: analytics.sickDays,     label: 'Больничных', color: '#f59e0b' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  className={styles.statBox}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                >
                  <div className={styles.statNum} style={{ color: s.color }}>{s.num}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Календарь */}
        <motion.div
          className={styles.calendarCard}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          {/* Шапка */}
          <div className={styles.calHeader}>
            <button className={styles.navArrow} onClick={prevMonth}>‹</button>
            <div className={styles.calTitle}>
              {MONTHS[currentMonth.month]} {currentMonth.year}
            </div>
            <button className={styles.navArrow} onClick={nextMonth}>›</button>
          </div>

          {/* Дни недели */}
          <div className={styles.weekdays}>
            {WEEKDAYS.map(d => (
              <div key={d} className={styles.weekday}>{d}</div>
            ))}
          </div>

          {/* Ячейки */}
          <div className={styles.calGrid}>
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.emptyCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const entry = entryMap[dateStr]
              const meta = entry ? shiftMeta(entry.shiftType) : null
              const isToday = dateStr === new Date().toISOString().slice(0, 10)

              return (
                <motion.div
                  key={day}
                  className={`${styles.dayCell} ${isToday ? styles.today : ''} ${meta ? styles.hasShift : ''}`}
                  style={meta ? { background: meta.color } : {}}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => entry && setSelectedDay(entry)}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.012 }}
                >
                  <div className={styles.dayNum} style={meta ? { color: meta.text } : {}}>
                    {day}
                  </div>
                  {meta && (
                    <>
                      <div className={styles.shiftDot} style={{ background: meta.dot }} />
                      <div className={styles.shiftLabel} style={{ color: meta.text }}>
                        {entry!.shiftType}
                      </div>
                    </>
                  )}
                  {isToday && <div className={styles.todayRing} />}
                </motion.div>
              )
            })}
          </div>

          {/* Легенда */}
          <div className={styles.legend}>
            {[
              { shift: '9-18', label: 'Рабочий' },
              { shift: 'В',    label: 'Выходной' },
              { shift: 'О',    label: 'Отпуск' },
              { shift: 'Б',    label: 'Больничный' },
              { shift: 'БС',   label: 'Без содержания' },
              { shift: 'К',    label: 'Командировка' },
            ].map(({ shift, label }) => {
              const m = shiftMeta(shift)
              return (
                <div key={shift} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: m.dot }} />
                  <span>{label}</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Попап дня */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDay(null)}
          >
            <motion.div
              className={styles.popup}
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const meta = shiftMeta(selectedDay.shiftType)
                const date = new Date(selectedDay.workDate)
                return (
                  <>
                    <div className={styles.popupDate}>
                      {date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className={styles.popupBadge} style={{ background: meta.color, color: meta.text }}>
                      <span className={styles.popupDot} style={{ background: meta.dot }} />
                      {meta.label}
                    </div>
                    <div className={styles.popupShift}>
                      Тип смены: <strong>{selectedDay.shiftType}</strong>
                    </div>
                    <button className={styles.popupClose} onClick={() => setSelectedDay(null)}>
                      Закрыть
                    </button>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}