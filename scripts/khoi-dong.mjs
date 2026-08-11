/**
 * Script khởi động dùng chung cho macOS và Windows.
 *
 * chay.command / chay.bat chỉ là vỏ mỏng: tìm ra Node rồi gọi file này.
 * Mọi logic kiểm tra nằm ở đây để hai hệ dùng chung một nguồn, không lệch nhau.
 *
 * Việc nó làm, theo thứ tự:
 *   1. đọc .env.local để biết cấu hình đang dùng (app tự đọc lại file này)
 *   2. kiểm 4 biến Supabase — thiếu thì in hướng dẫn sửa rồi dừng
 *   3. kiểm mạng tới Supabase — không tới được thì CẢNH BÁO nhưng vẫn chạy
 *   4. kiểm thư mục template — thiếu thì cảnh báo (chỉ chức năng hồ sơ bị ảnh hưởng)
 *   5. bật server.js và mở trình duyệt
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const GOC = dirname(fileURLToPath(import.meta.url))
process.chdir(GOC)

const LA_WINDOWS = process.platform === 'win32'

/** Biến bắt buộc: thiếu bất kỳ cái nào là app chạy lên nhưng mọi thao tác đều lỗi. */
const BIEN_BAT_BUOC = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

/** Giữ cửa sổ lại để người dùng đọc được lỗi, thay vì nó biến mất ngay. */
async function dungLai(ma = 1) {
  process.stdout.write('\nBấm Enter để đóng...')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  await new Promise((r) => rl.question('', () => r()))
  rl.close()
  process.exit(ma)
}

/** Đọc .env.local đủ dùng cho việc kiểm tra (app dùng bộ đọc của Next). */
function docEnvLocal() {
  const f = join(GOC, '.env.local')
  if (!existsSync(f)) return {}
  /** @type {Record<string,string>} */
  const ra = {}
  for (const dong of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = dong.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    ra[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return ra
}

const env = docEnvLocal()
// Đưa vào process.env để phần kiểm bên dưới và server con đều thấy.
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v

// ── 2. Biến Supabase ────────────────────────────────────────────────────────
const thieu = BIEN_BAT_BUOC.filter((k) => !process.env[k]?.trim())
if (thieu.length) {
  console.error('✗ Thiếu cấu hình Supabase trong file .env.local:')
  for (const k of thieu) console.error(`    ${k}`)
  console.error(`\n  Mở file .env.local (cùng thư mục này) bằng Notepad / TextEdit và thêm:\n`)
  for (const k of thieu) console.error(`    ${k}=...`)
  console.error(`\n  Lấy giá trị ở Supabase → Project Settings → API.`)
  console.error(`  SUPABASE_URL và NEXT_PUBLIC_SUPABASE_URL là cùng một URL.`)
  await dungLai()
}

/** Lấy hostname để kiểm mạng; URL sai định dạng cũng chặn luôn tại đây. */
let hostSupabase = ''
try {
  hostSupabase = new URL(process.env.SUPABASE_URL).hostname
} catch {
  console.error(`✗ SUPABASE_URL không phải URL hợp lệ: "${process.env.SUPABASE_URL}"`)
  console.error('  Phải có dạng:  https://xxxxxxxx.supabase.co')
  await dungLai()
}
console.log(`ℹ Supabase: ${hostSupabase}`)

// ── 3. Mạng ─────────────────────────────────────────────────────────────────
try {
  await lookup(hostSupabase)
} catch {
  console.log(`\n⚠ Không phân giải được ${hostSupabase} — máy này có vẻ không có Internet.`)
  console.log('  Giao diện vẫn mở được, nhưng tra cứu / thêm / sửa / xoá sẽ lỗi mạng,')
  console.log('  vì toàn bộ dữ liệu nằm trên Supabase chứ không nằm trong gói này.\n')
}

// ── 4. Template hồ sơ ───────────────────────────────────────────────────────
const THU_MUC_TEMPLATE = join(GOC, 'public', 'templates')
if (!existsSync(THU_MUC_TEMPLATE)) {
  console.log('⚠ Không thấy public/templates — chức năng xuất hồ sơ .docx sẽ báo lỗi.')
} else {
  // Đếm để phát hiện gói bị copy thiếu, chứ không chỉ kiểm thư mục có tồn tại.
  let soFile = 0
  const dem = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) dem(join(d, e.name))
      else if (/\.docx?$/i.test(e.name) && !e.name.startsWith('~$')) soFile++
    }
  }
  dem(THU_MUC_TEMPLATE)
  if (soFile === 0) console.log('⚠ public/templates không có file .docx nào — xuất hồ sơ sẽ ra file rỗng.')
  else console.log(`ℹ Template hồ sơ: ${soFile} file`)
}

// ── 5. Bật server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || '3000'
const URL_APP = `http://localhost:${PORT}`

console.log(`▶ Đang chạy trên ${URL_APP}   (Ctrl+C để dừng)`)

const con = spawn(process.execPath, [join(GOC, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT, HOSTNAME: process.env.HOSTNAME || '127.0.0.1' },
})

setTimeout(() => {
  const [lenh, args] = LA_WINDOWS
    ? ['cmd', ['/c', 'start', '', URL_APP]]
    : process.platform === 'darwin'
      ? ['open', [URL_APP]]
      : ['xdg-open', [URL_APP]]
  spawn(lenh, args, { stdio: 'ignore', detached: true }).unref()
}, 2000)

con.on('exit', async (ma) => {
  if (ma && ma !== 0) {
    console.error(`\n✗ Server dừng với mã ${ma}.`)
    if (ma === 1) console.error('  Cổng có thể đang bị chiếm. Thử đổi cổng: PORT=4000')
    await dungLai(ma)
  }
  process.exit(ma ?? 0)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    con.kill()
    process.exit(0)
  })
}
