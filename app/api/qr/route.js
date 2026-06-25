import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  try {
    const { data, error } = await supabase
      .from('qrvalue')
      .select('value')
      .eq('id', '12345678')
      .single()

    if (error || !data) return NextResponse.json({ cccd: '' })

    // Lấy dãy số đầu tiên trước dấu |
    const cccd = data.value.trim().split('|')[0] || ''
    return NextResponse.json({ cccd })
  } catch (err) {
    return NextResponse.json({ cccd: '' })
  }
}