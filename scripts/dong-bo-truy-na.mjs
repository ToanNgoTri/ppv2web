/**
 * Chép danh sách truy nã từ dự án LuuTru sang dự án population (app ppv2bat).
 *
 *   node --use-system-ca scripts/dong-bo-truy-na.mjs
 *
 * LuuTru tự đồng bộ với truyna.bocongan.gov.vn (LuuTru: npm run truyna, hoặc
 * cap-nhat-truyna.bat). Script này chạy SAU bước đó: chép đè toàn bộ bảng
 * truy_na (thêm/sửa theo mã, xoá đối tượng không còn bên LuuTru) và dòng nhật
 * ký đồng bộ mới nhất.
 *
 * Khoá: LuuTru đọc từ ../LuuTru/.env (SUPABASE_URL, SUPABASE_SECRET_KEY);
 *       population đọc từ .env.population.local.
 * Bảng đích tạo bằng sql/tao-bang-truy-na.sql.
 */
import fs from 'node:fs'
import path from 'node:path'

const env = f =>
  Object.fromEntries(
    fs.readFileSync(f, 'utf8').split(/\r?\n/)
      .filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )

const L = env(path.resolve('../LuuTru/.env'))
const P = env('.env.population.local')
const SRC = { url: L.SUPABASE_URL, key: L.SUPABASE_SECRET_KEY }
const DST = { url: P.SUPABASE_URL, key: P.SUPABASE_SERVICE_ROLE_KEY }
if (!SRC.url?.includes('rkbzijjembmylylhpyyx') || !DST.url?.includes('feuakoaglemujpwsspie')) {
  throw new Error('Sai dự án: nguồn phải là LuuTru, đích phải là population')
}

async function req(e, p, init = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(e.url + p, {
        ...init,
        headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, ...(init.headers || {}) },
      })
      if (!r.ok) throw new Error(`${r.status} ${p}: ${(await r.text()).slice(0, 300)}`)
      return r
    } catch (err) {
      if (attempt >= 4) throw err
      await new Promise(res => setTimeout(res, 1000 * attempt))
    }
  }
}

async function readAll(e, table, select, order) {
  let rows = [], o = 0
  for (;;) {
    const j = await (await req(e, `/rest/v1/${table}?select=${select}&order=${order}`, {
      headers: { Range: `${o}-${o + 999}` },
    })).json()
    rows = rows.concat(j)
    if (j.length < 1000) return rows
    o += 1000
  }
}

const src = await readAll(SRC, 'truy_na', '*', 'ma')
if (src.length < 100) throw new Error(`LuuTru chỉ có ${src.length} đối tượng — có vẻ chưa đồng bộ, dừng để khỏi xoá nhầm`)

for (let i = 0; i < src.length; i += 500) {
  await req(DST, '/rest/v1/truy_na?on_conflict=ma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(src.slice(i, i + 500)),
  })
  process.stdout.write(`\r  truy_na: ${Math.min(i + 500, src.length)}/${src.length}`)
}

const keep = new Set(src.map(r => r.ma))
const extra = (await readAll(DST, 'truy_na', 'ma', 'ma')).map(r => r.ma).filter(m => !keep.has(m))
for (let i = 0; i < extra.length; i += 100) {
  await req(DST, `/rest/v1/truy_na?ma=in.(${extra.slice(i, i + 100).join(',')})`, { method: 'DELETE' })
}

const nk = await (await req(SRC, '/rest/v1/dong_bo_truy_na?select=*&ket_thuc=not.is.null&order=id.desc&limit=1')).json()
if (nk.length) {
  await req(DST, '/rest/v1/dong_bo_truy_na?on_conflict=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(nk),
  })
}

const n = (await readAll(DST, 'truy_na', 'ma', 'ma')).length
console.log(`\nXong: chép ${src.length}, xoá ${extra.length} → population có ${n} đối tượng truy nã` +
  (nk[0] ? ` (LuuTru cập nhật lúc ${new Date(nk[0].ket_thuc).toLocaleString('vi-VN')})` : ''))
