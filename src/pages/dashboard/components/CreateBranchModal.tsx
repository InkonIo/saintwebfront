import { useState } from 'react'
import { api } from '../../../api'
import styles from '../../dashboard/components/createScheduleModal.module.css'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function CreateBranchModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.createBranch({ name, address })
      onCreated()
      onClose()
    } catch {
      setError('Ошибка при создании филиала')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Добавить филиал</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="Филиал №1 – Москва"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Адрес <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="г. Москва, ул. Примерная, 1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}