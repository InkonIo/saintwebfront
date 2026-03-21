import { useState } from 'react'
import type { EmployeeDraft } from '../types'
import styles from '../aiAgent.module.css'

interface Props {
  drafts: EmployeeDraft[]
  onConfirm: (drafts: EmployeeDraft[]) => void
  onCancel: () => void
  loading: boolean
}

export default function StepEmployees({ drafts, onConfirm, onCancel, loading }: Props) {
  const [employees, setEmployees] = useState<EmployeeDraft[]>(drafts)

  const update = (i: number, field: keyof EmployeeDraft, value: string) => {
    setEmployees(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  const remove = (i: number) => {
    setEmployees(prev => prev.filter((_, idx) => idx !== i))
  }

  const add = () => {
    setEmployees(prev => [...prev, { firstName: '', lastName: '', position: '' }])
  }

  const isValid = employees.length > 0 && employees.every(e =>
    e.firstName.trim() && e.lastName.trim() && e.position.trim()
  )

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>👥</span>
        <div>
          <div className={styles.stepTitle}>Добавить сотрудников</div>
          <div className={styles.stepSub}>AI предлагает {employees.length} сотрудников — редактируй, удаляй, добавляй</div>
        </div>
      </div>

      <div className={styles.employeeList}>
        {employees.map((emp, i) => (
          <div key={i} className={styles.employeeRow}>
            <div className={styles.empAvatar}>
              {(emp.lastName[0] || '?')}{(emp.firstName[0] || '')}
            </div>
            <div className={styles.empFields}>
              <div className={styles.empRow}>
                <input
                  className={styles.fieldInputSm}
                  value={emp.lastName}
                  onChange={e => update(i, 'lastName', e.target.value)}
                  placeholder="Фамилия"
                />
                <input
                  className={styles.fieldInputSm}
                  value={emp.firstName}
                  onChange={e => update(i, 'firstName', e.target.value)}
                  placeholder="Имя"
                />
              </div>
              <input
                className={styles.fieldInputSm}
                value={emp.position}
                onChange={e => update(i, 'position', e.target.value)}
                placeholder="Должность"
                style={{ marginTop: 4 }}
              />
            </div>
            <button className={styles.removeBtn} onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>

      <button className={styles.addEmpBtn} onClick={add}>+ Добавить ещё</button>

      <div className={styles.stepActions}>
        <button className={styles.stepCancelBtn} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
        <button
          className={styles.stepConfirmBtn}
          onClick={() => onConfirm(employees)}
          disabled={loading || !isValid}
        >
          {loading ? `⏳ Создаю ${employees.length}...` : `✅ Создать ${employees.length} сотрудников`}
        </button>
      </div>
    </div>
  )
}