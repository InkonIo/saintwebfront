import { useState } from 'react'
import { api } from '../../api'
import styles from '../login/login.module.css'

type Mode = 'login' | 'register'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'MANAGER' | 'REVIEWER'>('MANAGER')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await api.login({ username, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role)
        localStorage.setItem('username', data.username)
        localStorage.setItem('user', JSON.stringify(data))
        window.location.href = '/dashboard'
      } else {
        const data = await api.register({ username, email, password, role })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role)
        localStorage.setItem('username', data.username)
        localStorage.setItem('user', JSON.stringify(data))
        window.location.href = '/dashboard'
      }
    } catch {
      setError(mode === 'login' ? 'Неверный логин или пароль' : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.header}>
          <div className={styles.icon}>📅</div>
          <h1 className={styles.title}>
            {mode === 'login' ? 'Вход в систему' : 'Регистрация'}
          </h1>
          <p className={styles.subtitle}>График работы сотрудников</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Имя пользователя</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Введите логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {mode === 'register' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Роль</label>
                <div className={styles.roleToggle}>
                  <button
                    type="button"
                    className={`${styles.roleBtn} ${role === 'MANAGER' ? styles.roleBtnActive : ''}`}
                    onClick={() => setRole('MANAGER')}
                  >
                    👤 Менеджер
                  </button>
                  <button
                    type="button"
                    className={`${styles.roleBtn} ${role === 'REVIEWER' ? styles.roleBtnActive : ''}`}
                    onClick={() => setRole('REVIEWER')}
                  >
                    ✅ Проверяющий
                  </button>
                </div>
                <p className={styles.roleHint}>
                  {role === 'MANAGER'
                    ? 'Создаёт и редактирует графики, отправляет на согласование'
                    : 'Просматривает и утверждает графики, возвращает на доработку'}
                </p>
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className={styles.footer}>
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <span className={styles.link} onClick={switchMode}>
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </span>
        </p>

      </div>
    </div>
  )
}