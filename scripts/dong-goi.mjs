/**
 * Đóng gói app thành một thư mục tự chứa: copy sang máy khác là chạy được,
 * KHÔNG cần npm install, KHÔNG cần cài Node.
 *
 * Viết bằng Node (không phải bash) để chạy được cả trên Windows và macOS.
 *
 *   node scripts/dong-goi.mjs --windows
 *   node scripts/dong-goi.mjs --mac --ra /Volumes/USB
 *   node scripts/dong-goi.mjs --help
 */
import { spawn } from 'node:child_process'
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GOC = resolve(fileURLToPath(import.meta.url), '..', '..')
const NODE_VER = 'v22.14.0'
const TEN_APP = 'ppv2web'

// ── hướng dẫn ───────────────────────────────────────────────────────────────
const HUONG_DAN = `Cách dùng:
  npm run dong-goi:mac              gói cho macOS
  npm run dong-goi:win              gói cho Windows 64-bit
  node scripts/dong-goi.mjs [cờ...]

Cờ — viết kiểu nào cũng nhận (--windows, -windows, windows, win, WIN):
  --windows            đóng gói cho Windows 64-bit
  --mac                đóng gói cho macOS (mặc định = hệ đang chạy)
  --khong-node         không nhúng Node (máy đích phải tự có Node >= 20)
  --khong-env          KHÔNG mang .env.local theo (không nhúng khoá Supabase)
  --ra <thư mục>       đặt gói vào thư mục khác, ví dụ:  --ra D:\\USB
  --help               in bảng này

Ví dụ đóng gói Windows ra thẳng USB:
  node scripts/dong-goi.mjs --windows --ra D:\\USB
  node scripts/dong-goi.mjs --windows --ra /Volumes/USB

QUAN TRỌNG khi chạy qua npm: phải có -- trước cờ.
  ĐÚNG :  npm run dong-goi -- --windows
  SAI  :  npm run dong-goi --windows      <- npm ăn mất cờ, bạn nhận gói của hệ mặc định
Dùng  npm run dong-goi:win  thì không phải nhớ chuyện này.`

// ── đọc cờ ──────────────────────────────────────────────────────────────────
/** Mặc định đóng cho chính hệ đang chạy, vì đó là ý người dùng hay muốn nhất. */
let hdh = process.platform === 'win32' ? 'windows' : 'mac'
let nhungNode = true
let mangEnv = true
let thuMucRa = ''

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const goc = args[i]
  const co = goc.toLowerCase()
  if (['--windows', '-windows', 'windows', '--win', '-win', 'win', '-w'].includes(co)) {
    hdh = 'windows'
  } else if (['--mac', '-mac', 'mac', '--macos', '-macos', 'macos', '-m'].includes(co)) {
    hdh = 'mac'
  } else if (
    ['--khong-node', '-khong-node', 'khong-node', '--khong_node', '--no-node', '-no-node'].includes(co)
  ) {
    nhungNode = false
  } else if (
    ['--khong-env', '-khong-env', 'khong-env', '--khong_env', '--no-env', '-no-env'].includes(co)
  ) {
    mangEnv = false
  } else if (['--ra', '-ra', '--out', '-out', '-o'].includes(co)) {
    thuMucRa = args[++i] ?? ''
    if (!thuMucRa) thoat('✗ Cờ --ra cần kèm đường dẫn thư mục.')
  } else if (co.startsWith('--ra=') || co.startsWith('--out=')) {
    thuMucRa = goc.slice(goc.indexOf('=') + 1)
  } else if (['--help', '-h', '-help', 'help'].includes(co)) {
    console.log(HUONG_DAN)
    process.exit(0)
  } else {
    console.error(`✗ Không hiểu cờ: ${goc}\n`)
    console.error(HUONG_DAN)
    process.exit(1)
  }
}

function thoat(msg) {
  console.error(msg)
  process.exit(1)
}

// ── thư mục đích ────────────────────────────────────────────────────────────
if (thuMucRa) {
  if (thuMucRa === '~') thuMucRa = homedir()
  else if (thuMucRa.startsWith('~/')) thuMucRa = join(homedir(), thuMucRa.slice(2))
  thuMucRa = resolve(thuMucRa)
} else {
  thuMucRa = join(GOC, 'dist-offline')
}

const RA = join(thuMucRa, `${TEN_APP}-${hdh}`)

// Bước dưới có xoá thư mục đích nên chặn mấy chỗ nguy hiểm.
if ([resolve('/'), homedir()].includes(RA) || thuMucRa === resolve('/')) {
  thoat(`✗ Không đóng gói trực tiếp vào ${RA}`)
}

console.log(`▶ Đóng gói cho: ${hdh}`)
console.log(`  Sẽ ghi vào: ${RA}`)
console.log(`  Đang chạy trên: ${process.platform} ${process.arch}\n`)

// ── tiện ích ────────────────────────────────────────────────────────────────
/** Chạy một lệnh, thừa hưởng stdio. shell:true để npm/tar trên Windows cũng gọi được. */
function chay(lenh, { im = false, cwd } = {}) {
  return new Promise((ok, loi) => {
    const p = spawn(lenh, { shell: true, cwd, stdio: im ? 'ignore' : 'inherit' })
    p.on('error', loi)
    p.on('exit', (ma) => (ma === 0 ? ok() : loi(new Error(`Lệnh thất bại (${ma}): ${lenh}`))))
  })
}

async function coFile(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

// ── 1. build ────────────────────────────────────────────────────────────────
// Gọi "next build" trực tiếp, KHÔNG qua "npm run build": script build của project
// có cờ --turbopack, mà bộ dò phụ thuộc cho output:"standalone" của Turbopack còn
// beta ở Next 15 và gom thiếu file. Bản webpack là bản tin được cho việc đóng gói.
console.log('▶ 1/5  Build production (webpack, không Turbopack)')
await rm(RA, { recursive: true, force: true })
await rm(join(GOC, '.next'), { recursive: true, force: true })
await chay('npx next build', { im: true })

// ── 2. gom standalone ───────────────────────────────────────────────────────
console.log('▶ 2/5  Gom bản standalone')
const STANDALONE = join(GOC, '.next', 'standalone')
if (!existsSync(STANDALONE)) {
  thoat('✗ Không thấy .next/standalone — next.config phải có output: "standalone".')
}
await mkdir(RA, { recursive: true })

/**
 * dereference: true là BẮT BUỘC, không phải tuỳ chọn cho đẹp.
 *
 * .next/standalone của Next chứa symlink trong node_modules. Copy mà giữ symlink:
 *   - trên Windows: EPERM, vì tạo symlink cần quyền admin / Developer Mode
 *   - trên macOS: tạo được nhưng nó trỏ về ĐƯỜNG DẪN TUYỆT ĐỐI trong project,
 *     nên gói mang sang máy khác là hỏng — chạy thử ở máy đóng gói vẫn thấy ổn
 *     vì đường dẫn đó còn tồn tại. Bẫy im lặng.
 * dereference copy nội dung thật vào gói → tự chứa và không cần quyền gì.
 */
const CHEP = { recursive: true, dereference: true }

await cp(STANDALONE, RA, CHEP)

// server.js không tự phục vụ 2 thư mục này, phải copy tay (theo tài liệu Next)
await cp(join(GOC, '.next', 'static'), join(RA, '.next', 'static'), CHEP)

// public/ chứa template .docx mà API /generatedocs đọc bằng fs lúc chạy —
// thiếu nó thì app mở được nhưng bấm xuất hồ sơ là lỗi.
if (!(await coFile(join(GOC, 'public')))) thoat('✗ Không thấy thư mục public/')
await cp(join(GOC, 'public'), join(RA, 'public'), CHEP)

// .env.local mang theo để máy đích chạy được ngay.
// KHOÁ SUPABASE (kể cả service role) sẽ nằm trong gói — xem cờ --khong-env.
if (mangEnv) {
  if (await coFile(join(GOC, '.env.local'))) {
    await cp(join(GOC, '.env.local'), join(RA, '.env.local'))
    console.log('  ⚠ Đã nhúng .env.local (có SUPABASE_SERVICE_ROLE_KEY) vào gói.')
    console.log('    Ai có gói này là có toàn quyền ghi/xoá database. Đừng phát tán bừa.')
  } else {
    console.log('  ⚠ Không thấy .env.local — máy đích sẽ phải tự tạo file này.')
  }
} else {
  // Để lại file mẫu, không có giá trị thật, cho người ở máy đích tự điền.
  await writeFile(
    join(RA, '.env.local.mau'),
    [
      '# Đổi tên file này thành .env.local rồi điền giá trị thật.',
      '# Lấy ở Supabase -> Project Settings -> API',
      'SUPABASE_URL=',
      'SUPABASE_SERVICE_ROLE_KEY=',
      'NEXT_PUBLIC_SUPABASE_URL=',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=',
      '',
    ].join('\n'),
    'utf8',
  )
  console.log('  ✓ .env.local.mau (không nhúng khoá — máy đích tự điền)')
}

// ── 3. kiểm gói có đủ file chạy chưa ────────────────────────────────────────
console.log('▶ 3/5  Kiểm gói đủ file')

// Kiểm FILE THẬT chứ không chỉ kiểm thư mục: bộ dò của Next hay copy thiếu và
// gói sẽ chết lúc chạy với lỗi "Cannot find module".
for (const f of ['server.js', 'package.json', join('.next', 'static')]) {
  if (!(await coFile(join(RA, f)))) thoat(`✗ thiếu ${f} trong gói`)
}

/**
 * KHÔNG kiểm node_modules/docxtemplater, jszip, pizzip, @supabase/supabase-js.
 *
 * Bốn package này KHÔNG có trong node_modules của gói, và đúng là như vậy:
 * webpack nhồi thẳng code của chúng vào bundle của từng route
 * (.next/server/app/api/generatedocs/route.js ~400 KB đã chứa cả docxtemplater),
 * nên bộ dò phụ thuộc của Next không cần copy package nữa.
 *
 * Bên tvpl-nghidinh phải kiểm playwright-core vì nó nằm trong
 * serverExternalPackages — package external thì KHÔNG được bundle, phải có thật
 * trong node_modules. Ở đây không có package nào external, nên bê nguyên bước
 * kiểm đó sang là kiểm sai chỗ: nó copy thêm ~6 MB không bao giờ được dùng tới.
 *
 * Thay vào đó: bước cuối bật hẳn server trong gói lên và gọi thật một route.
 * Thiếu module là chết ở đó, chắc chắn hơn mọi cách đếm file.
 */

// Đếm template: gói không có template thì chức năng xuất hồ sơ ra file rỗng.
let soTemplate = 0
async function demTemplate(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    if (e.isDirectory()) await demTemplate(join(d, e.name))
    else if (/\.docx?$/i.test(e.name) && !e.name.startsWith('~$')) soTemplate++
  }
}
if (await coFile(join(RA, 'public', 'templates'))) await demTemplate(join(RA, 'public', 'templates'))
if (soTemplate === 0) thoat('✗ Gói không có file template .docx nào trong public/templates')
console.log(`  ✓ ${soTemplate} file template .docx`)

// Rào chắn: còn symlink trong gói là gói KHÔNG mang đi được. Bắt lỗi ngay ở đây
// thay vì để người dùng phát hiện lúc chạy trên máy khác.
const conSymlink = []
async function quetSymlink(thuMuc) {
  for (const e of await readdir(thuMuc, { withFileTypes: true })) {
    const p = join(thuMuc, e.name)
    if (e.isSymbolicLink()) conSymlink.push(p)
    else if (e.isDirectory()) await quetSymlink(p)
  }
}
await quetSymlink(RA)
if (conSymlink.length) {
  console.error('✗ Gói còn symlink nên không mang sang máy khác được:')
  for (const p of conSymlink.slice(0, 10)) console.error(`    ${p} → ${await readlink(p)}`)
  thoat('  Nguyên nhân thường là thiếu dereference khi copy.')
}
console.log('  ✓ không còn symlink nào trong gói')

// ── 4. Node runtime ─────────────────────────────────────────────────────────
const TEN_NODE_BIN = hdh === 'windows' ? 'node.exe' : 'node'

if (nhungNode) {
  const arch = hdh === 'windows' ? 'win-x64' : process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  const ext = hdh === 'windows' ? 'zip' : 'tar.gz'
  const ten = `node-${NODE_VER}-${arch}`
  const url = `https://nodejs.org/dist/${NODE_VER}/${ten}.${ext}`

  console.log(`▶ 4/5  Tải Node ${NODE_VER} (${arch})`)
  const tmp = await mkdtemp(join(tmpdir(), `${TEN_APP}-node-`))
  const file = join(tmp, `node.${ext}`)

  const res = await fetch(url)
  if (!res.ok) thoat(`✗ Tải Node thất bại: HTTP ${res.status} — ${url}`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))

  // bsdtar (có sẵn trên macOS và Windows 10+) mở được cả .tar.gz và .zip
  await chay(`tar -xf "${file}" -C "${tmp}"`)

  await mkdir(join(RA, 'runtime'), { recursive: true })
  const trongGoi = hdh === 'windows' ? join(tmp, ten, 'node.exe') : join(tmp, ten, 'bin', 'node')
  if (!existsSync(trongGoi)) thoat(`✗ Không thấy ${trongGoi} sau khi giải nén.`)
  await cp(trongGoi, join(RA, 'runtime', TEN_NODE_BIN))
  if (hdh !== 'windows') await chmod(join(RA, 'runtime', TEN_NODE_BIN), 0o755)
  await rm(tmp, { recursive: true, force: true })

  const kb = Math.round((await stat(join(RA, 'runtime', TEN_NODE_BIN))).size / 1024 / 1024)
  console.log(`  ✓ runtime/${TEN_NODE_BIN} (${kb} MB)`)
} else {
  console.log('▶ 4/5  Bỏ qua Node runtime (--khong-node)')
}

// ── 5. launcher + tài liệu ──────────────────────────────────────────────────
console.log('▶ 5/5  Tạo script khởi động + hướng dẫn')

if (await coFile(join(GOC, 'HUONG-DAN.md'))) {
  await cp(join(GOC, 'HUONG-DAN.md'), join(RA, 'HUONG-DAN.md'))
}

// Toàn bộ logic khởi động nằm trong khoi-dong.mjs — chạy được cả hai hệ.
await cp(join(GOC, 'scripts', 'khoi-dong.mjs'), join(RA, 'khoi-dong.mjs'))

if (hdh === 'windows') {
  // .bat phải dùng CRLF, nếu không cmd.exe hiểu sai dòng lệnh.
  const bat = [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0"',
    'chcp 65001 >nul',
    '',
    'set "NODE="',
    'if exist "runtime\\node.exe" set "NODE=runtime\\node.exe"',
    'if not defined NODE (',
    '  where node >nul 2>&1 && set "NODE=node"',
    ')',
    'if not defined NODE (',
    '  echo [X] Khong tim thay Node.',
    '  echo     Goi nay duoc dong bang --khong-node nen may phai cai Node ^>= 20 tu nodejs.org',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'if not defined PORT set "PORT=3000"',
    '"%NODE%" khoi-dong.mjs',
    'if errorlevel 1 pause',
    '',
  ].join('\r\n')
  await writeFile(join(RA, 'chay.bat'), bat, 'utf8')
  console.log('  ✓ chay.bat (Windows)')
} else {
  const sh = `#!/bin/bash
# Bấm đúp vào file này để chạy app.
cd "$(dirname "$0")"

NODE=""
# Node nhúng kèm có thể bị macOS chặn nếu gói đi qua mạng (cờ com.apple.quarantine),
# nên thử chạy thật một lần chứ không chỉ kiểm quyền thực thi.
if [[ -x "./runtime/node" ]] && ./runtime/node -v >/dev/null 2>&1; then
  NODE="./runtime/node"
elif command -v node >/dev/null 2>&1; then
  NODE="node"
  echo "ℹ Dùng Node của máy vì Node nhúng kèm không chạy được."
fi

if [[ -z "$NODE" ]]; then
  echo "✗ Không chạy được Node."
  echo
  echo "  Nếu gói này được tải/gửi qua mạng, macOS đã gắn cờ cách ly. Mở Terminal và chạy:"
  echo
  echo "      xattr -cr \\"$(pwd)\\""
  echo
  echo "  rồi bấm đúp lại chay.command. Hoặc cài Node >= 20 từ nodejs.org."
  read -r -p "Enter để đóng..." _ ; exit 1
fi

exec "$NODE" khoi-dong.mjs
`
  await writeFile(join(RA, 'chay.command'), sh, 'utf8')
  await chmod(join(RA, 'chay.command'), 0o755).catch(() => {})
  console.log('  ✓ chay.command (macOS)')
  if (process.platform === 'win32') {
    console.log('  ⚠ Đóng gói macOS từ Windows: chay.command sẽ MẤT quyền thực thi.')
    console.log('    Trên máy Mac chạy một lần:  chmod +x chay.command')
  }
}

const GHI_CHU_ENV_WIN = mangEnv
  ? '4. Khoa Supabase da nam san trong file .env.local, khong phai lam gi them.'
  : `4. Goi nay KHONG kem khoa Supabase. Doi ten  .env.local.mau  thanh  .env.local
   roi dien 4 gia tri (lay o Supabase -> Project Settings -> API).`

const GHI_CHU_ENV_MAC = mangEnv
  ? '4. Khoá Supabase đã nằm sẵn trong file .env.local, không phải làm gì thêm.'
  : `4. Gói này KHÔNG kèm khoá Supabase. Đổi tên  .env.local.mau  thành  .env.local
   rồi điền 4 giá trị (lấy ở Supabase → Project Settings → API).`

const BAT_DAU_WIN = `${TEN_APP} - bat dau tu day (Windows)
========================================

1. Bam dup vao  chay.bat   -> trinh duyet tu mo http://localhost:3000

2. Neu Windows Defender / SmartScreen canh bao:
   bam "More info" -> "Run anyway". Chi phai lam mot lan.

3. May nay can: Windows 64-bit.
   KHONG can cai Node, KHONG can npm install.

${GHI_CHU_ENV_WIN}

5. VE MANG: goi nay khong can mang de CAI, nhung luc CHAY BAT BUOC phai co
   Internet - toan bo du lieu dan cu nam tren Supabase, khong nam trong goi.

6. Template ho so .docx nam trong  public\\templates\\  - them/sua file o day
   la lan xuat ho so sau se dung ban moi, khong phai dong goi lai.

Doi cong:  mo Command Prompt, cd vao thu muc nay roi:  set PORT=4000 && chay.bat

Huong dan day du: mo file  HUONG-DAN.md  (bang Notepad hoac VS Code)
`

const BAT_DAU_MAC = `${TEN_APP} — bắt đầu từ đây (macOS)
======================================

1. Bấm đúp vào  chay.command   → trình duyệt tự mở http://localhost:3000

2. Nếu macOS báo "không mở được vì không rõ nhà phát triển":
   Chuột phải vào chay.command → Open → Open.
   Vẫn không được thì mở Terminal, gõ  xattr -cr  rồi kéo thư mục này vào, Enter.

3. Máy này cần: macOS cùng loại chip với máy đóng gói.
   KHÔNG cần cài Node, KHÔNG cần npm install.

${GHI_CHU_ENV_MAC}

5. VỀ MẠNG: gói này không cần mạng để CÀI, nhưng lúc CHẠY BẮT BUỘC phải có
   Internet — toàn bộ dữ liệu dân cư nằm trên Supabase, không nằm trong gói.

6. Template hồ sơ .docx nằm trong  public/templates/  — thêm/sửa file ở đây
   là lần xuất hồ sơ sau sẽ dùng bản mới, không phải đóng gói lại.

Đổi cổng:  PORT=4000 ./chay.command

Hướng dẫn đầy đủ: mở file  HUONG-DAN.md
`

/**
 * Next copy nguyên package.json của project vào bản standalone, nên gói vẫn
 * quảng cáo `npm run dev` / `npm run build` — mà gói KHÔNG chạy được mấy lệnh
 * đó (thiếu app/, next.config, eslint). Người dùng gõ vào sẽ nhận một lỗi khó
 * hiểu. Thay bằng script đúng với thứ gói làm được.
 */
{
  const f = join(RA, 'package.json')
  const pkg = JSON.parse(await readFile(f, 'utf8'))
  pkg.scripts = { start: 'node khoi-dong.mjs' }
  delete pkg.devDependencies
  pkg['//'] =
    'Day la GOI DA DONG SAN, khong phai project. Chay bang chay.bat / chay.command, ' +
    'hoac "npm start". Muon sua code thi dung project goc.'
  await writeFile(f, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log('  ✓ package.json: chỉ còn script "start" (gói không chạy được dev/build)')
}

await writeFile(
  join(RA, 'BAT-DAU-TU-DAY.txt'),
  hdh === 'windows' ? BAT_DAU_WIN : BAT_DAU_MAC,
  'utf8',
)

// ── kiểm gói: bật server thật rồi gọi một route ──────────────────────────────
/**
 * Đây là bài kiểm duy nhất đáng tin. Đếm file chỉ đoán được gói "trông có vẻ
 * đủ"; bật server lên và gọi thật một trang thì thiếu chunk / thiếu module là
 * lộ ra ngay tại đây, chứ không phải ở máy người dùng.
 *
 * Gọi /login vì đây là đường dẫn công khai duy nhất (xem PUBLIC_PATHS trong
 * middleware.js) — render được nó nghĩa là bundle trang chạy tốt.
 * Rồi gọi /population với redirect:'manual' để xem middleware CÓ trong gói thật
 * không: phải nhận 307 về /login. Không dùng redirect mặc định của fetch, vì nó
 * tự đi theo 307 rồi trả 200 của trang /login — bài kiểm sẽ "xanh" trong khi
 * middleware có thể đã bị gom thiếu.
 */
const CUNG_HE = (hdh === 'windows') === (process.platform === 'win32')
if (nhungNode && CUNG_HE) {
  const nodeGoi = join(RA, 'runtime', TEN_NODE_BIN)

  // Xin OS một cổng rỗi thay vì chọn bừa một số — máy dev hay đang chiếm 3000.
  const cong = await new Promise((ok, loi) => {
    const s = createServer()
    s.on('error', loi)
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => ok(p))
    })
  }).catch(() => 0)

  if (!cong) {
    console.log('  ⚠ Không xin được cổng rỗi, bỏ qua bước kiểm chạy thử.')
  } else {
    const sv = spawn(nodeGoi, ['server.js'], {
      cwd: RA,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(cong), HOSTNAME: '127.0.0.1' },
    })
    let chetSom = null
    sv.on('exit', (ma) => {
      if (ma) chetSom = ma
    })

    const goi = (duong) =>
      fetch(`http://127.0.0.1:${cong}${duong}`, { redirect: 'manual' }).then((r) => r.status)

    try {
      // Chờ server sẵn sàng, tối đa ~20s. Poll thay vì sleep cố định để không
      // vừa chậm vừa vẫn có lúc trượt trên máy yếu.
      let maLogin = 0
      for (let i = 0; i < 40; i++) {
        if (chetSom !== null) throw new Error(`server.js tắt ngay với mã ${chetSom}`)
        await new Promise((r) => setTimeout(r, 500))
        try {
          maLogin = await goi('/login')
          break
        } catch {
          // chưa lên, thử lại
        }
      }
      if (!maLogin) thoat('✗ kiểm gói: server.js không lên sau 20 giây, gói không dùng được')
      if (maLogin !== 200) thoat(`✗ kiểm gói: /login trả HTTP ${maLogin}, gói không dùng được`)
      console.log('  ✓ kiểm gói: bật server.js, /login render được (HTTP 200)')

      // 307/302 = middleware có trong gói và đang chặn. 200 = không bị chặn:
      // hoặc middleware bị gom thiếu, hoặc app đã bỏ phần đăng nhập.
      const maKin = await goi('/population')
      if (maKin === 307 || maKin === 302) {
        console.log('  ✓ kiểm gói: middleware chặn /population → chuyển về /login')
      } else {
        console.log(`  ⚠ kiểm gói: /population trả HTTP ${maKin}, KHÔNG bị chặn đăng nhập.`)
        console.log('    Nếu app vẫn còn middleware.js thì gói đã gom thiếu middleware.')
      }
    } catch (e) {
      thoat(`✗ kiểm gói: ${e.message}`)
    } finally {
      sv.kill()
    }
  }
}

const tenGoi = basename(RA)
console.log(`\n✓ Xong: ${RA}`)
console.log(`  Hệ điều hành đích: ${hdh}`)
if (!CUNG_HE) {
  console.log(`\n  ⚠ Gói ${hdh} này được tạo từ ${process.platform} nên CHƯA chạy thử trên hệ đích.`)
  console.log('    Chạy thử một lần trên máy đích trước khi phát cho người khác.')
}
console.log('\n  Nén để mang đi:')
if (process.platform === 'win32') {
  console.log(`    powershell Compress-Archive -Path "${RA}" -DestinationPath "${RA}.zip"`)
} else {
  console.log(`    cd "${thuMucRa}" && zip -qr ${tenGoi}.zip ${tenGoi}`)
}
