import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ScheduleShort, type Branch, type Template, type CreateSchedulePayload } from '../../api/index'
import styles from './schedules.module.css'

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
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REVISION: 'revision',
  ARCHIVED: 'archived',
}

export default function Schedules() {
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<ScheduleShort[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterBranch, setFilterBranch] = useState<string>('ALL')
  const [form, setForm] = useState<CreateSchedulePayload>({
    branchId: 0,
    templateId: 0,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const role = localStorage.getItem('role') || ''

  useEffect(() => {
    Promise.all([
      api.getSchedules(),
      api.getBranches(),
      api.getTemplates(),
    ]).then(([s, b, t]) => {
      setSchedules(s)
      setBranches(b)
      setTemplates(t)
      if (b.length > 0) setForm(f => ({ ...f, branchId: b[0].id }))
      if (t.length > 0) setForm(f => ({ ...f, templateId: t[0].id }))
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = schedules.filter(s => {
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false
    if (filterBranch !== 'ALL' && String(s.branchId) !== filterBranch) return false
    return true
  })

  const handleCreate = async () => {
    if (!form.branchId || !form.templateId) return setError('Заполните все поля')
    setCreating(true)
    setError('')
    try {
      const created = await api.createSchedule(form)
      setSchedules(prev => [created, ...prev])
      setShowModal(false)
    } catch {
      setError('Не удалось создать график')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Графики работы</h1>
          <p className={styles.subtitle}>Управление расписаниями сотрудников</p>
        </div>
        {role === 'MANAGER' && (
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            + Создать график
          </button>
        )}
      </div>

      <div className={styles.filters}>
        <select className={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={styles.select} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="ALL">Все филиалы</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}><span className={styles.spinner} />Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>Нет графиков по выбранным фильтрам</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(s => (
            <div key={s.id} className={styles.card} onClick={() => navigate(`/schedules/${s.id}`)}>
              <div className={styles.cardTop}>
                <span className={`${styles.badge} ${styles[STATUS_CLASS[s.status]]}`}>
                  {STATUS_LABELS[s.status]}
                </span>
                <span className={styles.version}>v{s.version}</span>
              </div>
              <div className={styles.cardTitle}>
                {MONTH_NAMES[s.month - 1]} {s.year}
              </div>
              <div className={styles.cardBranch}>{s.branchName}</div>
              <div className={styles.cardMeta}>Автор: {s.authorUsername}</div>
              <div className={styles.cardMeta}>
                Обновлён: {new Date(s.updatedAt).toLocaleDateString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Новый график</h2>

            <label className={styles.label}>Филиал</label>
            <select className={styles.select} value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: Number(e.target.value) }))}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <label className={styles.label}>Шаблон</label>
            <select className={styles.select} value={form.templateId}
              onChange={e => setForm(f => ({ ...f, templateId: Number(e.target.value) }))}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className={styles.row}>
              <div style={{ flex: 1 }}>
                <label className={styles.label}>Месяц</label>
                <select className={styles.select} value={form.month}
                  onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}>
                  {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className={styles.label}>Год</label>
                <input className={styles.input} type="number" value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} />
              </div>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Отмена</button>
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={creating}>
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}