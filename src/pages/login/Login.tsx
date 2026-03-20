import { useState } from 'react'
import { api } from '../../api'
import styles from '../login/login.module.css'
import logo from "../../assets/android-chrome-192x192.png"

type Mode = 'login' | 'register' | 'forgot' | 'verify' | 'reset'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'MANAGER' | 'REVIEWER'>('MANAGER')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await api.login({ username, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role)
        localStorage.setItem('username', data.username)
        localStorage.setItem('user', JSON.stringify(data))
        window.location.href = data.role === 'EMPLOYEE' ? '/my-schedule' : '/dashboard'

      } else if (mode === 'register') {
        const data = await api.register({ username, email, password, role })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role)
        localStorage.setItem('username', data.username)
        localStorage.setItem('user', JSON.stringify(data))
        window.location.href = '/dashboard'

      } else if (mode === 'forgot') {
        await api.forgotPassword(email)
        setSuccess('Код отправлен на почту')
        setMode('verify')

      } else if (mode === 'verify') {
        const token = await api.verifyCode(email, code)
        setResetToken(token)
        setMode('reset')

      } else if (mode === 'reset') {
        await api.resetPassword(resetToken, newPassword)
        setSuccess('Пароль успешно изменён')
        setTimeout(() => {
          setMode('login')
          setSuccess('')
        }, 1500)
      }
    } catch {
      const messages: Record<Mode, string> = {
        login: 'Неверный логин или пароль',
        register: 'Ошибка регистрации',
        forgot: 'Email не найден',
        verify: 'Неверный или истёкший код',
        reset: 'Ошибка при смене пароля',
      }
      setError(messages[mode])
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, string> = {
    login: 'Вход в систему',
    register: 'Регистрация',
    forgot: 'Забыли пароль?',
    verify: 'Введите код',
    reset: 'Новый пароль',
  }

  const subtitles: Record<Mode, string> = {
    login: 'График работы сотрудников',
    register: 'График работы сотрудников',
    forgot: 'Введите email — отправим код',
    verify: `Код отправлен на ${email}`,
    reset: 'Придумайте новый пароль',
  }

  const btnLabels: Record<Mode, string> = {
    login: 'Войти',
    register: 'Зарегистрироваться',
    forgot: 'Отправить код',
    verify: 'Подтвердить',
    reset: 'Сохранить пароль',
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <div className={styles.header}>
          <img src={logo} alt="Logo" className={styles.icon} />
          <h1 className={styles.title}>{titles[mode]}</h1>
          <p className={styles.subtitle}>{subtitles[mode]}</p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* LOGIN */}
          {mode === 'login' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Имя пользователя</label>
                <input className={styles.input} type="text" placeholder="Введите логин"
                  value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Пароль</label>
                <input className={styles.input} type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <p className={styles.roleHint}>
                  <span className={styles.link} onClick={() => { setMode('forgot'); setError('') }}>
                    Забыли пароль?
                  </span>
                </p>
              </div>
            </>
          )}

          {/* REGISTER */}
          {mode === 'register' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Имя пользователя</label>
                <input className={styles.input} type="text" placeholder="Введите логин"
                  value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" placeholder="example@mail.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Роль</label>
                <div className={styles.roleToggle}>
                  <button type="button"
                    className={`${styles.roleBtn} ${role === 'MANAGER' ? styles.roleBtnActive : ''}`}
                    onClick={() => setRole('MANAGER')}>👤 Менеджер</button>
                  <button type="button"
                    className={`${styles.roleBtn} ${role === 'REVIEWER' ? styles.roleBtnActive : ''}`}
                    onClick={() => setRole('REVIEWER')}>✅ Проверяющий</button>
                </div>
                <p className={styles.roleHint}>
                  {role === 'MANAGER'
                    ? 'Создаёт и редактирует графики, отправляет на согласование'
                    : 'Просматривает и утверждает графики, возвращает на доработку'}
                </p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Пароль</label>
                <input className={styles.input} type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </>
          )}

          {/* FORGOT */}
          {mode === 'forgot' && (
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" placeholder="example@mail.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          )}

          {/* VERIFY */}
          {mode === 'verify' && (
            <div className={styles.field}>
              <label className={styles.label}>5-значный код</label>
              <input className={styles.input} type="text" placeholder="12345"
                maxLength={5} value={code} onChange={e => setCode(e.target.value)} required />
              <p className={styles.roleHint}>
                Не пришёл код?{' '}
                <span className={styles.link} onClick={() => { setMode('forgot'); setError('') }}>
                  Отправить снова
                </span>
              </p>
            </div>
          )}

          {/* RESET */}
          {mode === 'reset' && (
            <div className={styles.field}>
              <label className={styles.label}>Новый пароль</label>
              <input className={styles.input} type="password" placeholder="Минимум 6 символов"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                minLength={6} required />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p style={{ color: '#22c55e', fontSize: 13, margin: '8px 0 0' }}>{success}</p>}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? 'Загрузка...' : btnLabels[mode]}
          </button>
        </form>

        <p className={styles.footer}>
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <span className={styles.link} onClick={() => { setMode('register'); setError('') }}>
                Зарегистрироваться
              </span>
            </>
          ) : (
            <>
              {mode === 'register' ? 'Уже есть аккаунт?' : 'Вспомнили пароль?'}{' '}
              <span className={styles.link} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
                Войти
              </span>
            </>
          )}
        </p>

      </div>
    </div>
  )
}