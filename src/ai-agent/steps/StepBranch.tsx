import { useState } from 'react'
import type { BranchDraft } from '../types'
import styles from '../aiAgent.module.css'

interface Props {
  draft: BranchDraft
  onConfirm: (draft: BranchDraft) => void
  onCancel: () => void
  loading: boolean
}

export default function StepBranch({ draft, onConfirm, onCancel, loading }: Props) {
  const [name, setName] = useState(draft.name)
  const [address, setAddress] = useState(draft.address)

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>🏢</span>
        <div>
          <div className={styles.stepTitle}>Создать филиал</div>
          <div className={styles.stepSub}>AI предлагает эти данные — отредактируй если нужно</div>
        </div>
      </div>
      <div className={styles.stepFields}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Название</label>
          <input
            className={styles.fieldInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название филиала"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Адрес</label>
          <input
            className={styles.fieldInput}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Адрес филиала"
          />
        </div>
      </div>
      <div className={styles.stepActions}>
        <button className={styles.stepCancelBtn} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
        <button
          className={styles.stepConfirmBtn}
          onClick={() => onConfirm({ name, address })}
          disabled={loading || !name.trim() || !address.trim()}
        >
          {loading ? '⏳ Создаю...' : '✅ Создать филиал'}
        </button>
      </div>
    </div>
  )
}