import { requireAuth, isActive } from '../../../lib/auth'

/**
 * Trả về trạng thái tài khoản đang đăng nhập.
 *
 * Cố ý dùng requireAuth() chứ không phải requireUser(): endpoint này phải trả
 * lời được cho cả người đang chờ duyệt, nếu không giao diện sẽ không có cách
 * nào báo cho họ biết lý do bị chặn.
 */
export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  return Response.json({
    email: user.email,
    isActive: await isActive(user.id),
  })
}
