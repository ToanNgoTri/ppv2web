# ppv2web — Hướng dẫn đóng gói và chạy gói

Tài liệu này nói về **chức năng đóng gói**: biến project thành một thư mục copy
sang máy khác là chạy được, không cần cài Node, không cần `npm install`.

---

## 1. Đóng gói (làm ở máy có project)

```bash
npm run dong-goi:mac        # gói cho macOS
npm run dong-goi:win        # gói cho Windows 64-bit
```

Gói ra nằm ở `dist-offline/ppv2web-mac` hoặc `dist-offline/ppv2web-windows`.

Đóng thẳng ra USB:

```bash
node scripts/dong-goi.mjs --windows --ra /Volumes/USB
node scripts/dong-goi.mjs --windows --ra D:\USB
```

### Các cờ

| Cờ | Việc nó làm |
|---|---|
| `--windows` / `--mac` | chọn hệ đích. Không ghi gì thì lấy hệ đang chạy |
| `--khong-node` | không nhúng Node (~80–110 MB). Máy đích phải tự có Node >= 20 |
| `--khong-env` | **không** nhúng `.env.local`. Gói sẽ kèm `.env.local.mau` để máy đích tự điền |
| `--ra <thư mục>` | đổi nơi ghi gói |
| `--help` | in bảng hướng dẫn |

Chạy qua `npm run dong-goi` thì **phải có `--` trước cờ**:

```bash
npm run dong-goi -- --windows      # ĐÚNG
npm run dong-goi --windows         # SAI, npm ăn mất cờ
```

Dùng `npm run dong-goi:win` thì không phải nhớ chuyện này.

### ⚠ Về khoá Supabase

Mặc định script **nhúng cả `.env.local` vào gói**, trong đó có
`SUPABASE_SERVICE_ROLE_KEY` — khoá này **bỏ qua toàn bộ RLS**, ai có gói là có
toàn quyền đọc/ghi/xoá database.

- Phát cho người trong đơn vị dùng: nhúng luôn cho tiện.
- Gửi qua mạng, để trên USB dùng chung, hoặc đưa người ngoài: dùng `--khong-env`
  rồi đưa khoá qua đường khác.

### Đóng gói cho hệ khác

Đóng gói Windows từ máy Mac (và ngược lại) chạy được, nhưng script sẽ cảnh báo
là gói **chưa được chạy thử trên hệ đích**. Chạy thử một lần trên máy đích trước
khi phát cho người khác.

Riêng gói macOS đóng từ Windows: `chay.command` sẽ mất quyền thực thi, trên máy
Mac phải chạy một lần `chmod +x chay.command`.

---

## 2. Chạy gói (làm ở máy đích)

**macOS** — bấm đúp `chay.command`
**Windows** — bấm đúp `chay.bat`

Trình duyệt tự mở `http://localhost:3000`.

Đổi cổng:

```bash
PORT=4000 ./chay.command              # macOS
set PORT=4000 && chay.bat             # Windows
```

Gói cũng chạy được bằng `npm start` nếu máy có Node.

### Máy đích cần gì

- **Bắt buộc có Internet.** Toàn bộ dữ liệu dân cư nằm trên Supabase, không nằm
  trong gói. Không mạng thì không đăng nhập được, và mọi thao tác tra cứu / thêm /
  sửa / xoá đều lỗi.
- **Tài khoản đăng nhập.** Gói mở ra là vào `/login`; `middleware.js` chặn mọi
  đường dẫn khác, còn `requireUser()` chặn ở từng API route. Tài khoản do
  Supabase Auth quản lý, không nằm trong gói — tạo ở Supabase → Authentication →
  Users.
- Không cần Node, không cần `npm install`, không cần Chrome.
- Gói macOS chỉ chạy trên máy **cùng loại chip** với máy đóng gói (Apple Silicon
  hoặc Intel), vì Node nhúng kèm là bản native.

### Lỗi hay gặp

| Hiện tượng | Cách sửa |
|---|---|
| macOS: "không mở được vì không rõ nhà phát triển" | Chuột phải `chay.command` → Open → Open |
| macOS: `chay.command` không chạy được Node | Mở Terminal, gõ `xattr -cr ` rồi kéo thư mục gói vào, Enter |
| Windows: SmartScreen cảnh báo | "More info" → "Run anyway", chỉ một lần |
| `✗ Thiếu cấu hình Supabase` | Điền 4 biến vào `.env.local` (xem mục dưới) |
| `Server dừng với mã 1` | Cổng 3000 đang bị chiếm, đổi cổng |
| Vào trang nào cũng bị đẩy về `/login` | Chưa đăng nhập, hoặc phiên hết hạn |
| API trả `{"error":"Chưa đăng nhập"}` | Đăng nhập lại ở `/login` |

### 4 biến trong `.env.local`

Lấy ở Supabase → Project Settings → API:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_URL` là **cùng một URL**. Launcher kiểm
đủ 4 biến trước khi bật server, thiếu là dừng luôn kèm hướng dẫn.

---

## 3. Template hồ sơ .docx

API `/api/generatedocs` đọc template bằng `fs` từ `public/templates/` **lúc
chạy**, không phải lúc build. Nên trong gói đã đóng:

> Thêm / sửa / xoá file `.docx` trong `public/templates/` là lần xuất hồ sơ sau
> dùng ngay bản mới — **không phải đóng gói lại**.

Quy tắc quét: lấy mọi file `.docx`/`.doc` trong `public/templates/` và **tất cả
thư mục con**, bỏ qua file tạm của Word (`~$...`). Cấu trúc thư mục con được giữ
nguyên trong file zip xuất ra.

Vì quét cả thư mục con nên **đừng lưu file kết quả vào trong `public/templates/`** —
lần sau nó sẽ bị coi là template và xuất ra kèm. Hiện `public/templates/ket-qua/`
(95 file) và `ket-qua-thncd/` (12 file) đang nằm trong đó, làm mỗi lần xuất hồ sơ
ra 208 file thay vì ~101. Muốn dọn thì chuyển hai thư mục đó ra ngoài
`public/templates/`.

---

## 4. Cấu trúc gói

```
ppv2web-mac/
├── BAT-DAU-TU-DAY.txt      hướng dẫn ngắn cho người dùng cuối
├── HUONG-DAN.md            file này
├── chay.command            launcher macOS (chay.bat trên Windows)
├── khoi-dong.mjs           kiểm env + mạng + template, rồi bật server
├── server.js               server Next.js (bản standalone)
├── package.json            chỉ còn script "start"
├── .env.local              cấu hình Supabase (nếu không dùng --khong-env)
├── runtime/node            Node nhúng kèm (không có nếu dùng --khong-node)
├── .next/                  bản build
├── node_modules/           dependency Next cần (xem mục 5: các dep của API
│                           đã nằm trong bundle, không có ở đây)
└── public/templates/       template .docx, sửa được sau khi đóng gói
```

Gói **không** chạy được `npm run dev` / `npm run build` — thiếu `app/`,
`next.config.mjs`, eslint. Muốn sửa code thì dùng project gốc.

---

## 5. Vài chi tiết kỹ thuật đáng biết

**Build bằng webpack, không Turbopack.** `scripts/dong-goi.mjs` gọi thẳng
`npx next build` chứ không qua `npm run build` (script này có cờ `--turbopack`).
Bộ dò phụ thuộc cho `output: "standalone"` của Turbopack còn beta ở Next 15 và
gom thiếu file.

**`unoptimized: true` cho next/image.** Bộ tối ưu ảnh của Next cần `sharp` —
native module riêng cho từng hệ/chip. Đóng gói Windows từ Mac sẽ nhét bản
`darwin-arm64` vào gói và ảnh chết khi chạy trên Windows. Ảnh ở đây là ảnh chân
dung hiển thị 120px lấy trực tiếp từ Supabase nên không cần tối ưu.

**Copy phải `dereference`.** Bản standalone của Next chứa symlink trong
`node_modules`. Giữ symlink thì Windows báo `EPERM`, còn macOS tạo được nhưng
symlink trỏ về đường dẫn tuyệt đối trong project — gói mang sang máy khác là
hỏng, mà thử ở máy đóng gói vẫn thấy chạy tốt. Bẫy im lặng. Script có bước quét
lại toàn gói và **dừng nếu còn bất kỳ symlink nào**.

**`node_modules` của gói KHÔNG có `docxtemplater` / `jszip` / `pizzip` /
`@supabase/supabase-js` — và như vậy là đúng.** Webpack nhồi thẳng code của
chúng vào bundle từng route: `.next/server/app/api/generatedocs/route.js` nặng
~400 KB vì đã chứa cả docxtemplater. Đã kiểm bằng cách xoá cả 4 package khỏi gói
rồi gọi `/api/searchData` và `/api/generatedocs` — vẫn ra đủ 100 bản ghi và file
zip 4 MB, không có lỗi `Cannot find module`.

Chỉ package nằm trong `serverExternalPackages` mới bắt buộc phải có thật trong
`node_modules` (vì external thì không được bundle). Project này không có package
nào external.

**Script tự kiểm gói trước khi báo xong:** đủ `server.js` / `.next/static` /
`package.json`, có ít nhất 1 file template, không còn symlink, và nếu đóng cho
cùng hệ thì **bật hẳn `server.js` trong gói lên rồi gọi thật hai đường dẫn**:

| Gọi | Kỳ vọng | Chứng minh điều gì |
|---|---|---|
| `/login` | HTTP 200 | server bật được, bundle trang render được |
| `/population` | HTTP 307 → `/login` | `middleware.js` **có** trong gói và đang chặn |

Cả hai đều gọi với `redirect: 'manual'`. Không đặt cờ này thì `fetch` tự đi theo
307 rồi trả về 200 của `/login` — bài kiểm sẽ "xanh" trong khi middleware có thể
đã bị gom thiếu. Cổng do OS cấp (`listen(0)`) nên không đụng cổng 3000 đang dùng
cho `npm run dev`.
