import { useState } from 'react'
import type { ScheduleDraft } from '../types'
import styles from '../aiAgent.module.css'

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

interface Props {
  draft: ScheduleDraft
  onConfirm: (draft: ScheduleDraft) => void
  onCancel: () => void
  loading: boolean
}

export default function StepSchedule({ draft, onConfirm, onCancel, loading }: Props) {
  const [month, setMonth] = useState(draft.month)
  const [year, setYear] = useState(draft.year)

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>📅</span>
        <div>
          <div className={styles.stepTitle}>Создать график</div>
          <div className={styles.stepSub}>AI предлагает период — измени если нужно</div>
        </div>
      </div>
      <div className={styles.stepFields}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Месяц</label>
          <select
            className={styles.fieldSelect}
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Год</label>
          <select
            className={styles.fieldSelect}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.stepActions}>
        <button className={styles.stepCancelBtn} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
        <button
          className={styles.stepConfirmBtn}
          onClick={() => onConfirm({ ...draft, month, year })}
          disabled={loading}
        >
          {loading ? '⏳ Создаю...' : '✅ Создать график'}
        </button>
      </div>
    </div>
  )
}