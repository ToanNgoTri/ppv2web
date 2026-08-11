import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/** Những đường dẫn không cần đăng nhập. */
const PUBLIC_PATHS = ['/login', '/auth']

/**
 * Làm mới phiên đăng nhập trên mỗi request và chặn người chưa đăng nhập.
 *
 * Lưu ý: middleware KHÔNG phải ranh giới an toàn. Nó lo chuyển hướng trang cho
 * mượt; việc chặn thật nằm ở requireUser() bên trong từng API route.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() xác minh token với máy chủ Supabase, đồng thời làm mới phiên.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    // API trả 401 để client xử lý được, trang thì chuyển hướng về đăng nhập.
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Đã đăng nhập mà vào lại trang login thì đưa về trang chủ.
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Bỏ qua file tĩnh và ảnh — không cần kiểm tra phiên, đỡ tốn request.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
