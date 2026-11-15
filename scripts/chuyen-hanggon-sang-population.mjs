/**
 * Chép TOÀN BỘ dữ liệu từ dự án hanggon sang dự án population, hanggon thắng
 * mọi chỗ khác nhau (ghi đè). KHÔNG đụng tài khoản (auth.users) và profiles của
 * population — cán bộ population vẫn đăng nhập như cũ.
 *
 *   node scripts/chuyen-hanggon-sang-population.mjs <bước...>
 *
 * Các bước (chạy riêng hoặc gộp, theo thứ tự ghi):
 *   crime        bảng crime        upsert theo CCCD, xoá dòng population-only
 *   population   bảng population   upsert theo CCCD, xoá dòng population-only
 *   anh          bucket imageCrime/subject — chép đè từng ảnh
 *   tamtru       bảng tamtru       (cần chạy sql/chuan-bi-population.sql trước)
 *   khuonmat     bảng khuon_mat    (cần chạy sql/chuan-bi-population.sql trước)
 *   tatca        tất cả các bước trên
 *
 * Đọc khoá từ .env.local (hanggon) và .env.population.local (population).
 * Trước khi chạy đã sao lưu population vào D:\Code\_backup\.
 */
import fs from 'node:fs'

const env = f =>
  Object.fromEntries(
    fs.readFileSync(f, 'utf8').split(/\r?\n/)
      .filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )

const SRC = env('.env.local')
const DST = env('.env.population.local')
if (!SRC.SUPABASE_URL.includes('cppilyhbusukcmrwpvfc') || !DST.SUPABASE_URL.includes('feuakoaglemujpwsspie')) {
  throw new Error('Sai dự án: .env.local phải là hanggon, .env.population.local phải là population')
}

const hdr = e => ({ apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` })

async function req(e, path, init = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(e.SUPABASE_URL + path, { ...init, headers: { ...hdr(e), ...(init.headers || {}) } })
      if (!r.ok) throw new Error(`${r.status} ${path}: ${(await r.text()).slice(0, 300)}`)
      return r
    } catch (err) {
      if (attempt >= 4) throw err
      await new Promise(res => setTimeout(res, 1000 * attempt)) // mạng chập chờn: thử lại
    }
  }
}

async function readAll(e, table, select = '*', order = 'CCCD') {
  let rows = [], o = 0
  for (;;) {
    const r = await req(e, `/rest/v1/${table}?select=${select}&order=${order}`, { headers: { Range: `${o}-${o + 999}` } })
    const j = await r.json()
    rows = rows.concat(j)
    if (j.length < 1000) return rows
    o += 1000
  }
}

async function copyTable(table, { key = 'CCCD', omit = [], deleteExtra = true } = {}) {
  const src = (await readAll(SRC, table, '*', key === 'CCCD' ? 'CCCD' : 'id')).map(r => {
    const x = { ...r }
    for (const k of omit) delete x[k]
    return x
  })
  for (let i = 0; i < src.length; i += 500) {
    await req(DST, `/rest/v1/${table}?on_conflict=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(src.slice(i, i + 500)),
    })
    process.stdout.write(`\r  ${table}: ${Math.min(i + 500, src.length)}/${src.length}`)
  }
  let removed = 0
  if (deleteExtra) {
    const keep = new Set(src.map(r => r[key]))
    const extra = (await readAll(DST, table, key, key)).map(r => r[key]).filter(k => !keep.has(k))
    for (let i = 0; i < extra.length; i += 100) {
      const list = extra.slice(i, i + 100).map(k => `"${k}"`).join(',')
      await req(DST, `/rest/v1/${table}?${key}=in.(${encodeURIComponent(list)})`, { method: 'DELETE' })
    }
    removed = extra.length
  }
  const n = (await readAll(DST, table, key, key)).length
  console.log(`\n  ${table}: ghi ${src.length} dòng, xoá ${removed} dòng thừa → population có ${n} dòng`)
  if (n !== src.length) throw new Error(`${table}: số dòng lệch (${n} ≠ ${src.length})`)
}

async function copyImages() {
  const list = async e =>
    (await (await req(e, '/storage/v1/object/list/imageCrime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: 'subject/', limit: 5000 }),
    })).json()).filter(o => o.id)
  const src = await list(SRC)
  let done = 0
  for (const o of src) {
    const path = `subject/${o.name}`
    const data = Buffer.from(await (await req(SRC, `/storage/v1/object/imageCrime/${path}`)).arrayBuffer())
    await req(DST, `/storage/v1/object/imageCrime/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': o.metadata?.mimetype || 'image/jpeg', 'x-upsert': 'true' },
      body: data,
    })
    process.stdout.write(`\r  ảnh: ${++done}/${src.length}`)
  }
  const keep = new Set(src.map(o => o.name))
  const extra = (await list(DST)).filter(o => !keep.has(o.name)).map(o => `subject/${o.name}`)
  if (extra.length) {
    await req(DST, '/storage/v1/object/imageCrime', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: extra }),
    })
  }
  console.log(`\n  ảnh: chép ${src.length}, xoá ${extra.length} ảnh thừa → population có ${(await list(DST)).length} ảnh`)
}

async function copyFaces() {
  // Vector tính từ đúng các ảnh vừa chép nên dùng lại được, khỏi quét lại.
  const src = await readAll(SRC, 'khuon_mat', 'CCCD,duong_dan,phien_ban,mat_so,khung,diem_phat_hien,vector', 'id')
  await req(DST, '/rest/v1/khuon_mat?id=gt.0', { method: 'DELETE' })
  for (let i = 0; i < src.length; i += 200) {
    await req(DST, '/rest/v1/khuon_mat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(src.slice(i, i + 200)),
    })
  }
  const n = (await readAll(DST, 'khuon_mat', 'id', 'id')).length
  console.log(`  khuon_mat: chép ${src.length} → population có ${n} dòng`)
  if (n !== src.length) throw new Error('khuon_mat: số dòng lệch')
}

const steps = process.argv.slice(2)
const all = steps.includes('tatca')
if (!steps.length) {
  console.log('Thiếu bước. Ví dụ: node scripts/chuyen-hanggon-sang-population.mjs crime population anh')
  process.exit(1)
}
if (all || steps.includes('crime')) await copyTable('crime')
if (all || steps.includes('population')) await copyTable('population')
if (all || steps.includes('anh')) await copyImages()
if (all || steps.includes('tamtru')) await copyTable('tamtru')
if (all || steps.includes('khuonmat')) await copyFaces()
console.log('Xong.')
