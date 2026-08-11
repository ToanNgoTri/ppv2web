'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/browser'

const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f0f4ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: 'Segoe UI, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    padding: '20px 24px',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', margin: 0 },
  headerSub: { fontSize: 12, color: '#bfdbfe', marginTop: 4 },
  body: { padding: '20px 24px 24px' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    marginBottom: 14,
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '11px 16px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  buttonDisabled: { backgroundColor: '#93c5fd', cursor: 'not-allowed' },
  error: {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  note: { fontSize: 12, color: '#6b7280', marginTop: 14, lineHeight: 1.5 },
  ok: {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
    backgroundColor: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
  tabs: { display: 'flex', gap: 6, marginBottom: 16 },
  tab: {
    flex: 1,
    padding: '8px 0',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    // Viết tách borderWidth/Style/Color chứ không dùng shorthand `border`:
    // tabActive chỉ đổi borderColor, mà trộn shorthand với non-shorthand cho
    // cùng một thuộc tính thì React cảnh báo và màu viền có thể không cập nhật
    // đúng lúc đổi tab.
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    background: '#fff',
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabActive: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'

  const switchMode = (m) => {
    setMode(m)
    setError(null)
    setNotice(null)
    setPassword('')
  }

  /**
   * Đăng ký: tài khoản được tạo nhưng CHƯA dùng được.
   * Hồ sơ sinh ra với is_active = false, phải chờ quản trị duyệt.
   */
  const signUp = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      // Ghi hồ sơ chờ duyệt. Nếu bước này hỏng thì tài khoản vẫn bị khóa
      // (không có hồ sơ = chưa duyệt), chỉ là quản trị phải tra auth.users.
      await fetch('/api/signup-profile', { method: 'POST' }).catch(() => {})
      await supabase.auth.signOut()

      setNotice(
        'Đã tạo tài khoản. Tài khoản cần được quản trị viên duyệt trước khi sử dụng.',
      )
      setPassword('')
      setMode('signin')
    } catch (err) {
      setError(
        err.message === 'Password should be at least 6 characters.'
          ? 'Mật khẩu phải có ít nhất 6 ký tự'
          : err.message === 'User already registered'
            ? 'Email này đã được đăng ký'
            : err.message,
      )
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Đăng nhập đúng mật khẩu chưa chắc đã được vào: tài khoản mới đăng ký
      // nằm ở trạng thái chờ duyệt. Báo ngay tại đây thay vì để người dùng vào
      // rồi mọi thao tác đều báo lỗi 403.
      const me = await fetch('/api/me').then((r) => r.json()).catch(() => null)
      if (me && me.isActive === false) {
        await supabase.auth.signOut()
        setError(
          'Tài khoản đã đăng ký nhưng chưa được duyệt. Vui lòng liên hệ quản trị viên.',
        )
        return
      }

      // refresh() để middleware đọc lại cookie phiên vừa được ghi.
      const next = searchParams.get('next') || '/'
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng'
          : err.message,
      )
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <h1 style={s.headerTitle}>{mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}</h1>
          <div style={s.headerSub}>Hệ thống quản lý dân cư</div>
        </div>

        <form style={s.body} onSubmit={mode === 'signin' ? signIn : signUp}>
          <div style={s.tabs}>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              style={mode === 'signin' ? { ...s.tab, ...s.tabActive } : s.tab}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              style={mode === 'signup' ? { ...s.tab, ...s.tabActive } : s.tab}
            >
              Đăng ký
            </button>
          </div>

          {notice && <div style={s.ok}>{notice}</div>}
          {error && <div style={s.error}>{error}</div>}

          <label style={s.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={s.input}
            required
          />

          <label style={s.label} htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={s.input}
            required
            minLength={mode === 'signup' ? 6 : undefined}
          />

          <button
            type="submit"
            disabled={loading}
            style={loading ? { ...s.button, ...s.buttonDisabled } : s.button}
          >
            {loading
              ? mode === 'signin' ? 'Đang đăng nhập…' : 'Đang đăng ký…'
              : mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
          </button>

          <div style={s.note}>
            {mode === 'signup'
              ? 'Tài khoản tạo xong ở trạng thái chờ duyệt, phải được quản trị viên mở mới dùng được.'
              : 'Tài khoản mới đăng ký cần được quản trị viên duyệt trước khi sử dụng.'}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
