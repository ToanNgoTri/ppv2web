import { createClient } from '@supabase/supabase-js'
import { requireUser } from '../../../lib/auth'
import { kiemTraChiDoc, donCauLenh, kepGioiHan } from '../../../lib/sql'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // chỉ dùng server
)

/**
 * Chạy một câu lệnh SELECT do người dùng dán vào màn hình /sql.
 *
 * Route này KHÔNG tự chạy SQL — nó gọi hàm public.chay_truy_van trong Postgres
 * (xem sql/truy-van-sql.sql). Việc chặn ghi nằm ở hàm đó; phần kiểm tra bên dưới
 * chỉ để trả lỗi tiếng Việt sớm và rõ.
 */
export async function POST(req) {
  // Route dùng khóa service-role nên bỏ qua Row Level Security — đây là chỗ
  // duy nhất kiểm soát quyền.
  const { response: chuaDangNhap } = await requireUser()
  if (chuaDangNhap) return chuaDangNhap

  try {
    const body = await req.json()
    const cauLenh = donCauLenh(body?.sql)

    const loi = kiemTraChiDoc(cauLenh)
    if (loi) return Response.json({ error: loi }, { status: 400 })

    const gioiHan = kepGioiHan(body?.limit)

    const batDau = Date.now()
    const { data, error } = await supabaseAdmin.rpc('chay_truy_van', {
      cau_lenh: cauLenh,
      gioi_han: gioiHan,
    })
    const mili = Date.now() - batDau

    if (error) {
      // Chưa chạy sql/truy-van-sql.sql thì Supabase báo không tìm thấy hàm —
      // lỗi đó khó đoán, nên dịch thành câu chỉ đúng việc phải làm.
      const thieuHam =
        error.code === 'PGRST202' || /chay_truy_van/i.test(error.message || '')
      if (thieuHam) {
        return Response.json(
          {
            error:
              'Chưa cài hàm truy vấn trong Supabase. Mở Supabase → SQL Editor, ' +
              'dán toàn bộ file sql/truy-van-sql.sql rồi Run, sau đó thử lại.',
          },
          { status: 500 },
        )
      }
      return Response.json(
        { error: error.message, chiTiet: error.details || error.hint || null },
        { status: 400 },
      )
    }

    const rows = Array.isArray(data) ? data : []
    return Response.json({
      rows,
      soDong: rows.length,
      gioiHan,
      // Đủ đúng bằng giới hạn thì rất có thể còn dòng bị cắt — báo để người dùng
      // biết con số đang xem không phải toàn bộ.
      chamGioiHan: rows.length >= gioiHan,
      mili,
    })
  } catch (err) {
    console.error('runSql error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
