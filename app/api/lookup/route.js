import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const cccd = searchParams.get('cccd')

  if (!cccd) {
    return NextResponse.json({ error: 'Thiếu CCCD' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    // Lấy QR từ qrvalue để lấy ngày cấp
    const { data: qrRow } = await supabase
      .from('qrvalue')
      .select('value')
      .eq('id', '12345678')
      .single()

    let ngaycap = '', thangcap = '', namcap = '', qrNoithtru = ''
    if (qrRow?.value) {
      const qr = qrRow.value.trim().replace(/\|$/, '').split('|')
      ngaycap  = (qr[6] || '').slice(0, 2)
      thangcap = (qr[6] || '').slice(2, 4)
      namcap   = (qr[6] || '').slice(4, 8)
      qrNoithtru = qr[5] || ''
    }

    // Tìm trong population
    const { data, error } = await supabase
      .from('population')
      .select('*')
      .eq('CCCD', cccd)
      .single()

    if (data && !error) {
      // Có trong DB
      const parts = (data.NAMSINH || '').split('/')
      const noithtru = (data.NOITHTRU || '').toLowerCase()
        .replace('hàng gòn', 'Hàng Gòn')
        .replace('tân phong', 'Tân Phong')
        .replace('nông doanh', 'Nông Doanh')
        .replace('xuân tân', 'Xuân Tân')
        .replace('cẩm tân', 'Cẩm Tân')
        .replace('kp', 'KP')
        + ', phường Hàng Gòn, thành phố Đồng Nai'

      return NextResponse.json({
        source: 'db',
        form: {
          cccd:      data.CCCD || '',
          hoten:     (data.HOTEN || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          ngaysinh:  parts[0] || '',
          thangsinh: parts[1] || '',
          namsinh:   parts[2] || '',
          gioitinh:  data.GIOITINH ? 'Nam' : 'Nữ',
          noithtru,
          tencha:    data.TENCHA  || '',
          tenme:     data.TENME   || '',
          dantoc:    (data.DANTOC  || '').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
          tongiao:   (data.TONGIAO || '').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
          ngaycap, thangcap, namcap,
        }
      })
    }

    // Không có trong DB → trả về form trống, chỉ điền từ QR những gì có
    return NextResponse.json({
      source: 'qr',
      form: {
        cccd,
        hoten: '', ngaysinh: '', thangsinh: '', namsinh: '',
        gioitinh: '', noithtru: qrNoithtru,
        tencha: '', tenme: '', dantoc: '', tongiao: '',
        ngaycap, thangcap, namcap,
      }
    })
  } catch (err) {
    console.error('Lookup error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}