import { createClient } from '@supabase/supabase-js'
import { checkTable } from '../../../lib/tables'
import { requireUser } from '../../../lib/auth'

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // chỉ dùng server
)

export async function POST(res) {
  // Chặn truy cập chưa đăng nhập. Route dùng khóa service-role nên bỏ qua
  // Row Level Security — đây là chỗ duy nhất kiểm soát quyền.
  const { response: chuaDangNhap } = await requireUser()
  if (chuaDangNhap) return chuaDangNhap


  try{
  const body = await res.json()

  const { table, response: bangLa } = checkTable(body.database)
  if (bangLa) return bangLa

  const { data, error } = await supabaseAdmin.from(table).insert(body.newData)
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}