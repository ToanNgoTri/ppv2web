import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/auth'

/**
 * Tạo hồ sơ cho tài khoản vừa đăng ký, với is_active = false.
 *
 * Vì sao cần route này: bảng profiles có thể chưa có trigger tự sinh hồ sơ.
 * Không có hồ sơ thì requireUser() vẫn chặn (mặc định là từ chối), nhưng quản
 * trị sẽ không thấy người đó trong danh sách chờ duyệt.
 *
 * An toàn: chỉ tạo hồ sơ cho CHÍNH người đang đăng nhập — id lấy từ phiên chứ
 * không lấy từ body, nên không thể tạo hộ hay sửa trạng thái người khác.
 * Dùng requireAuth() chứ không phải requireUser(), vì lúc này họ đương nhiên
 * chưa được duyệt.
 */
export async function POST() {
  const { user, response } = await requireAuth()
  if (response) return response

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Hai dự án có lược đồ profiles khác nhau: hanggon có cột email, population
  // thì không. Thử kèm email trước, không được thì lùi về bộ cột tối thiểu.
  const base = { id: user.id, is_active: false }
  let { error } = await admin.from('profiles').upsert({ ...base, email: user.email }, {
    onConflict: 'id',
    ignoreDuplicates: true,
  })
  if (error) {
    ;({ error } = await admin.from('profiles').upsert(base, {
      onConflict: 'id',
      ignoreDuplicates: true,
    }))
  }

  if (error) {
    // Không chặn luồng đăng ký: tài khoản vẫn được tạo và vẫn bị khóa đúng
    // (không có hồ sơ = chưa duyệt). Chỉ là quản trị phải tra auth.users.
    console.error('Không tạo được hồ sơ chờ duyệt:', error.message)
    return Response.json({ ok: false, warning: error.message })
  }

  return Response.json({ ok: true })
}
