import { useEffect, useState } from 'react'
import { api, type Branch, type Template } from '../../../api'
import styles from './createScheduleModal.module.css'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const MONTHS = [
  { value: 1, label: 'Январь' }, { value: 2, label: 'Февраль' },
  { value: 3, label: 'Март' }, { value: 4, label: 'Апрель' },
  { value: 5, label: 'Май' }, { value: 6, label: 'Июнь' },
  { value: 7, label: 'Июль' }, { value: 8, label: 'Август' },
  { value: 9, label: 'Сентябрь' }, { value: 10, label: 'Октябрь' },
  { value: 11, label: 'Ноябрь' }, { value: 12, label: 'Декабрь' },
]

export default function CreateScheduleModal({ onClose, onCreated }: Props) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [branchId, setBranchId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getBranches(), api.getTemplates()])
      .then(([b, t]) => { setBranches(b); setTemplates(t) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.createSchedule({
        branchId: Number(branchId),
        templateId: Number(templateId),
        month: Number(month),
        year: Number(year),
      })
      onCreated()
      onClose()
    } catch {
      setError('Ошибка при создании графика')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Создать новый график</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Месяц <span className={styles.required}>*</span></label>
            <select className={styles.select} value={month} onChange={(e) => setMonth(e.target.value)} required>
              <option value="">Выберите месяц</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Год <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Филиал <span className={styles.required}>*</span></label>
            <select className={styles.select} value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">Выберите филиал</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Шаблон графика <span className={styles.required}>*</span></label>
            <select className={styles.select} value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              <option value="">Выберите шаблон</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Создание...' : 'Далее'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}