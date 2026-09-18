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

    // `criteria` nhận cả hai dạng:
    //   - mảng [{ key, value }, ...]  → giữ được nhiều điều kiện trên CÙNG một
    //     cột (ví dụ HỌ TÊN chứa "NGUYỄN" VÀ HỌ TÊN chứa "VĂN A")
    //   - object { key: value }       → dạng cũ, một cột một điều kiện
    // Trước đây chỉ có dạng object nên hai ô "Chọn Dữ liệu" cùng cột thì ô sau
    // đè mất ô trước, tìm ra tập rộng hơn ý người dùng.
    const dieuKien = Array.isArray(criteria)
      ? criteria
          .map((c) => (Array.isArray(c) ? { key: c[0], value: c[1] } : c))
          .filter((c) => c && c.key != null)
          .map((c) => [c.key, c.value])
      : Object.entries(criteria || {});

    // 🔍 Tạo truy vấn theo kiểu fuzzy (ilike) hoặc exact (eq).
    // Mọi điều kiện đều nối bằng VÀ: chain .eq()/.ilike() trên PostgREST là AND.
    for (const [key, value] of dieuKien) {
      if (laCotBoolean(table, key)) {
        // 👉 cột boolean: ilike sẽ làm hỏng câu truy vấn, phải so bằng
        query = query.eq(key, doiSangBoolean(value));
      } else if (!fuzzy || key === "SOHOK") {
        // 👉 exact match
        query = query.eq(key, value);
      } else {
        // 👉 fuzzy match
        query = query.ilike(key, `%${value}%`);
      }
    }

    // 🏷️ Các ô phân loại bật/tắt (ANNINH, MATUY, TUTHA, THACD, TIENSU, TREHU...).
    // Gộp các ô đã bật bằng HOẶC: bật "Ma túy" + "Tù tha" là ra đối tượng ma
    // túy CỘNG đối tượng tù tha, chứ không phải người vừa ma túy vừa tù tha.
    // Không bật ô nào thì không lọc, tức là tìm tất cả.
    const flagsDaBat = [];
    for (const [key, on] of Object.entries(flags)) {
      if (!on) continue;
      if (!laCotBoolean(table, key)) {
        return Response.json(
          { error: `Cột phân loại không hợp lệ: ${String(key)}` },
          { status: 400 },
        );
      }
      flagsDaBat.push(key);
    }
    if (flagsDaBat.length) {
      // Nhóm `or(...)` vẫn nối VÀ với các điều kiện gõ tay ở trên, nên tìm
      // "HỌ TÊN = A" + ô "Ma túy"/"Tù tha" ra đúng người tên A thuộc một
      // trong hai loại.
      query = query.or(flagsDaBat.map((k) => `${k}.eq.true`).join(","));
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
