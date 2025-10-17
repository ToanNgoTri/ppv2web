import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // chỉ dùng server
)

export async function POST(res) {
  try{
  const body = await res.json()
  const { data, error } = await supabaseAdmin.from(body.database).insert(body.newData)
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}