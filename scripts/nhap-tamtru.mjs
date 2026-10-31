/**
 * Nhập tamtru.json (do replaceBieuMau sinh ra) vào bảng `tamtru` của CẢ HAI dự
 * án Supabase — hanggon và population — bằng khóa service-role.
 *
 * Bảng phải có trước: chạy sql/tao-bang-tamtru.sql trong SQL Editor của từng dự
 * án (supabase-js không chạy được lệnh tạo bảng).
 *
 *   node scripts/nhap-tamtru.mjs <tamtru.json>                     cả hai dự án
 *   node scripts/nhap-tamtru.mjs <tamtru.json> --du-an hanggon     một dự án
 *   node scripts/nhap-tamtru.mjs <tamtru.json> --thu               chỉ kiểm tra, không ghi
 *
 * Ghi bằng UPSERT theo CCCD: chạy lại với bản kết xuất mới thì người cũ được
 * cập nhật, người mới được thêm. Cột người dùng tự sửa trên app (GHICHU,
 * LOCATION) KHÔNG bị ghi đè cho người đã có —
 * file kết xuất không có các cột này, ghi đè là xoá mất công nhập tay.
 * Muốn làm lại từ đầu thì `truncate public.tamtru;` rồi chạy lại.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CAC_DU_AN = ['hanggon', 'population']
const ME = 500

/** Cột do người dùng nhập trên app/web — giữ nguyên cho người đã có trong bảng. */
const COT_NGUOI_DUNG = ['GHICHU', 'LOCATION']

// ---- Tham số -----------------------------------------------------------------
const argv = process.argv.slice(2)
const iDuAn = argv.indexOf('--du-an')
const duAn = iDuAn >= 0 ? argv[iDuAn + 1] : null
const chiThu = argv.includes('--thu')
const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--du-an')

if (!file) {
  console.error('Dùng: node scripts/nhap-tamtru.mjs <tamtru.json> [--du-an hanggon|population] [--thu]')
  process.exit(1)
}
if (duAn && !CAC_DU_AN.includes(duAn)) {
  console.error(`--du-an chỉ nhận: ${CAC_DU_AN.join(', ')}`)
  process.exit(1)
}

// ---- Env (giống scripts/xuat-so-ho.mjs) ----------------------------------------
function docEnv(duAn) {
  const ten = `.env.${duAn}.local`
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

// ---- Dữ liệu -------------------------------------------------------------------
const banGhi = JSON.parse(fs.readFileSync(file, 'utf8'))
if (!Array.isArray(banGhi) || !banGhi.length || !banGhi[0].CCCD || !('NGAYDEN' in banGhi[0])) {
  console.error(`${file} không phải tamtru.json (mảng bản ghi có CCCD và NGAYDEN).`)
  process.exit(1)
}

/** CCCD đã có trong bảng — đọc theo trang vì PostgREST trả tối đa 1000 dòng/lần. */
async function cccdDaCo(sb) {
  const co = new Set()
  for (let tu = 0; ; tu += 1000) {
    const { data, error } = await sb.from('tamtru').select('CCCD').range(tu, tu + 999)
    if (error) throw error
    for (const d of data) co.add(d.CCCD)
    if (data.length < 1000) return co
  }
}

async function nhap(duAn) {
  const env = docEnv(duAn)
  const sb = createClient(env.url, env.key, { auth: { persistSession: false } })

  let co
  try {
    co = await cccdDaCo(sb)
  } catch (loi) {
    const thieuBang = loi.code === 'PGRST205' || /tamtru/.test(loi.message || '')
    throw new Error(
      thieuBang
        ? `chưa có bảng tamtru — chạy sql/tao-bang-tamtru.sql trong SQL Editor của dự án ${duAn} trước`
        : loi.message,
    )
  }

  const moi = banGhi.filter((b) => !co.has(b.CCCD))
  // Người đã có: bỏ các cột người dùng tự nhập để upsert không ghi đè chúng.
  const cu = banGhi
    .filter((b) => co.has(b.CCCD))
    .map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => !COT_NGUOI_DUNG.includes(k))))

  console.log(`[${duAn}] bảng đang có ${co.size} dòng → thêm ${moi.length}, cập nhật ${cu.length}`)
  if (chiThu) return

  // Hai nhóm có tập cột khác nhau nên upsert riêng — PostgREST đòi mọi dòng
  // trong một lần gửi cùng tập khoá.
  for (const nhom of [moi, cu]) {
    for (let i = 0; i < nhom.length; i += ME) {
      const { error } = await sb.from('tamtru').upsert(nhom.slice(i, i + ME), { onConflict: 'CCCD' })
      if (error) throw new Error(`ghi dòng ${i + 1}–${i + ME}: ${error.message}`)
    }
  }

  const { count, error } = await sb.from('tamtru').select('*', { count: 'exact', head: true })
  if (error) throw error
  console.log(`[${duAn}] xong — bảng tamtru hiện có ${count} dòng`)
}

let loi = 0
for (const d of duAn ? [duAn] : CAC_DU_AN) {
  try {
    await nhap(d)
  } catch (e) {
    loi++
    console.error(`[${d}] LỖI: ${e.message}`)
  }
}
process.exit(loi ? 1 : 0)
