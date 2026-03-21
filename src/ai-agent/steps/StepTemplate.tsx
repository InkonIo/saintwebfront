import { useState } from 'react'
import type { TemplateDraft } from '../types'
import styles from '../aiAgent.module.css'

interface Props {
  draft: TemplateDraft
  onConfirm: (draft: TemplateDraft) => void
  onCancel: () => void
  loading: boolean
}

export default function StepTemplate({ draft, onConfirm, onCancel, loading }: Props) {
  const [name, setName] = useState(draft.name)
  const [description, setDescription] = useState(draft.description)

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>📋</span>
        <div>
          <div className={styles.stepTitle}>Создать шаблон</div>
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
            placeholder="Название шаблона"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Описание</label>
          <textarea
            className={styles.fieldTextarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Описание шаблона..."
            rows={2}
          />
        </div>
      </div>
      <div className={styles.stepActions}>
        <button className={styles.stepCancelBtn} onClick={onCancel} disabled={loading}>
          Отмена
        </button>
        <button
          className={styles.stepConfirmBtn}
          onClick={() => onConfirm({ name, description })}
          disabled={loading || !name.trim()}
        >
          {loading ? '⏳ Создаю...' : '✅ Создать шаблон'}
        </button>
      </div>
    </div>
  )
}