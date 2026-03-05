import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ScheduleShort } from '../../api'
import styles from './dashboard.module.css'
import CreateScheduleModal from './components/CreateScheduleModal'
import Navbar from '../dashboard/components/Navbar'

const MONTHS = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING: 'Ожидает одобрения',
  APPROVED: 'Утверждён',
  REVISION: 'На доработке',
  ARCHIVED: 'Архив',
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: styles.badgeDraft,
  PENDING: styles.badgePending,
  APPROVED: styles.badgeApproved,
  REVISION: styles.badgeRevision,
  ARCHIVED: styles.badgeArchived,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleShort[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revisionId, setRevisionId] = useState<number | null>(null)
  const [revisionComment, setRevisionComment] = useState('')
  const [revisionLoading, setRevisionLoading] = useState(false)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isManager = user.role === 'MANAGER'
  const isReviewer = user.role === 'REVIEWER'

  useEffect(() => {
    api.getSchedules()
      .then(setSchedules)
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = () => {
    api.getSchedules().then(setSchedules)
  }

  const handleApprove = async (id: number) => {
    await api.approveSchedule(id)
    handleCreated()
  }

  const handleRevision = async () => {
    if (!revisionId || !revisionComment.trim()) return
    setRevisionLoading(true)
    try {
      await api.revisionSchedule(revisionId, revisionComment)
      setRevisionId(null)
      setRevisionComment('')
      handleCreated()
    } finally {
      setRevisionLoading(false)
    }
  }

  const visibleSchedules = isReviewer
    ? schedules.filter(s => s.status === 'PENDING')
    : schedules

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Графики работы</h1>
            <p className={styles.pageSubtitle}>
              {isReviewer ? 'Графики ожидающие вашего одобрения' : 'Управление графиками по филиалам'}
            </p>
          </div>
          {isManager && (
            <button className={styles.createBtn} onClick={() => setShowModal(true)}>
              + Создать график
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : visibleSchedules.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📋</div>
            <p className={styles.emptyText}>
              {isReviewer ? 'Нет графиков для согласования' : 'Графиков пока нет'}
            </p>
          </div>
        ) : (
          <div className={styles.list}>
            {visibleSchedules.map((s) => (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{s.branchName}</span>
                  <span className={`${styles.badge} ${STATUS_CLASS[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                  <span className={styles.version}>v{s.version}</span>
                </div>

                <div className={styles.cardMeta}>
                  <span>📅 {MONTHS[s.month]} {s.year}</span>
                  <span>Автор: {s.authorUsername}</span>
                  <span>Обновлено: {s.updatedAt?.slice(0, 10)}</span>
                </div>

                <div className={styles.cardActions}>
                  {/* Просмотр — для всех */}
                  <button
                    className={styles.actionBtn}
                    onClick={() => navigate(`/schedules/${s.id}`)}
                  >
                    👁 Просмотр
                  </button>

                  {/* Редактировать — менеджер, только черновик или на доработке */}
                  {isManager && (s.status === 'DRAFT' || s.status === 'REVISION') && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => navigate(`/schedules/${s.id}`)}
                    >
                      ✏️ Редактировать
                    </button>
                  )}

                  {/* История — менеджер */}
                  {isManager && (
                    <button
                      className={styles.actionBtn}
                      onClick={() => navigate(`/schedules/${s.id}`)}
                    >
                      🕐 История
                    </button>
                  )}

                  {/* Экспорт — менеджер, только утверждённые */}
                  {isManager && s.status === 'APPROVED' && (
                    <button className={styles.actionBtn}>
                      ⬇️ Экспорт
                    </button>
                  )}

                  {/* Действия проверяющего */}
                  {isReviewer && (
                    <>
                      <button
                        className={styles.actionBtn}
                        style={{ borderColor: '#2e7d32', color: '#2e7d32' }}
                        onClick={() => handleApprove(s.id)}
                      >
                        ✅ Утвердить
                      </button>
                      <button
                        className={styles.actionBtn}
                        style={{ borderColor: '#c62828', color: '#c62828' }}
                        onClick={() => setRevisionId(s.id)}
                      >
                        ↩️ На доработку
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка создания графика */}
      {showModal && (
        <CreateScheduleModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Модалка возврата на доработку */}
      {revisionId !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setRevisionId(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 32,
              width: 420, maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              Вернуть на доработку
            </h2>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Комментарий *
            </label>
            <textarea
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
                borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit'
              }}
              rows={4}
              value={revisionComment}
              onChange={e => setRevisionComment(e.target.value)}
              placeholder="Укажите причину доработки..."
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                style={{
                  background: '#f1f5f9', color: '#374151', border: '1.5px solid #e2e8f0',
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
                onClick={() => { setRevisionId(null); setRevisionComment('') }}
              >
                Отмена
              </button>
              <button
                style={{
                  background: '#f59e0b', color: '#fff', border: 'none',
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: revisionComment.trim() ? 'pointer' : 'not-allowed',
                  opacity: revisionComment.trim() ? 1 : 0.6
                }}
                onClick={handleRevision}
                disabled={revisionLoading || !revisionComment.trim()}
              >
                {revisionLoading ? '...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}