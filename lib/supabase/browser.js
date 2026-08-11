import { createBrowserClient } from '@supabase/ssr'

/**
 * Client dùng trong trình duyệt.
 *
 * Dùng khóa ANON (không phải service-role), nên mọi truy vấn vẫn chịu Row Level
 * Security của Supabase — giống cách ppv2app dùng khóa publishable.
 *
 * @supabase/ssr lưu phiên vào COOKIE thay vì localStorage, nhờ đó middleware và
 * các API route ở phía máy chủ đọc được phiên để kiểm tra.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
