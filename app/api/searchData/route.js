import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // chỉ dùng server
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { database, criteria = {}, fuzzy = false } = body;

    if (!database) {
      return Response.json({ error: "Thiếu tên database" }, { status: 400 });
    }

    let query = supabaseAdmin.from(database).select("*");

    // 🔍 Tạo truy vấn theo kiểu fuzzy (ilike) hoặc exact (match)
    if (fuzzy) {
      for (const [key, value] of Object.entries(criteria)) {
        if (key === "SOHOK") {
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

    // 👉 Có thể thêm limit để tránh trả về quá nhiều kết quả
    query = query.limit(100);

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
