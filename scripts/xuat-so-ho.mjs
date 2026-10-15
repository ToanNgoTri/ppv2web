/**
 * Xuất sổ hộ gia đình mẫu KV2: mỗi hộ một trang A4 ngang, gom thành MỘT FILE
 * .docx CHO MỖI TỔ (trong từng khu phố) để in và đóng cuốn.
 *
 * Vì sao không in từ trang web: cả phường ~5.400 hộ = 5.400 trang, mỗi trang
 * một bảng 20 dòng × 18 cột. Trình duyệt dựng một lượt là treo. Script này
 * chạy một lần ở máy có project, ghi file ra đĩa, mỗi tổ vài trăm KB.
 *
 *   node scripts/xuat-so-ho.mjs --kp "HÀNG GÒN" --to 10      một tổ
 *   node scripts/xuat-so-ho.mjs --kp "HÀNG GÒN"              cả khu phố, mỗi tổ một file
 *   node scripts/xuat-so-ho.mjs --tat-ca                     cả phường
 *   node scripts/xuat-so-ho.mjs --tat-ca --mot-file-moi-kp   cả phường, mỗi khu phố một file
 *
 * Cờ khác:
 *   --du-an <tên>   đọc .env.<tên>.local (population | hanggon). Không ghi: .env.local
 *   --ra <thư mục>  nơi ghi file. Mặc định: xuat-so-ho/ trong project
 *   --mau <file>    file mẫu .docx. Mặc định public/templates/KV2.docx, thiếu thì tự tạo
 *
 * Dữ liệu lấy từ bảng population:
 *   SOHOK → Số hồ sơ cư trú (khoá gom hộ)   NOITHTRU → Địa chỉ cư trú + tổ/khu phố
 *   QUANHE = CHỦ HỘ → tên trên đầu trang      GIOITINH → ngày sinh vào cột Nam hay Nữ
 * Cột (6) Quê quán, (11)–(16) không có trong CSDL → để trống điền tay.
 * Cột (9) Quốc tịch in sẵn "Việt Nam".
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { DUONG_DAN_MAU, DONG_MOI_TRANG, ghiMauKV2 } from './mau-kv2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GOC = path.join(__dirname, '..')

// ---- Cờ dòng lệnh -----------------------------------------------------------
function docCo(argv) {
  const co = { kp: null, to: null, tatCa: false, motFileMoiKp: false, duAn: null, ra: null, mau: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const sau = () => argv[++i]
    if (a === '--kp') co.kp = sau()
    else if (a === '--to') co.to = sau()
    else if (a === '--tat-ca') co.tatCa = true
    else if (a === '--mot-file-moi-kp') co.motFileMoiKp = true
    else if (a === '--du-an') co.duAn = sau()
    else if (a === '--ra') co.ra = sau()
    else if (a === '--mau') co.mau = sau()
    else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0) }
    else throw new Error(`Cờ lạ: ${a} (xem --help)`)
  }
  if (!co.tatCa && !co.kp) throw new Error('Phải có --kp "<khu phố>" hoặc --tat-ca (xem --help)')
  return co
}

// ---- Env ---------------------------------------------------------------------
function docEnv(duAn) {
  const ten = duAn ? `.env.${duAn}.local` : '.env.local'
  const file = path.join(GOC, ten)
  if (!fs.existsSync(file)) throw new Error(`Thiếu ${ten} — xem HUONG-DAN.md`)
  const env = {}
  for (const dong of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const d = dong.trim()
    if (!d || d.startsWith('#')) continue
    const i = d.indexOf('=')
    if (i > 0) env[d.slice(0, i).trim()] = d.slice(i + 1).trim()
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`${ten} thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY`)
  }
  return { ten, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }
}

// ---- Đọc dữ liệu --------------------------------------------------------------
const COT_DOC = 'SOHOK,HOTEN,QUANHE,NAMSINH,GIOITINH,CCCD,DANTOC,TONGIAO,NOITHTRU,SDT,GHICHU'
const TRANG = 1000 // PostgREST trả tối đa 1000 dòng một lần

async function docTatCa(supabase) {
  const rows = []
  for (let tu = 0; ; tu += TRANG) {
    const { data, error } = await supabase
      .from('population')
      .select(COT_DOC)
      .order('SOHOK', { ascending: true })
      .order('CCCD', { ascending: true })
      .range(tu, tu + TRANG - 1)
    if (error) throw new Error(`Supabase: ${error.message}`)
    rows.push(...data)
    process.stdout.write(`\r  đã đọc ${rows.length} dòng`)
    if (data.length < TRANG) break
  }
  process.stdout.write('\n')
  return rows
}

// ---- Chuẩn hoá địa chỉ ----------------------------------------------------------
const KHU_PHO = ['HÀNG GÒN', 'CẨM TÂN', 'XUÂN TÂN', 'TÂN PHONG', 'ĐỒI RÌU', 'NÔNG DOANH']

/** "TỔ 10, KP HÀNG GÒN" → { to: 10, kp: 'HÀNG GÒN' }. Không đọc được thì null. */
function docDiaChi(diaChi) {
  const s = String(diaChi || '').toUpperCase()
  // Người nhập hay gõ nhầm dấu: TỔ / TỐ / TỒ / TÔ / TO
  const mTo = /T[ỔỐỒÔO]\s*(\d+)/.exec(s)
  const to = mTo ? Number(mTo[1]) : null
  // "HÀNG GÒN ( TÂN PHONG CŨ)" → lấy tên xuất hiện TRƯỚC trong chuỗi
  let kp = null, viTri = Infinity
  for (const k of KHU_PHO) {
    const i = s.indexOf(k)
    if (i >= 0 && i < viTri) { kp = k; viTri = i }
  }
  return { to, kp }
}

function hoaDauTu(s) {
  return String(s || '').toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
}
function hoaChuDau(s) {
  const t = String(s || '').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Tên file không dấu: "HÀNG GÒN" → "Hang-Gon" */
function khongDau(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .trim().replace(/\s+/g, '-')
}

// ---- Gom hộ -------------------------------------------------------------------
/** Thứ tự in trong hộ: chủ hộ trước, rồi vợ/chồng, con, cháu… Không rõ quan hệ xếp cuối. */
const THU_TU_QUAN_HE = [
  'CHỦ HỘ', 'VỢ', 'CHỒNG', 'CHA', 'MẸ', 'CON', 'CON DÂU', 'CON RỂ',
  'CHÁU', 'CHÁU DÂU', 'CHÁU RỂ', 'CHẮT', 'ANH', 'CHỊ', 'EM', 'EM DÂU', 'EM RỂ',
]
function hangQuanHe(q) {
  const i = THU_TU_QUAN_HE.indexOf(String(q || '').toUpperCase().trim())
  return i < 0 ? (q ? THU_TU_QUAN_HE.length : THU_TU_QUAN_HE.length + 1) : i
}
function namSinh(ns) {
  const m = /(\d{4})/.exec(String(ns || ''))
  return m ? Number(m[1]) : 9999
}

/** Ô Ghi chú bị khoá chiều cao nên chỉ hiện được chừng này ký tự; dài hơn sẽ bị cắt khi in. */
const GHI_CHU_TOI_DA = 40

function gomHo(rows) {
  const theoSoHo = new Map()
  for (const r of rows) {
    const k = String(r.SOHOK || '').trim()
    if (!k) continue
    if (!theoSoHo.has(k)) theoSoHo.set(k, [])
    theoSoHo.get(k).push(r)
  }

  const canhBao = { khongChuHo: [], nhieuChuHo: [], khongRoTo: [], ghiChuDai: [] }
  const cacHo = []
  for (const [soHo, ds] of theoSoHo) {
    ds.sort((a, b) => hangQuanHe(a.QUANHE) - hangQuanHe(b.QUANHE) || namSinh(a.NAMSINH) - namSinh(b.NAMSINH))
    const chuHo = ds.filter((x) => String(x.QUANHE || '').toUpperCase() === 'CHỦ HỘ')
    if (chuHo.length === 0) canhBao.khongChuHo.push(soHo)
    if (chuHo.length > 1) canhBao.nhieuChuHo.push(soHo)
    const daiDien = chuHo[0] || ds[0]
    for (const x of ds) {
      if (String(x.GHICHU || '').length > GHI_CHU_TOI_DA) canhBao.ghiChuDai.push(`${soHo} ${hoaDauTu(x.HOTEN)}`)
    }
    const { to, kp } = docDiaChi(daiDien.NOITHTRU)
    if (to === null || kp === null) canhBao.khongRoTo.push(`${soHo} (${daiDien.NOITHTRU || 'trống'})`)
    cacHo.push({
      soHo,
      to,
      kp,
      chuHo: hoaDauTu(daiDien.HOTEN) + (chuHo.length ? '' : ' (chưa ghi chủ hộ)'),
      diaChi: hoaDauTu(daiDien.NOITHTRU),
      nhanKhau: ds,
    })
  }
  // Trong một tổ: xếp theo số hồ sơ để tra cứu được bằng mắt
  cacHo.sort((a, b) => a.soHo.localeCompare(b.soHo, 'vi', { numeric: true }))
  return { cacHo, canhBao }
}

// ---- Dữ liệu cho mẫu --------------------------------------------------------------
function dongTrong() {
  return {
    TT: '', HOTEN: '', QUANHE: '', NAM: '', NU: '', QUEQUAN: '', CCCD: '', DANTOC: '',
    QUOCTICH: '', TONGIAO: '', NGHENGHIEP: '', ODAUDEN: '', CHUYENDI: '', THAIDO: '',
    THUCTE: '', QHXH: '', SDT: '', GHICHU: '',
  }
}

function dongNhanKhau(r, tt) {
  return {
    ...dongTrong(),
    TT: String(tt),
    HOTEN: hoaDauTu(r.HOTEN),
    QUANHE: hoaChuDau(r.QUANHE),
    NAM: r.GIOITINH === true ? (r.NAMSINH || '') : '',
    NU: r.GIOITINH === true ? '' : (r.NAMSINH || ''),
    CCCD: r.CCCD || '',
    DANTOC: hoaChuDau(r.DANTOC),
    QUOCTICH: 'Việt Nam',
    TONGIAO: hoaChuDau(r.TONGIAO),
    SDT: r.SDT || '',
    GHICHU: r.GHICHU || '',
  }
}

/** Một hộ → một hay nhiều trang (hộ trên 20 người thì sang trang tiếp, lặp đầu trang). */
function trangCuaHo(ho) {
  const trang = []
  const ds = ho.nhanKhau
  for (let tu = 0; tu < Math.max(ds.length, 1); tu += DONG_MOI_TRANG) {
    const phan = ds.slice(tu, tu + DONG_MOI_TRANG)
    const NK = phan.map((r, i) => dongNhanKhau(r, tu + i + 1))
    while (NK.length < DONG_MOI_TRANG) NK.push(dongTrong())
    trang.push({ CHUHO: ho.chuHo, SOHOK: ho.soHo, DIACHI: ho.diaChi, NK })
  }
  return trang
}

function taoDocx(mauBuffer, cacHo) {
  const HO = cacHo.flatMap(trangCuaHo).map((t, i) => ({ ...t, CHUA_DAU: i > 0 }))
  const doc = new Docxtemplater(new PizZip(mauBuffer), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })
  doc.render({ HO })
  return { buffer: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }), soTrang: HO.length }
}

// ---- Chạy -----------------------------------------------------------------------
async function main() {
  const co = docCo(process.argv.slice(2))
  const env = docEnv(co.duAn)
  console.log(`Đọc dữ liệu từ ${env.ten} (${env.url})`)

  const duongDanMau = co.mau ? path.resolve(co.mau) : DUONG_DAN_MAU
  if (!fs.existsSync(duongDanMau)) {
    console.log('Chưa có file mẫu, tạo mới:', ghiMauKV2(duongDanMau))
  }
  const mauBuffer = fs.readFileSync(duongDanMau)

  const supabase = createClient(env.url, env.key, { auth: { persistSession: false } })
  const rows = await docTatCa(supabase)
  const { cacHo, canhBao } = gomHo(rows)
  console.log(`  ${rows.length} nhân khẩu, ${cacHo.length} hộ`)

  // Lọc theo cờ
  const kpChon = co.kp ? co.kp.toUpperCase().trim() : null
  if (kpChon && !KHU_PHO.includes(kpChon)) {
    throw new Error(`Khu phố "${co.kp}" không có trong danh sách: ${KHU_PHO.join(', ')}`)
  }
  const toChon = co.to != null ? Number(co.to) : null
  const hoChon = cacHo.filter((h) =>
    (kpChon === null || h.kp === kpChon) && (toChon === null || h.to === toChon))
  if (!hoChon.length) throw new Error('Không có hộ nào khớp điều kiện')

  // Gom thành file: mặc định mỗi (khu phố, tổ) một file; --mot-file-moi-kp thì mỗi khu phố một file
  const nhom = new Map()
  for (const h of hoChon) {
    const kp = h.kp || 'CHUA-RO-KHU-PHO'
    const k = co.motFileMoiKp ? kp : `${kp}|${h.to ?? 'CHUA-RO-TO'}`
    if (!nhom.has(k)) nhom.set(k, { kp, to: h.to, ho: [] })
    nhom.get(k).ho.push(h)
  }

  const thuMucRa = path.resolve(co.ra || path.join(GOC, 'xuat-so-ho'))
  let tongTrang = 0
  const khoa = [...nhom.keys()].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
  for (const k of khoa) {
    const n = nhom.get(k)
    const thuMuc = path.join(thuMucRa, khongDau(n.kp))
    fs.mkdirSync(thuMuc, { recursive: true })
    const tenFile = co.motFileMoiKp
      ? `KV2-${khongDau(n.kp)}.docx`
      : `KV2-${khongDau(n.kp)}-To-${n.to ?? 'chua-ro'}.docx`
    const { buffer, soTrang } = taoDocx(mauBuffer, n.ho)
    const duongDan = path.join(thuMuc, tenFile)
    fs.writeFileSync(duongDan, buffer)
    tongTrang += soTrang
    console.log(`  ${path.relative(GOC, duongDan)}: ${n.ho.length} hộ, ${soTrang} trang, ${(buffer.length / 1024).toFixed(0)} KB`)
  }
  console.log(`Xong: ${nhom.size} file, ${hoChon.length} hộ, ${tongTrang} trang → ${thuMucRa}`)

  // Cảnh báo dữ liệu — chỉ những hộ nằm trong phạm vi đã chọn
  const trongPhamVi = new Set(hoChon.map((h) => h.soHo))
  const loc = (ds) => ds.filter((s) => trongPhamVi.has(String(s).split(' ')[0]))
  const inCanhBao = (ten, ds) => {
    const d = loc(ds)
    if (!d.length) return
    console.log(`\n⚠ ${ten} (${d.length}): ${d.slice(0, 30).join(', ')}${d.length > 30 ? ', …' : ''}`)
  }
  inCanhBao('Hộ không có dòng CHỦ HỘ — đầu trang lấy người đầu tiên, có ghi "(chưa ghi chủ hộ)"', canhBao.khongChuHo)
  inCanhBao('Hộ có nhiều hơn một CHỦ HỘ', canhBao.nhieuChuHo)
  inCanhBao('Hộ không đọc được tổ/khu phố từ địa chỉ', canhBao.khongRoTo)
  inCanhBao(`Ghi chú dài hơn ${GHI_CHU_TOI_DA} ký tự — sẽ bị cắt trong ô`, canhBao.ghiChuDai)
}

main().catch((e) => { console.error('Lỗi:', e.message); process.exit(1) })
