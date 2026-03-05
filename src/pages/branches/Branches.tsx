import { useEffect, useState } from 'react'
import { api, type Branch } from '../../api'
import Navbar from '../dashboard/components/Navbar'
import CreateBranchModal from '../dashboard/components/CreateBranchModal'
import styles from './branches.module.css'

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    api.getBranches()
      .then(setBranches)
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = () => {
    api.getBranches().then(setBranches)
  }

  const openEdit = (b: Branch) => {
    setEditBranch(b)
    setEditName(b.name)
    setEditAddress(b.address)
    setEditError('')
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBranch) return
    setEditLoading(true)
    setEditError('')
    try {
      await api.updateBranch(editBranch.id, { name: editName, address: editAddress })
      await api.getBranches().then(setBranches)
      setEditBranch(null)
    } catch {
      setEditError('Ошибка при обновлении филиала')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleteLoading(true)
    try {
      await api.deleteBranch(deleteId)
      setBranches(prev => prev.filter(b => b.id !== deleteId))
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
            <h1 className={styles.pageTitle}>Филиалы</h1>
            <p className={styles.pageSubtitle}>Управление филиалами компании</p>
          </div>
          <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
            + Добавить филиал
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : branches.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏢</div>
            <p className={styles.emptyText}>Филиалов пока нет</p>
          </div>
        ) : (
          <div className={styles.list}>
            {branches.map((b) => (
              <div key={b.id} className={styles.card}>
                <div className={styles.cardIcon}>🏢</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{b.name}</div>
                  <div className={styles.cardAddress}>{b.address}</div>
                </div>
                <div className={styles.cardId}>ID: {b.id}</div>
                <div className={styles.cardActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(b)}>✏️</button>
                  <button className={styles.deleteBtn} onClick={() => setDeleteId(b.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateBranchModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit modal */}
      {editBranch && (
        <div className={styles.overlay} onClick={() => setEditBranch(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Редактировать филиал</h2>
              <button className={styles.closeBtn} onClick={() => setEditBranch(null)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className={styles.field}>
                <label className={styles.label}>Название</label>
                <input
                  className={styles.input}
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Адрес</label>
                <input
                  className={styles.input}
                  type="text"
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  required
                />
              </div>
              {editError && <p className={styles.error}>{editError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditBranch(null)}>Отмена</button>
                <button type="submit" className={styles.submitBtn} disabled={editLoading}>
                  {editLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId !== null && (
        <div className={styles.overlay} onClick={() => setDeleteId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Удалить филиал?</h2>
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