import { useEffect, useState } from 'react'
import { api, type Template } from '../../api'
import Navbar from '../dashboard/components/Navbar'
import styles from './templates.module.css'

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    api.getTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.createTemplate({ name, description })
      const updated = await api.getTemplates()
      setTemplates(updated)
      setShowModal(false)
      setName('')
      setDescription('')
    } catch {
      setError('Ошибка при создании шаблона')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleteLoading(true)
    try {
      await api.deleteTemplate(deleteId)
      setTemplates(prev => prev.filter(t => t.id !== deleteId))
      setDeleteId(null)
    } catch {
      alert('Ошибка при удалении')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Шаблоны графиков</h1>
            <p className={styles.pageSubtitle}>Шаблоны для создания расписаний</p>
          </div>
          <button className={styles.createBtn} onClick={() => setShowModal(true)}>
            + Добавить шаблон
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : templates.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📋</div>
            <p className={styles.emptyText}>Шаблонов пока нет</p>
          </div>
        ) : (
          <div className={styles.list}>
            {templates.map((t) => (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardIcon}>📋</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{t.name}</div>
                  {t.description && <div className={styles.cardDesc}>{t.description}</div>}
                  <div className={styles.cardDate}>
                    Создан: {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className={styles.cardId}>ID: {t.id}</div>
                <button className={styles.deleteBtn} onClick={() => setDeleteId(t.id)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Добавить шаблон</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label className={styles.label}>Название <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Стандартный график 5/2"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Описание</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Описание шаблона..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className={styles.submitBtn} disabled={creating}>
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className={styles.overlay} onClick={() => setDeleteId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Удалить шаблон?</h2>
              <button className={styles.closeBtn} onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <p className={styles.confirmText}>Это действие нельзя отменить.</p>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setDeleteId(null)}>Отмена</button>
              <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}