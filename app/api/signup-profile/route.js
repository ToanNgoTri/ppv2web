import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/auth'

/** Chỉ ép is_active = false cho tài khoản vừa tạo trong khoảng thời gian này. */
const CUA_SO_VUA_DANG_KY_MS = 10 * 60 * 1000

/**
 * Đặt tài khoản vừa đăng ký về trạng thái CHỜ DUYỆT.
 *
 * Vì sao cần ép chứ không chỉ tạo cho có: cơ sở dữ liệu đã có trigger tự sinh
 * hồ sơ khi đăng ký, nhưng nó lấy giá trị mặc định của cột. Dự án hanggon đang
 * để mặc định `true`, nên người mới đăng ký vào được ngay. Route này ghi đè
 * thành `false` để không phụ thuộc vào việc cột đã được sửa mặc định hay chưa.
 *
 * An toàn:
 *  - Chỉ đụng tới hồ sơ của CHÍNH người đang đăng nhập; id lấy từ phiên chứ
 *    không lấy từ body, nên không thể sửa trạng thái người khác.
 *  - Chỉ ép `false` khi tài khoản vừa được tạo. Nếu không có mốc thời gian này,
 *    một trang độc hại có thể lừa người đã được duyệt gọi vào đây và tự khóa
 *    tài khoản của họ.
 *  - Dùng requireAuth() chứ không phải requireUser(), vì lúc này họ đương nhiên
 *    chưa được duyệt.
 */
export async function POST() {
  const { user, response } = await requireAuth()
  if (response) return response

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const vuaTao = Date.now() - new Date(user.created_at).getTime() < CUA_SO_VUA_DANG_KY_MS
  if (!vuaTao) {
    return Response.json({ ok: true, skipped: 'tài khoản không phải vừa đăng ký' })
  }

  // Hai dự án có lược đồ profiles khác nhau: hanggon có cột email, population
  // thì không. Thử kèm email trước, không được thì lùi về bộ cột tối thiểu.
  const ghi = (row) => admin.from('profiles').upsert(row, { onConflict: 'id' })

  let { error } = await ghi({ id: user.id, is_active: false, email: user.email })
  if (error) ({ error } = await ghi({ id: user.id, is_active: false }))

  if (error) {
    // Không chặn luồng đăng ký. Nhưng phải nói rõ đây là tình huống XẤU: hồ sơ
    // có thể đang ở is_active = true do trigger tạo, tức tài khoản vào được ngay.
    console.error('KHÔNG đặt được trạng thái chờ duyệt:', error.message)
    return Response.json({ ok: false, warning: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
