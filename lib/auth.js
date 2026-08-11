import { createClient as createServerClient } from './supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Bật kiểm tra duyệt tài khoản. Đặt REQUIRE_ACTIVE_PROFILE=true trong .env.local
 * SAU KHI đã chạy xong phần SQL (xem README) — bật sớm sẽ khóa cả tài khoản của
 * chính bạn vì chưa có dòng nào trong bảng profiles.
 */
const YEU_CAU_DUYET = process.env.REQUIRE_ACTIVE_PROFILE === 'true'

/**
 * Client service-role, chỉ dùng để đọc trạng thái duyệt.
 * Phải dùng khóa này vì bảng profiles bật RLS thì client thường không đọc được,
 * mà đây là bước phân quyền nên không được phụ thuộc vào RLS.
 */
let admin = null
function adminClient() {
  admin ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  return admin
}

function tuChoi(message, status = 401) {
  return Response.json({ error: message }, { status })
}

/**
 * Chỉ kiểm tra đã đăng nhập, KHÔNG xét đã được duyệt hay chưa.
 *
 * Dành riêng cho /api/me — endpoint đó phải trả lời được cho cả người đang chờ
 * duyệt, để giao diện báo cho họ biết lý do.
 */
export async function requireAuth() {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, response: tuChoi('Chưa đăng nhập hoặc phiên đã hết hạn') }
  }
  return { user: data.user, response: null }
}

/** Đọc trạng thái duyệt của một tài khoản. Chưa có hồ sơ = chưa được duyệt. */
export async function isActive(userId) {
  if (!YEU_CAU_DUYET) return true
  const { data } = await adminClient()
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle()
  return Boolean(data?.is_active)
}

/**
 * Xác thực người gọi cho một API route.
 *
 * ĐÂY LÀ RANH GIỚI AN TOÀN THẬT. Middleware chỉ lo chuyển hướng trang cho đẹp
 * trải nghiệm; nó có thể bị bỏ qua khi cấu hình matcher sai hoặc khi gọi thẳng
 * vào endpoint. Mọi route đụng tới dữ liệu dân cư đều phải gọi hàm này.
 *
 * Dùng getUser() chứ không phải getSession(): getUser() hỏi lại máy chủ Supabase
 * để xác minh token, còn getSession() chỉ đọc cookie nên có thể bị giả mạo.
 *
 * @returns {Promise<{user: object|null, response: Response|null}>}
 *          response khác null nghĩa là bị chặn — trả thẳng nó về cho client.
 */
export async function requireUser() {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    return { user: null, response: tuChoi('Chưa đăng nhập hoặc phiên đã hết hạn') }
  }

  // Chặn khi chưa duyệt HOẶC chưa có hồ sơ — mặc định là từ chối, không phải
  // cho qua. Tài khoản mới đăng ký rơi vào đúng nhánh này.
  if (!(await isActive(data.user.id))) {
    return {
      user: null,
      response: tuChoi('Tài khoản chưa được duyệt. Liên hệ quản trị viên.', 403),
    }
  }

  return { user: data.user, response: null }
}
