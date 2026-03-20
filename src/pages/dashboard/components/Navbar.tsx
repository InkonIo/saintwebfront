import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { api, type Notification } from '../../../api'
import styles from './navbar.module.css'
import logo from "../../../assets/android-chrome-192x192.png"

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isManager = user.role === 'MANAGER'
  const isReviewer = user.role === 'REVIEWER'

  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Подгружаем счётчик каждые 30 секунд
  useEffect(() => {
    const fetchCount = () => {
      api.getUnreadCount().then(setUnreadCount).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Закрывать дропдаун при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleBellClick = async () => {
    if (!showDropdown) {
      try {
        const data = await api.getNotifications()
        console.log('notifications:', data)
        setNotifications(data)
        setNotifications(data)
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }
    setShowDropdown(prev => !prev)
  }

  const handleMarkAllRead = async () => {
    await api.markAllRead()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const handleNotificationClick = (n: Notification) => {
    setShowDropdown(false)
    if (n.schedule?.id) navigate(`/schedules/${n.schedule.id}`)
  }

  const TYPE_ICONS: Record<string, string> = {
    SCHEDULE_SUBMITTED: '📤',
    SCHEDULE_APPROVED:  '✅',
    SCHEDULE_REVISION:  '🔄',
  }

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <img src={logo} alt="Logo" className={styles.logoIcon} />
          График работы
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${location.pathname === '/dashboard' ? styles.tabActive : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            Графики
          </button>
          {isManager && (
            <button
              className={`${styles.tab} ${location.pathname === '/branches' ? styles.tabActive : ''}`}
              onClick={() => navigate('/branches')}
            >
              Филиалы
            </button>
          )}
          {isManager && (
            <button
              className={`${styles.tab} ${location.pathname === '/employees' ? styles.tabActive : ''}`}
              onClick={() => navigate('/employees')}
            >
              Сотрудники
            </button>
          )}
          {isManager && (
            <button
              className={`${styles.tab} ${location.pathname === '/templates' ? styles.tabActive : ''}`}
              onClick={() => navigate('/templates')}
            >
              Шаблоны
            </button>
          )}
          {isReviewer && (
            <button
              className={`${styles.tab} ${location.pathname === '/audit' ? styles.tabActive : ''}`}
              onClick={() => navigate('/audit')}
            >
              Аудит
            </button>
          )}
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.greeting}>
          Привет, <span className={styles.username}>{user.username}</span>
        </span>
        <span className={styles.role}>{user.role}</span>

        {/* Колокольчик */}
        <div className={styles.bellWrap} ref={dropdownRef}>
          <button className={styles.bellBtn} onClick={handleBellClick}>
            🔔
            {unreadCount > 0 && (
              <span className={styles.bellBadge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Уведомления</span>
                {unreadCount > 0 && (
                  <button className={styles.markAllBtn} onClick={handleMarkAllRead}>
                    Прочитать все
                  </button>
                )}
              </div>

              <div className={styles.dropdownList}>
                {notifications.length === 0 ? (
                  <div className={styles.dropdownEmpty}>
                    <span>🔕</span>
                    <p>Уведомлений нет</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map(n => (
                    <div
                      key={n.id}
                      className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <span className={styles.notifIcon}>
                        {TYPE_ICONS[n.type] || '🔔'}
                      </span>
                      <div className={styles.notifContent}>
                        <p className={styles.notifMessage}>{n.message}</p>
                        <span className={styles.notifTime}>
                          {new Date(n.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {!n.isRead && <span className={styles.notifDot} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className={styles.logoutBtn} onClick={logout}>Выйти</button>
      </div>
    </nav>
  )
}