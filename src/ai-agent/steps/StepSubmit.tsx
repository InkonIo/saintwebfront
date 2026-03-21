import styles from '../aiAgent.module.css'

interface Props {
  scheduleId: number
  onConfirm: () => void
  onSkip: () => void
  loading: boolean
}

export default function StepSubmit({ scheduleId, onConfirm, onSkip, loading }: Props) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>📤</span>
        <div>
          <div className={styles.stepTitle}>Отправить на согласование</div>
          <div className={styles.stepSub}>График #{scheduleId} создан. Отправить ревьюеру?</div>
        </div>
      </div>
      <div className={styles.stepActions}>
        <button className={styles.stepCancelBtn} onClick={onSkip} disabled={loading}>
          Пока не отправлять
        </button>
        <button className={styles.stepConfirmBtn} onClick={onConfirm} disabled={loading}>
          {loading ? '⏳ Отправляю...' : '📤 Отправить'}
        </button>
      </div>
    </div>
  )
}