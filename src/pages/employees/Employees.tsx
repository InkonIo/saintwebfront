import { useEffect, useState } from 'react'
import { api, type Branch } from '../../api'
import styles from './employees.module.css'
import Navbar from '../dashboard/components/Navbar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number
  branchId: number
  branchName: string
  userId: number
  firstName: string
  lastName: string
  position: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Employee API ─────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:8080/api/v1'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
})

const employeeApi = {
  getByBranch: async (branchId: number): Promise<Employee[]> => {
    const res = await fetch(`${BASE_URL}/employees/branch/${branchId}`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to fetch employees')
    return res.json()
  },
  create: async (payload: { firstName: string; lastName: string; position: string; branchId: number }): Promise<Employee> => {
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create employee')
    return res.json()
  },
  update: async (id: number, payload: { firstName: string; lastName: string; position: string }): Promise<Employee> => {
    const res = await fetch(`${BASE_URL}/employees/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to update employee')
    return res.json()
  },
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
}

export default function Employees() {
  const user = JSON.parse(localStorage.getItem('user') || '{}') as {
    role?: string
  }
  const isManager = user.role === 'MANAGER'

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({ firstName: '', lastName: '', position: '', branchId: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getBranches()
      .then((data) => {
        setBranches(data)
        if (data.length > 0) setSelectedBranch(data[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    setLoading(true)
    employeeApi
      .getByBranch(selectedBranch)
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [selectedBranch])

  const reload = () => {
    if (!selectedBranch) return
    setLoading(true)
    employeeApi
      .getByBranch(selectedBranch)
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.position}`.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditEmployee(null)
    setFormData({ firstName: '', lastName: '', position: '', branchId: selectedBranch ?? 0 })
    setShowModal(true)
  }

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp)
    setFormData({ firstName: emp.firstName, lastName: emp.lastName, position: emp.position, branchId: emp.branchId })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.position.trim()) return
    setSaving(true)
    try {
      if (editEmployee) {
        await employeeApi.update(editEmployee.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          position: formData.position,
        })
      } else {
        await employeeApi.create(formData)
      }
      setShowModal(false)
      reload()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Сотрудники</h1>
            <p className={styles.pageSubtitle}>Управление сотрудниками по филиалам</p>
          </div>
          {isManager && (
            <button className={styles.createBtn} onClick={openCreate}>
              + Добавить сотрудника
            </button>
          )}
        </div>

        <div className={styles.filterBar}>
          <input
            className={styles.searchInput}
            placeholder="🔍 Поиск по имени или должности..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {branches.length > 1 && (
            <select
              className={styles.filterSelect}
              value={selectedBranch ?? ''}
              onChange={(e) => setSelectedBranch(Number(e.target.value))}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>👥</div>
              <p>Сотрудников не найдено</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th>Филиал</th>
                  <th>Статус</th>
                  <th>Добавлен</th>
                  {isManager && <th>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>{initials(emp.firstName, emp.lastName)}</div>
                        <div className={styles.employeeName}>{emp.lastName} {emp.firstName}</div>
                      </div>
                    </td>
                    <td><span className={styles.employeePosition}>{emp.position}</span></td>
                    <td><span className={styles.branchTag}>{emp.branchName}</span></td>
                    <td>
                      {emp.isActive
                        ? <span className={styles.badgeActive}>Активен</span>
                        : <span className={styles.badgeInactive}>Неактивен</span>
                      }
                    </td>
                    <td>{emp.createdAt?.slice(0, 10)}</td>
                    {isManager && (
                      <td>
                        <button className={styles.actionBtn} onClick={() => openEdit(emp)}>
                          ✏️ Изменить
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editEmployee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
            </h2>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Фамилия *</label>
              <input
                className={styles.formInput}
                placeholder="Иванов"
                value={formData.lastName}
                onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Имя *</label>
              <input
                className={styles.formInput}
                placeholder="Иван"
                value={formData.firstName}
                onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Должность *</label>
              <input
                className={styles.formInput}
                placeholder="Менеджер"
                value={formData.position}
                onChange={(e) => setFormData((f) => ({ ...f, position: e.target.value }))}
              />
            </div>

            {!editEmployee && branches.length > 1 && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Филиал *</label>
                <select
                  className={styles.formSelect}
                  value={formData.branchId}
                  onChange={(e) => setFormData((f) => ({ ...f, branchId: Number(e.target.value) }))}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                Отмена
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={saving || !formData.firstName.trim() || !formData.lastName.trim() || !formData.position.trim()}
              >
                {saving ? '...' : editEmployee ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}