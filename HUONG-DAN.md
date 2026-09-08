# ppv2web — đóng gói và chạy gói

Đóng gói = biến project thành một thư mục, copy sang máy khác là chạy được:
không cần cài Node, không cần `npm install`.

## Nhớ 3 dòng này là đủ

```bash
npm run dev            # làm việc hằng ngày   → dự án HANGGON      (đọc .env.local)
npm run dong-goi:win   # gói phát cho người khác → dự án POPULATION (đọc .env.population.local)
npm run dong-goi:mac   # như trên, cho macOS
```

Và 3 quy tắc:

1. **Đóng gói không đọc, không sửa `.env.local`.** Nó đọc `.env.<dự-án>.local`,
   mặc định `population`. Nên đổi `.env.local` không ảnh hưởng gói, và đóng gói
   không làm hỏng môi trường dev.
2. **Cần cờ khác thì gọi thẳng `node scripts/dong-goi.mjs …`** (xem bảng cờ bên
   dưới), đừng đi qua `npm run` — npm ăn mất cờ.
3. **Trên Windows chạy trong PowerShell hoặc cmd**, đừng chạy trong Git Bash:
   `tar` của Git Bash hiểu `C:\…` là tên máy chủ từ xa nên bước tải Node chết với
   `tar: Cannot connect to C:`.

Gói ra nằm ở `dist-offline/ppv2web-windows` (hoặc `-mac`).

---

## 1. Đóng gói (ở máy có project)

### Hai file env, hai việc khác nhau

| File | Ai đọc | Dự án | Trong git |
|---|---|---|---|
| `.env.local` | `npm run dev` | **hanggon** | không |
| `.env.population.local` | đóng gói (mặc định) | **population** | không |
| `.env.hanggon.local` | đóng gói khi có `--hanggon` | hanggon | không |
| `.env.*.example` | bước 0/5, để đối chiếu URL | — | **có** |

Cách nó làm: script tự đọc `.env.<dự-án>.local` rồi truyền qua `process.env` của
tiến trình `next build`. `@next/env` chỉ gán biến nào **chưa có** trong
`process.env`, nên giá trị truyền vào thắng `.env.local`. Nhờ vậy không phải đổi
file qua lại, và Ctrl+C giữa build cũng không để lại file lẫn dự án.

Hai file `.example` **đừng xoá**: chúng là thứ duy nhất đi theo `git pull`, là
danh sách dự án hợp lệ cho `--du-an`, và là mốc chuẩn để bước 0/5 phát hiện
`.env.<dự-án>.local` bị lắp URL của dự án khác — lỗi này đã xảy ra một lần
(file ghi comment "POPULATION" nhưng URL bên trong là hanggon) và không có gì
bắt được.

> ⚠ Đừng đặt tên file thành `.env.production.local` — chỉ khác
> `.env.population.local` vài chữ, nhưng **Next CÓ đọc nó** và nó ghi đè
> `.env.local` ở bản production.

### Máy vừa `git pull` về

File `*.local` bị `.gitignore` nên không đi theo code. Thiếu nó thì `next build`
chết ở bước *Collecting page data* với `Error: supabaseUrl is required`, vì các
API route gọi `createClient(process.env.SUPABASE_URL, …)` ở cấp module.

```bash
npm install
cp .env.hanggon.example    .env.local              # để npm run dev
cp .env.population.example .env.population.local   # để đóng gói
# điền SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY vào cả hai
npm run dong-goi:win
```

Bước 0/5 kiểm trước khi build và dừng kèm đúng dòng `cp` cần chạy — không để bạn
phải đọc lỗi webpack.

### Các cờ — gọi thẳng `node scripts/dong-goi.mjs`

| Cờ | Việc nó làm |
|---|---|
| `--windows` / `--mac` | hệ đích. Không ghi thì lấy hệ đang chạy |
| `--hanggon` | đóng gói dự án hanggon (mặc định là population) |
| `--du-an <tên>` | dạng đầy đủ; tên hợp lệ = các file `.env.<tên>.example` có trong repo |
| `--ra <thư mục>` | ghi gói ra chỗ khác, ví dụ `--ra D:\USB` |
| `--khong-node` | không nhúng Node (~80 MB). Máy đích phải tự có Node >= 20 |
| `--khong-env` | không nhúng khoá Supabase; gói kèm `.env.local.mau` để máy đích tự điền |
| `--help` | in bảng này |

### ⚠ Khoá service-role nằm trong gói

Mặc định gói mang theo `.env.<dự-án>.local`, trong đó có
`SUPABASE_SERVICE_ROLE_KEY` — khoá này **bỏ qua toàn bộ RLS**, ai có gói là có
toàn quyền đọc/ghi/xoá database.

- Người trong đơn vị dùng: nhúng luôn cho tiện.
- Gửi qua mạng, USB dùng chung, người ngoài: dùng `--khong-env` rồi đưa khoá qua
  đường khác.

### ⚠ Gói bị khoá vào một dự án Supabase

`NEXT_PUBLIC_*` bị **nướng cứng vào bundle lúc build**, cả phía trình duyệt lẫn
phía server, kể cả `middleware.js`. Hệ quả: **sửa `.env.local` trong gói đã đóng
KHÔNG đổi được dự án.**

| Biến | Đọc lúc nào |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REQUIRE_ACTIVE_PROFILE` | **lúc chạy** — máy đích đổi được |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lúc build — sửa vô ích |

Bẫy thật với hai dự án: lắp `.env.local` của dự án khác vào gói thì **đăng nhập
vẫn được** (trình duyệt dùng dự án đã nướng) nhưng **API đọc/ghi sang dự án kia**
— tra cứu ra rỗng, hoặc thêm dữ liệu vào sai nơi, không một dòng lỗi. Nên script
ghi `thong-tin-goi.json` vào gói và launcher **so `SUPABASE_URL` với `duAnBuild`,
lệch là dừng ngay**:

```json
{ "duAn": "POPULATION", "duAnBuild": "https://feuakoaglemujpwsspie.supabase.co", "hdh": "windows" }
```

Muốn đổi dự án thì đóng gói lại với `--hanggon` / `--du-an <tên>`.

### Đóng gói cho hệ khác

Chạy được, nhưng script cảnh báo gói **chưa chạy thử trên hệ đích** — thử một lần
ở máy đích trước khi phát. Gói macOS đóng từ Windows còn mất quyền thực thi: trên
máy Mac chạy một lần `chmod +x chay.command`.

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
| `✗ Thiếu cấu hình Supabase` | Đổi tên `.env.local.mau` thành `.env.local` rồi điền khoá (gói đóng bằng `--khong-env`) |
| `✗ .env.local không khớp với gói này` | Lắp lẫn env của hai dự án. Dùng đúng `.env.local` đi kèm gói, hoặc đóng gói lại |
| `Server dừng với mã 1` | Cổng 3000 đang bị chiếm, đổi cổng |
| Vào trang nào cũng bị đẩy về `/login` | Chưa đăng nhập, hoặc phiên hết hạn |
| API trả `{"error":"Chưa đăng nhập"}` | Đăng nhập lại ở `/login` |

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

## 4. Màn hình Truy vấn SQL (`/sql`)

Dán câu lệnh SQL vào, bấm Chạy, kết quả đổ ra bảng — dùng để tra cứu hàng loạt
(nhiều CCCD một lúc), thống kê, đối chiếu hai bảng. Có nút tải CSV.

### ⚠ Phải cài hàm trong Supabase, MỖI DỰ ÁN MỘT LẦN

`supabase-js` không chạy được SQL thô, nên câu lệnh được gửi qua RPC tới một hàm
Postgres. Hàm đó **không** đi theo gói — nó nằm trong database.

Vào Supabase → SQL Editor → dán toàn bộ `sql/truy-van-sql.sql` → Run.
Làm ở **cả hai** dự án `population` và `hanggon`, vì đó là hai database riêng.

Chưa chạy thì màn hình báo thẳng: *"Chưa cài hàm truy vấn trong Supabase…"*.

Bước `revoke` ở cuối file đó **bắt buộc**: khóa anon nằm công khai trong bundle
trình duyệt, không thu hồi quyền thì ai lấy được khóa đó cũng gọi thẳng RPC và
đọc sạch mọi bảng mà không cần đăng nhập.

### Chỉ đọc, chặn ở 4 lớp

| Lớp | Ở đâu | Chặn cái gì |
|---|---|---|
| `lib/sql.js` | Node | Bỏ chú thích và chuỗi rồi soi: phải bắt đầu bằng SELECT/WITH, một câu lệnh, không từ khóa ghi. Chỉ để **báo lỗi tiếng Việt sớm**, không phải hàng rào |
| `requireUser()` | `/api/runSql` | Chưa đăng nhập / chưa duyệt là 401, 403 |
| `set local transaction_read_only = on` | Postgres | Transaction read-only, mọi lệnh ghi bị động cơ từ chối — kể cả khi câu SELECT gọi tới một hàm có ghi |
| bọc `select * from ( … ) sub` | Postgres | DELETE/UPDATE/INSERT thành **lỗi cú pháp**. CTE ghi cũng hỏng vì Postgres bắt CTE ghi phải ở cấp cao nhất |

Câu lệnh chạy quá **15 giây** bị cắt. Trả tối đa **5000 dòng** (mặc định 1000);
chạm trần thì giao diện cảnh báo vàng chứ không im lặng cắt bớt.

### Lưu ý khi gõ

Tên cột phải bọc nháy kép vì viết hoa: `"HOTEN"` chạy được, `HOTEN` thì Postgres
hạ thành `hoten` và báo không có cột. Chuỗi dùng nháy đơn.

### Dán danh sách CCCD

Bấm **Dán danh sách CCCD →**, dán mỗi dòng một số (hoặc copy thẳng một cột từ
Excel), rồi chọn một trong hai nút. Tự bỏ trùng, tự thêm nháy, tự báo đã dán bao
nhiêu số:

| Nút | Trả về |
|---|---|
| **Tìm người CÓ trong database** | hồ sơ của những số tra được |
| **Tìm số KHÔNG có trong database** | những số trong danh sách mà database chưa có |

Nút thứ hai sinh câu lệnh dạng `unnest(array[…]) … where not exists`, **không**
phải `not in`. Đây là chỗ rất dễ viết ngược:

```sql
-- ĐÚNG: danh sách dán vào là vế trái, ra những số CHƯA CÓ
select x from unnest(array['079…','079…']) as x
where not exists (select 1 from population p where trim(p."CCCD") = trim(x));

-- SAI: ra 24.292 dòng — là những người TRONG database không nằm trong danh sách
select * from population where "CCCD" not in ('079…','079…');
```

So sánh có `trim()` hai bên vì dữ liệu nhập tay hay dính khoảng trắng thừa.

---

## 5. Cấu trúc gói

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
├── node_modules/           dependency Next cần (xem mục 6: các dep của API
│                           đã nằm trong bundle, không có ở đây)
└── public/templates/       template .docx, sửa được sau khi đóng gói
```

Gói **không** chạy được `npm run dev` / `npm run build` — thiếu `app/`,
`next.config.mjs`, eslint. Muốn sửa code thì dùng project gốc.

---

## 6. Vài chi tiết kỹ thuật đáng biết

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
