import { createClient } from "@supabase/supabase-js";
import {
  checkTable,
  laCotBoolean,
  doiSangBoolean,
  GIOI_HAN_KET_QUA,
} from '../../../lib/tables'
import { requireUser } from '../../../lib/auth'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // chỉ dùng server
);

export async function POST(req) {
  // Chặn truy cập chưa đăng nhập. Route dùng khóa service-role nên bỏ qua
  // Row Level Security — đây là chỗ duy nhất kiểm soát quyền.
  const { response: chuaDangNhap } = await requireUser()
  if (chuaDangNhap) return chuaDangNhap


  try {
    const body = await req.json();
    const { database, criteria = {}, flags = {}, fuzzy = false } = body;

    const { table, response: bangLa } = checkTable(database)
    if (bangLa) return bangLa

    let query = supabaseAdmin.from(table).select("*");

    // 🔍 Tạo truy vấn theo kiểu fuzzy (ilike) hoặc exact (match)
    if (fuzzy) {
      for (const [key, value] of Object.entries(criteria)) {
        if (laCotBoolean(table, key)) {
          // 👉 cột boolean: ilike sẽ làm hỏng câu truy vấn, phải so bằng
          query = query.eq(key, doiSangBoolean(value));
        } else if (key === "SOHOK") {
          // 👉 exact match
          query = query.eq(key, value);
        } else {
          // 👉 fuzzy match
          query = query.ilike(key, `%${value}%`);
        }
      }
    } else {
      query = query.match(criteria);
    }

    // 🏷️ Các ô phân loại bật/tắt (ANNINH, MATUY, TUTHA, THACD, TIENSU...).
    // Chỉ ô nào được bật mới thêm điều kiện — không bật ô nào thì không lọc,
    // tức là tìm tất cả.
    for (const [key, on] of Object.entries(flags)) {
      if (!on) continue;
      if (!laCotBoolean(table, key)) {
        return Response.json(
          { error: `Cột phân loại không hợp lệ: ${String(key)}` },
          { status: 400 },
        );
      }
      query = query.eq(key, true);
    }

    // 👉 Giới hạn số dòng trả về. Để 1000 (trần một lần gọi của PostgREST) vì
    // lọc theo ô phân loại có thể khớp hàng trăm dòng, mức 100 cũ sẽ cắt cụt
    // kết quả mà người dùng không hề biết.
    query = query.limit(GIOI_HAN_KET_QUA);

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(data || []);
  } catch (err) {
    console.error("Server error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
