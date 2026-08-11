import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Client phía máy chủ, đọc phiên đăng nhập từ cookie.
 * Dùng khóa ANON nên vẫn chịu Row Level Security.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component không được phép ghi cookie. Bỏ qua an toàn —
            // middleware đã lo việc làm mới phiên.
          }
        },
      },
    },
  )
}
