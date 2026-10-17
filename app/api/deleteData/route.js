import { createClient } from "@supabase/supabase-js";
import { checkTable } from '../../../lib/tables'
import { requireUser } from '../../../lib/auth'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // chỉ dùng server
);

export async function POST(res) {
  // Chặn truy cập chưa đăng nhập. Route dùng khóa service-role nên bỏ qua
  // Row Level Security — đây là chỗ duy nhất kiểm soát quyền.
  const { response: chuaDangNhap } = await requireUser()
  if (chuaDangNhap) return chuaDangNhap


  const body = await res.json();

  const { table, response: bangLa } = checkTable(body.database)
  if (bangLa) return bangLa

  // Nhân khẩu không xóa hẳn khỏi bảng: chỉ bật cờ DELETED để còn tra lại được
  // (giao diện hiện nền xám). `restore: true` là khôi phục. Bảng crime chưa có
  // cột này nên vẫn xóa thật như cũ.
  const query = table === "population"
    ? supabaseAdmin.from(table).update({ DELETED: !body.restore })
    : supabaseAdmin.from(table).delete();
  const { data, error } = await query.eq("CCCD", body.CCCD);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json(error);
}
