import { useEffect, useState } from 'react'
import { api, type AuditLog } from '../../api'
import Navbar from '../dashboard/components/Navbar'
import styles from './audit.module.css'

const ACTION_LABELS: Record<string, string> = {
  SCHEDULE_CREATED:   'График создан',
  SCHEDULE_UPDATED:   'График обновлён',
  SCHEDULE_SUBMITTED: 'Отправлен на согласование',
  SCHEDULE_APPROVED:  'График утверждён',
  SCHEDULE_REVISION:  'Возвращён на доработку',
  SCHEDULE_ARCHIVED:  'График архивирован',
  USER_LOGIN:         'Вход в систему',
  USER_REGISTER:      'Регистрация',
}

const ACTION_ICONS: Record<string, string> = {
  SCHEDULE_CREATED:   '📝',
  SCHEDULE_UPDATED:   '✏️',
  SCHEDULE_SUBMITTED: '📤',
  SCHEDULE_APPROVED:  '✅',
  SCHEDULE_REVISION:  '🔄',
  SCHEDULE_ARCHIVED:  '🗄',
  USER_LOGIN:         '🔑',
  USER_REGISTER:      '👤',
}

const ACTION_COLOR: Record<string, string> = {
  SCHEDULE_CREATED:   '#dbeafe',
  SCHEDULE_UPDATED:   '#e0e7ff',
  SCHEDULE_SUBMITTED: '#fef3c7',
  SCHEDULE_APPROVED:  '#d1fae5',
  SCHEDULE_REVISION:  '#fee2e2',
  SCHEDULE_ARCHIVED:  '#f3f4f6',
  USER_LOGIN:         '#f0fdf4',
  USER_REGISTER:      '#faf5ff',
}

const ACTION_TEXT: Record<string, string> = {
  SCHEDULE_CREATED:   '#1d4ed8',
  SCHEDULE_UPDATED:   '#4338ca',
  SCHEDULE_SUBMITTED: '#92400e',
  SCHEDULE_APPROVED:  '#065f46',
  SCHEDULE_REVISION:  '#991b1b',
  SCHEDULE_ARCHIVED:  '#6b7280',
  USER_LOGIN:         '#166534',
  USER_REGISTER:      '#7e22ce',
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')

  useEffect(() => {
    api.getAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter(log => {
    const matchAction = filterAction === 'ALL' || log.action === filterAction
    const matchSearch = !search ||
      log.username?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase())
    return matchAction && matchSearch
  })

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Журнал аудита</h1>
            <p className={styles.subtitle}>Все действия пользователей в системе</p>
          </div>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{logs.length}</span>
              <span className={styles.statLabel}>Всего записей</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>
                {logs.filter(l => l.action === 'SCHEDULE_APPROVED').length}
              </span>
              <span className={styles.statLabel}>Утверждено</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>
                {logs.filter(l => l.action === 'SCHEDULE_REVISION').length}
              </span>
              <span className={styles.statLabel}>На доработку</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="🔍 Поиск по пользователю или деталям..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={styles.select}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="ALL">Все действия</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            Загрузка логов...
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📋</div>
            <p>Записей не найдено</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Действие</th>
                  <th className={styles.th}>Пользователь</th>
                  <th className={styles.th}>Детали</th>
                  <th className={styles.th}>IP адрес</th>
                  <th className={styles.th}>Дата и время</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className={styles.row}>
                    <td className={styles.td}>
                      <span
                        className={styles.actionBadge}
                        style={{
                          background: ACTION_COLOR[log.action] || '#f1f5f9',
                          color: ACTION_TEXT[log.action] || '#475569',
                        }}
                      >
                        {ACTION_ICONS[log.action] || '📌'}{' '}
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>
                          {log.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className={styles.userName}>{log.username || '—'}</div>
                          <div className={styles.userRole}>{log.userRole || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.details}>{log.details || '—'}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.ip}>{log.ipAddress || '—'}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.date}>
                        {new Date(log.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}