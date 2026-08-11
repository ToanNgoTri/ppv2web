'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../../lib/supabase/browser'

const s = {
  bar: {
    position: 'fixed',
    top: 10,
    right: 12,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px 6px 14px',
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid #e5e7eb',
    borderRadius: 999,
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    fontFamily: 'Segoe UI, sans-serif',
    fontSize: 13,
    backdropFilter: 'blur(6px)',
  },
  email: { color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pending: {
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: '#92400e',
    background: '#fef3c7',
    border: '1px solid #fde68a',
  },
  button: {
    padding: '5px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 999,
    cursor: 'pointer',
  },
}

/** Không hiện thanh tài khoản ở những trang này. */
const HIDDEN_ON = ['/login', '/auth']

export default function AccountBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (HIDDEN_ON.some((p) => pathname.startsWith(p))) {
      setMe(null)
      return
    }
    // /api/me trả cả email lẫn trạng thái duyệt trong một lần gọi. Cần biết
    // trạng thái duyệt vì quản trị có thể khóa tài khoản giữa chừng, khi đó
    // phiên vẫn còn nhưng mọi thao tác sẽ bị từ chối.
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [pathname])

  if (!me?.email) return null
  const { email, isActive } = me

  const signOut = async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // refresh() để middleware thấy cookie phiên đã bị xóa.
    router.replace('/login')
    router.refresh()
  }

  return (
    <div style={s.bar}>
      {isActive === false && <span style={s.pending}>chờ duyệt</span>}
      <span style={s.email} title={email}>{email}</span>
      <button style={s.button} onClick={signOut} disabled={busy}>
        {busy ? 'Đang thoát…' : 'Đăng xuất'}
      </button>
    </div>
  )
}
