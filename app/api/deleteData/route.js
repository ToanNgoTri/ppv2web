import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // chỉ dùng server
);

export async function POST(res) {
  const body = await res.json();
  const { data, error } = await supabaseAdmin
    .from(body.database)
    .delete()
    .eq("CCCD", body.CCCD);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json(error);
}
