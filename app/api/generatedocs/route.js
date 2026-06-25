import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

function processDocxTemplate(templateBuffer, dataDict) {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })
  doc.render(dataDict)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// Lấy tất cả file .docx/.doc trong folder và subfolder, bỏ qua file tạm ~$
function getAllTemplateFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(getAllTemplateFiles(fullPath, baseDir))
    } else if (
      (entry.name.endsWith('.docx') || entry.name.endsWith('.doc')) &&
      !entry.name.startsWith('~$') // Bỏ qua file tạm của Word
    ) {
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath)
      })
    }
  }
  return files
}

export async function POST(req) {
  try {
    const body = await req.json()
    const {
      cccd,
      tenkhac,
      noisinh,
      tdhv,
      nghenghiep,
      quequan,
      noioSameAsThuongtru,
      noiohientai,
      ngaycap,
      thangcap,
      namcap,
      noicap,
      sdt,
      noilamviec
    } = body

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    if (!cccd) {
      return NextResponse.json({ error: 'Thiếu số CCCD' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('population')
      .select('*')
      .eq('CCCD', cccd)
      .single()

    if (error) {
      console.error('Supabase error:', JSON.stringify(error))
      return NextResponse.json({ error: `Lỗi Supabase: ${error.message}` }, { status: 404 })
    }
    if (!data) {
      return NextResponse.json({ error: `Không tìm thấy CCCD: ${cccd}` }, { status: 404 })
    }

    const HOTEN = (data.HOTEN || '')
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    // Parse NAMSINH định dạng DD/MM/YYYY
    const parts = (data.NAMSINH || '').split('/')
    const NGAYSINH  = parts[0] || ''
    const THANGSINH = parts[1] || ''
    const NAMSINH   = parts[2] || ''

    const NOITHTRU = (() => {
      const raw = (data.NOITHTRU || '').toLowerCase()
        .replace('hàng gòn', 'Hàng Gòn')
        .replace('tân phong', 'Tân Phong')
        .replace('nông doanh', 'Nông Doanh')
        .replace('xuân tân', 'Xuân Tân')
        .replace('cẩm tân', 'Cẩm Tân')
        .replace('kp', 'KP')
      return raw + ', phường Hàng Gòn, thành phố Đồng Nai'
    })()

    const NOIOHIENTAI = noioSameAsThuongtru
      ? NOITHTRU
      : (noiohientai || '')

    const dataDict = {
      HOTEN,
      TENKHAC:    tenkhac    || '',
      NGAYSINH,
      THANGSINH,
      NAMSINH,
      GIOITINH:   data.GIOITINH ? 'Nam' : 'Nữ',
      CCCD:       data.CCCD  || '',
      NOITHTRU,
      NOIOHIENTAI,
      TENCHA:     data.TENCHA  || '',
      TENME:      data.TENME   || '',
      DANTOC:     (data.DANTOC  || '').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
      TONGIAO:    (data.TONGIAO || '').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
      NOISINH:    noisinh    || '',
      TRINHDO:    tdhv       || '',
      NGHENGHIEP: nghenghiep || '',
      QUEQUAN:    quequan    || '',
      NGAYCAP:    ngaycap    || '',
      THANGCAP:   thangcap   || '',
      NAMCAP:     namcap     || '',
      NOICAP:     noicap     || '',
      SDT:        sdt        || '',
      NOILAMVIEC:noilamviec|| ''
    }

    const templatesDir = path.join(process.cwd(), 'public', 'templates')

    if (!fs.existsSync(templatesDir)) {
      return NextResponse.json({ error: 'Không tìm thấy thư mục templates' }, { status: 500 })
    }

    const templateFiles = getAllTemplateFiles(templatesDir)

    if (templateFiles.length === 0) {
      return NextResponse.json({ error: 'Không có file template nào trong thư mục templates' }, { status: 500 })
    }

    const outputZip = new JSZip()

    for (const { fullPath, relativePath } of templateFiles) {
      const templateBuffer = fs.readFileSync(fullPath)
      try {
        const outputBuffer = processDocxTemplate(templateBuffer, dataDict)
        const outputName = relativePath
          .replace(/ PY\.docx$/, '.docx')
          .replace(/ PY\.doc$/, '.docx')
          .replace(/\.doc$/, '.docx')
        outputZip.file(outputName, outputBuffer)
      } catch (templateErr) {
        console.error(`Lỗi xử lý template ${relativePath}:`, templateErr)
      }
    }

    const zipBuffer = await outputZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('ho-so-' + HOTEN.replace(/\s+/g, '-') + '.zip')}`,
      },
    })
  } catch (err) {
    console.error('Generate docs error:', err)
    return NextResponse.json({ error: err.message || 'Lỗi không xác định' }, { status: 500 })
  }
}