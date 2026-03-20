import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { api, type ScheduleShort } from '../../api'
import styles from './dashboard.module.css'
import CreateScheduleModal from './components/CreateScheduleModal'
import Navbar from './components/Navbar'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const BASE_URL = 'http://localhost:8080/api/v1'

const MONTHS_FULL = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик', PENDING: 'На согласовании',
  APPROVED: 'Утверждён', REVISION: 'На доработке', ARCHIVED: 'Архив',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:    { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  PENDING:  { bg: '#fff8e1', text: '#f9a825', dot: '#f59e0b' },
  APPROVED: { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' },
  REVISION: { bg: '#fce4ec', text: '#c62828', dot: '#ef5350' },
  ARCHIVED: { bg: '#f5f5f5', text: '#9e9e9e', dot: '#bdbdbd' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleShort[]>([])
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revisionId, setRevisionId] = useState<number | null>(null)
  const [revisionComment, setRevisionComment] = useState('')
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('ALL')

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isManager = user.role === 'MANAGER'
  const isReviewer = user.role === 'REVIEWER'

  useEffect(() => {
    Promise.all([
      api.getSchedules(),
      api.getAnalyticsSummary(),
    ]).then(([s, a]) => {
      setSchedules(s)
      setAnalytics(a)
    }).finally(() => setLoading(false))
  }, [])

  const reload = () => {
    Promise.all([api.getSchedules(), api.getAnalyticsSummary()])
      .then(([s, a]) => { setSchedules(s); setAnalytics(a) })
  }

  const handleApprove = async (id: number) => {
    await api.approveSchedule(id)
    reload()
  }

  const handleRevision = async () => {
    if (!revisionId || !revisionComment.trim()) return
    setRevisionLoading(true)
    try {
      await api.revisionSchedule(revisionId, revisionComment)
      setRevisionId(null)
      setRevisionComment('')
      reload()
    } finally { setRevisionLoading(false) }
  }

  const visibleSchedules = schedules.filter(s => {
    if (isReviewer && s.status !== 'PENDING') return false
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false
    return true
  })

  const donutData = analytics ? {
    labels: ['Черновик', 'На согласовании', 'Утверждён', 'На доработке', 'Архив'],
    datasets: [{
      data: [
        analytics.draft as number,
        analytics.pending as number,
        analytics.approved as number,
        analytics.revision as number,
        analytics.archived as number,
      ],
      backgroundColor: ['#94a3b8','#f59e0b','#4caf50','#ef5350','#bdbdbd'],
      borderWidth: 0,
      hoverOffset: 6,
    }]
  } : null

  const byBranch = analytics?.byBranch as Record<string, number> | undefined
  const barData = byBranch ? {
    labels: Object.keys(byBranch),
    datasets: [{
      label: 'Графиков',
      data: Object.values(byBranch),
      backgroundColor: '#6c63ff',
      borderRadius: 6,
      borderSkipped: false,
    }]
  } : null

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9e9e9e', font: { size: 11 } }, grid: { display: false } },
      y: {
        ticks: { color: '#9e9e9e', font: { size: 11 } },
        grid: { color: '#f0f0f0' },
        beginAtZero: true,
      },
    },
  }

  const donutOptions = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#9e9e9e', font: { size: 11 }, padding: 12, boxWidth: 10 }
      }
    }
  }

  if (loading) return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingSpinner} />
    </div>
  )

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>

        {/* Статы */}
        {analytics && (
          <div className={styles.statsGrid}>
            {[
              { label: 'Всего графиков',  value: analytics.total as number,    color: '#6c63ff' },
              { label: 'Утверждено',      value: analytics.approved as number,  color: '#4caf50' },
              { label: 'На согласовании', value: analytics.pending as number,   color: '#f59e0b' },
              { label: 'На доработке',    value: analytics.revision as number,  color: '#ef5350' },
            ].map((s, i) => (
              <div key={i} className={styles.statCard} style={{ animationDelay: `${i * 0.07}s` }}>
                <div className={styles.statNum} style={{ color: s.color }}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statAccent} style={{ background: s.color }} />
              </div>
            ))}
          </div>
        )}

        {/* Графики */}
        {analytics && (
          <div className={styles.chartsRow}>
            {donutData && (
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>По статусам</div>
                <div className={styles.donutWrap}>
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
              </div>
            )}
            {barData && (
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>По филиалам</div>
                <div className={styles.barWrap}>
                  <Bar data={barData} options={barOptions} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Список */}
        <div className={styles.listSection}>
          <div className={styles.listHeader}>
            <div>
              <div className={styles.listTitle}>
                {isReviewer ? 'Ожидают согласования' : 'Все графики'}
              </div>
              <div className={styles.listSub}>{visibleSchedules.length} записей</div>
            </div>
            <div className={styles.listActions}>
              {!isReviewer && (
                <select
                  className={styles.filterSelect}
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="ALL">Все статусы</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
              {isManager && (
                <button className={styles.createBtn} onClick={() => setShowModal(true)}>
                  + Создать график
                </button>
              )}
            </div>
          </div>

          {visibleSchedules.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <p className={styles.emptyText}>
                {isReviewer ? 'Нет графиков для согласования' : 'Графиков пока нет'}
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {visibleSchedules.map((s, i) => {
                const sc = STATUS_COLORS[s.status] || STATUS_COLORS.DRAFT
                return (
                  <div
                    key={s.id}
                    className={styles.cardNew}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <div className={styles.cardLeft}>
                      <div className={styles.cardDot} style={{ background: sc.dot }} />
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.cardTopNew}>
                        <span className={styles.cardTitleNew}>
                          {MONTHS_FULL[s.month]} {s.year}
                        </span>
                        <span className={styles.cardBranch}>{s.branchName}</span>
                        <span
                          className={styles.statusBadge}
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                        <span className={styles.version}>v{s.version}</span>
                      </div>
                      <div className={styles.cardMetaNew}>
                        <span>Автор: {s.authorUsername}</span>
                        <span>·</span>
                        <span>{s.updatedAt?.slice(0, 10)}</span>
                      </div>
                    </div>

                    <div className={styles.cardActionsNew}>
                      <button
                        className={styles.actionBtnNew}
                        onClick={() => navigate(`/schedules/${s.id}`)}
                      >
                        👁 Просмотр
                      </button>

                      {isManager && s.status === 'APPROVED' && (
                        <>
                          <button
                            className={`${styles.actionBtnNew} ${styles.actionBtnGreen}`}
                            onClick={() => window.open(
                              `${BASE_URL}/schedules/${s.id}/export/excel?token=${localStorage.getItem('token')}`,
                              '_blank'
                            )}
                          >
                            📊 Excel
                          </button>
                          <button
                            className={`${styles.actionBtnNew} ${styles.actionBtnRed}`}
                            onClick={() => window.open(
                              `${BASE_URL}/schedules/${s.id}/export/pdf?token=${localStorage.getItem('token')}`,
                              '_blank'
                            )}
                          >
                            📄 PDF
                          </button>
                        </>
                      )}

                      {isReviewer && (
                        <>
                          <button
                            className={`${styles.actionBtnNew} ${styles.actionBtnGreen}`}
                            onClick={() => handleApprove(s.id)}
                          >
                            ✅ Утвердить
                          </button>
                          <button
                            className={`${styles.actionBtnNew} ${styles.actionBtnOrange}`}
                            onClick={() => setRevisionId(s.id)}
                          >
                            🔄 Доработка
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateScheduleModal onClose={() => setShowModal(false)} onCreated={reload} />
      )}

      {revisionId !== null && (
        <div className={styles.overlay} onClick={() => setRevisionId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Вернуть на доработку</h2>
            <label className={styles.modalLabel}>Комментарий *</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={revisionComment}
              onChange={e => setRevisionComment(e.target.value)}
              placeholder="Укажите причину доработки..."
            />
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => { setRevisionId(null); setRevisionComment('') }}
              >
                Отмена
              </button>
              <button
                className={styles.modalSubmitBtn}
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