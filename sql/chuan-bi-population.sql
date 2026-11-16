-- ============================================================================
-- CHUẨN BỊ DỰ ÁN POPULATION ĐỂ NHẬN DỮ LIỆU TỪ HANGGON (app ppv2bat dùng)
--
-- Chạy MỘT LẦN trong Supabase → SQL Editor của dự án POPULATION
-- (feuakoaglemujpwsspie). Gộp 4 tệp, chạy lại cũng không sao:
--   1. tao-bang-tamtru.sql      bảng tạm trú
--   2. tao-bang-khuon-mat.sql   pgvector + bảng khuon_mat + hàm duoc_duyet, tim_khuon_mat
--   3. luu-khuon-mat.sql        hàm luu_khuon_mat (app ghi khuôn mặt ảnh mới)
--   4. tao-bang-truy-na.sql     bảng truy_na + hàm tim_truy_na (tab Truy nã)
-- KHÔNG đụng tới tài khoản, profiles hay dữ liệu crime/population hiện có.
-- ============================================================================

-- ============================================================================
-- BẢNG "tamtru" — nhân khẩu tạm trú
--
-- Chạy trong Supabase → SQL Editor, cho MỖI dự án (population và hanggon là
-- hai project riêng). Chạy lại cũng không sao: mọi lệnh đều "if not exists" /
-- "drop … if exists".
--
-- Chỉ những cột tạm trú thật sự dùng — đúng 11 cột của bảng ở dự án hanggon:
--   lấy từ bản kết xuất   HOTEN NAMSINH GIOITINH CCCD NOITHTRU NOITAMTRU NGAYDEN
--   dựng khi chuyển đổi   SOHOK (= CCCD chủ hộ), QUANHE (chỉ "CHỦ HỘ")
--   cán bộ nhập trên app  GHICHU LOCATION
-- Không có cha/mẹ, dân tộc, tôn giáo, SĐT, vắng nhà, tiền án, đã xóa.
--
-- Chạy xong thì nhập dữ liệu:
--   (replaceBieuMau) npm run tamtru -- import/TAMTRU.xlsx export/ket-qua-tamtru --json
--   (ppv2web)        npm run nhap-tamtru -- ../replaceBieuMau/export/ket-qua-tamtru/tamtru.json
-- ============================================================================

create table if not exists public.tamtru (
  "QUANHE"    text,
  "HOTEN"     text,
  "NAMSINH"   text,                  -- DD/MM/YYYY
  "GIOITINH"  boolean,               -- true = Nam
  "CCCD"      varchar primary key,
  "SOHOK"     text,                  -- CCCD chủ hộ, để app gom hộ
  "NOITHTRU"  text,                  -- thường trú ở quê
  "GHICHU"    text,
  "NOITAMTRU" text,                  -- chỗ đang tạm trú trong phường
  "LOCATION"  text,                  -- "10.86, 107.22"
  "NGAYDEN"   text                   -- ngày đến đăng ký tạm trú, DD/MM/YYYY
);

-- Bảng tạo theo bản cũ (chép từ population) còn tên NOIOHIENTAI: đổi tên.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'tamtru'
               and column_name = 'NOIOHIENTAI') then
    alter table public.tamtru rename column "NOIOHIENTAI" to "NOITAMTRU";
  end if;
end $$;

-- Bản cũ tạo thêm chỉ mục duy nhất trùng với khóa chính — thừa, bỏ.
drop index if exists public.tamtru_cccd_key;

-- QUYỀN CHO APP — BẮT BUỘC. App ppv2 dùng khóa publishable nên chịu RLS: bật
-- RLS mà không có policy là app đọc ra 0 dòng, trong khi web vẫn thấy đủ vì
-- dùng service-role. Điều kiện giống policy "iden" của population ở hanggon,
-- chạy được cả ở dự án chưa có hàm duoc_duyet().
alter table public.tamtru enable row level security;
drop policy if exists "nguoi duoc duyet toan quyen" on public.tamtru;
create policy "nguoi duoc duyet toan quyen"
  on public.tamtru for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

-- PostgREST lưu bộ nhớ đệm lược đồ — bảo nó đọc lại để thấy thay đổi ngay.
notify pgrst, 'reload schema';

-- Kiểm chứng: phải ra đúng 11 cột trên và 1 policy.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tamtru'
order by ordinal_position;

select policyname from pg_policies
where schemaname = 'public' and tablename = 'tamtru';

-- Nhập lại bản kết xuất mới từ đầu: xoá sạch rồi chạy lại script nhập.
--   truncate public.tamtru;


-- ============================================================================
-- NHẬN DIỆN KHUÔN MẶT — bảng "khuon_mat" + hàm tìm "tim_khuon_mat"
--
-- Chạy trong Supabase → SQL Editor của dự án HANGGON (dự án app ppv2 đang
-- dùng). Chạy lại cũng không sao: mọi lệnh đều "if not exists" / "or replace".
-- Tự tạo hàm public.duoc_duyet() (giống hệt bat-rls.sql bước 1) nếu dự án
-- chưa có — hanggon viết điều kiện is_active thẳng trong từng policy nên thiếu.
--
-- Mỗi dòng = một khuôn mặt tìm thấy trong một ảnh ở bucket imageCrime
-- (subject/<CCCD>.jpg), kèm vector 512 chiều do InsightFace (gói buffalo_s:
-- SCRFD-500M + MobileFaceNet) tính ra — cùng model app ppv2 chạy trên điện thoại. Ảnh không thấy mặt nào vẫn có MỘT dòng với mat_so = -1 và
-- vector null, để lần quét sau biết là đã xét rồi, không tải lại.
--
-- Ai ghi: công cụ quét ppv2/face-server (khóa service-role, bỏ qua RLS), và
--         app qua hàm luu_khuon_mat (xem luu-khuon-mat.sql) khi tải ảnh mới.
-- Ai đọc: người dùng app đã được duyệt — app gọi tim_khuon_mat bằng phiên đăng
-- nhập của chính họ, nên RLS của khuon_mat và crime vẫn có hiệu lực.
-- ============================================================================

create extension if not exists vector with schema extensions;

-- Người đang gọi đã được duyệt chưa (profiles.is_active). security definer để
-- tự đọc được profiles.
create or replace function public.duoc_duyet()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.duoc_duyet() from public;
grant execute on function public.duoc_duyet() to authenticated;

create table if not exists public.khuon_mat (
  id              bigint generated always as identity primary key,
  "CCCD"          varchar not null,            -- lấy từ tên file
  duong_dan       text    not null,            -- đường dẫn trong bucket, vd subject/0330....jpg
  phien_ban       text,                        -- updated_at/etag của file lúc quét; đổi = quét lại
  mat_so          smallint not null,           -- thứ tự mặt trong ảnh; -1 = ảnh không có mặt
  khung           jsonb,                       -- [x1,y1,x2,y2] theo pixel ảnh gốc
  diem_phat_hien  real,                        -- độ chắc chắn đây là khuôn mặt (0..1)
  vector          extensions.vector(512),      -- ArcFace đã chuẩn hoá (độ dài = 1)
  tao_luc         timestamptz not null default now(),
  unique (duong_dan, mat_so)
);

create index if not exists khuon_mat_cccd_idx on public.khuon_mat ("CCCD");

-- HNSW + cosine: vài trăm tới vài trăm nghìn mặt vẫn tìm trong vài ms.
create index if not exists khuon_mat_vector_idx
  on public.khuon_mat using hnsw (vector extensions.vector_cosine_ops);

alter table public.khuon_mat enable row level security;

drop policy if exists "doc_khuon_mat_khi_duoc_duyet" on public.khuon_mat;
create policy "doc_khuon_mat_khi_duoc_duyet" on public.khuon_mat
  for select to authenticated
  using (public.duoc_duyet());
-- Cố ý KHÔNG có policy insert/update/delete: app ghi qua hàm luu_khuon_mat.


-- ─── HÀM TÌM ────────────────────────────────────────────────────────────────
-- Nhận vector khuôn mặt cần tìm, trả về các ĐỐI TƯỢNG giống nhất (mỗi CCCD
-- một dòng, lấy mặt giống nhất của người đó), kèm thông tin trong bảng crime.
--
-- do_giong = cosine similarity, 1 là trùng khít. Đo trên kho imageCrime: người
-- KHÁC giống nhất thường 0.23–0.40; app coi >= 0.50 là "rất giống".
-- KẾT QUẢ CHỈ LÀ GỢI Ý — cán bộ phải tự đối chiếu trước khi kết luận.
--
-- security invoker: chạy bằng quyền người gọi, RLS áp dụng bình thường.

create or replace function public.tim_khuon_mat(
  vec       extensions.vector(512),
  so_luong  integer default 10,
  nguong    double precision default 0.30
)
returns table (
  "CCCD"     varchar,
  "HOTEN"    text,
  "NAMSINH"  text,
  "NOITHTRU" text,
  do_giong   double precision,
  duong_dan  text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with gan_nhat as (
    -- Lấy dư rồi mới gom theo CCCD, để một người nhiều ảnh không chiếm hết chỗ.
    select k."CCCD", k.duong_dan, 1 - (k.vector <=> vec) as do_giong
    from public.khuon_mat k
    where k.vector is not null
    order by k.vector <=> vec
    limit greatest(so_luong, 1) * 5
  ),
  moi_nguoi as (
    select distinct on (g."CCCD") g.*
    from gan_nhat g
    order by g."CCCD", g.do_giong desc
  )
  select m."CCCD", c."HOTEN"::text, c."NAMSINH"::text, c."NOITHTRU"::text,
         m.do_giong, m.duong_dan
  from moi_nguoi m
  left join public.crime c on c."CCCD" = m."CCCD"
  where m.do_giong >= nguong
  order by m.do_giong desc
  limit least(greatest(so_luong, 1), 50);
$$;

revoke all on function public.tim_khuon_mat(extensions.vector, integer, double precision) from public, anon;
grant execute on function public.tim_khuon_mat(extensions.vector, integer, double precision) to authenticated, service_role;


-- ─── KIỂM TRA SAU KHI QUÉT ──────────────────────────────────────────────────
-- select count(*) filter (where mat_so >= 0) as so_mat,
--        count(*) filter (where mat_so = -1) as anh_khong_co_mat,
--        count(distinct "CCCD") as so_nguoi
-- from public.khuon_mat;


-- ============================================================================
-- HÀM "luu_khuon_mat" — app ppv2 ghi khuôn mặt của ảnh đối tượng vừa tải lên
--
-- Chạy trong Supabase → SQL Editor của dự án HANGGON, SAU tao-bang-khuon-mat.sql.
-- Chạy lại cũng không sao.
--
-- Điện thoại tự tính vector (model buffalo_s trong APK) rồi gọi hàm này. Hàm
-- xoá các dòng cũ của ảnh subject/<CCCD>.jpg và ghi các mặt mới.
--
-- security definer vì bảng khuon_mat không cho người dùng ghi trực tiếp; bên
-- trong tự kiểm tra duoc_duyet() — tài khoản chưa duyệt gọi sẽ bị từ chối.
-- Chỉ ghi được cho CCCD có trong bảng crime, nên không chèn rác vào kho được.
-- ============================================================================

create or replace function public.luu_khuon_mat(
  p_cccd text,
  p_mat  jsonb          -- [{ "khung": [x1,y1,x2,y2], "diem": 0.87, "vector": "[...512 số...]" }, ...]
)
returns integer         -- số mặt đã ghi
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_path text := 'subject/' || p_cccd || '.jpg';
  v_n    integer := 0;
  v_mat  jsonb;
begin
  if not public.duoc_duyet() then
    raise exception 'Tài khoản chưa được duyệt' using errcode = '42501';
  end if;
  if p_cccd is null or p_cccd !~ '^[0-9A-Za-z]{6,20}$' then
    raise exception 'CCCD không hợp lệ';
  end if;
  if not exists (select 1 from public.crime c where c."CCCD" = p_cccd) then
    raise exception 'Không có đối tượng với CCCD %', p_cccd;
  end if;
  if jsonb_typeof(coalesce(p_mat, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_mat, '[]'::jsonb)) > 10 then
    raise exception 'Dữ liệu khuôn mặt không hợp lệ';
  end if;

  delete from public.khuon_mat where duong_dan = v_path;

  for v_mat in select * from jsonb_array_elements(coalesce(p_mat, '[]'::jsonb)) loop
    insert into public.khuon_mat ("CCCD", duong_dan, phien_ban, mat_so, khung, diem_phat_hien, vector)
    values (p_cccd, v_path, 'app', v_n, v_mat -> 'khung', (v_mat ->> 'diem')::real,
            (v_mat ->> 'vector')::extensions.vector(512));
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    insert into public.khuon_mat ("CCCD", duong_dan, phien_ban, mat_so)
    values (p_cccd, v_path, 'app', -1);
  end if;
  return v_n;
end;
$$;

revoke all on function public.luu_khuon_mat(text, jsonb) from public, anon;
grant execute on function public.luu_khuon_mat(text, jsonb) to authenticated;


notify pgrst, 'reload schema';

-- ============================================================================
-- DANH SÁCH TRUY NÃ cho app ppv2bat (dự án POPULATION)
--
-- Chạy trong Supabase → SQL Editor của dự án POPULATION (feuakoaglemujpwsspie).
-- Chạy lại cũng không sao.
--
-- Nguồn dữ liệu: bảng truy_na của dự án LuuTru (rkbzijjembmylylhpyyx), vốn
-- đồng bộ từ truyna.bocongan.gov.vn bằng LuuTru/scripts/truyna.mjs. Chép sang
-- đây bằng:   (ppv2web)  node scripts/dong-bo-truy-na.mjs
-- Cột giống hệt bảng gốc để chép thẳng; bỏ phần cảnh báo nghi trùng / push
-- (chỉ có nghĩa với dữ liệu lưu trú của LuuTru).
-- ============================================================================

create extension if not exists unaccent with schema extensions;

-- Bỏ dấu + chữ thường + gộp khoảng trắng — GIỐNG LuuTru (sql/02-truy-na.sql)
-- để ten_chuan chép sang vẫn khớp khi tìm.
create or replace function public.chuan_hoa_ten(p text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent', coalesce(p, ''))), '\s+', ' ', 'g'))
$$;

create table if not exists public.truy_na (
  ma            uuid primary key,             -- mã GUID trong link /TimKiem/ChiTiet/{ma}
  ho_ten        text not null,
  ten_chuan     text,                         -- chuan_hoa_ten(ho_ten), chép từ nguồn
  nam_sinh      int,
  noi_dktt      text,
  dktt_moi      text,                         -- địa danh mới (sau sáp nhập)
  tinh_moi      text,
  ten_bo        text,
  ten_me        text,
  toi_danh      text,
  quyet_dinh    text,
  don_vi        text,
  pham_vi       text,
  loai_truy_na  text,
  bao_cho       text,
  sdt_bao       text,
  lan_dau_thay  timestamptz not null default now(),
  lan_cuoi_thay timestamptz not null default now()
);
create index if not exists truy_na_ten_nam_idx on public.truy_na(ten_chuan, nam_sinh);

-- Nhật ký đồng bộ (chép dòng mới nhất từ LuuTru) — app hiện "cập nhật lúc ...".
create table if not exists public.dong_bo_truy_na (
  id              bigint primary key,
  bat_dau         timestamptz,
  ket_thuc        timestamptz,
  kieu            text,
  tong_tren_trang int,
  so_doc          int,
  so_moi          int,
  so_xoa          int,
  so_canh_bao     int,
  loi             text
);

-- Tìm theo họ tên (có/không dấu) + năm sinh, mỗi lần 50 dòng.
create or replace function public.tim_truy_na(p_q text default '', p_nam int default null, p_tu int default 0)
returns setof public.truy_na
language sql stable set search_path = public as $$
  select * from public.truy_na
  where (coalesce(p_q, '') = '' or ten_chuan like '%' || public.chuan_hoa_ten(p_q) || '%')
    and (p_nam is null or nam_sinh = p_nam)
  order by lan_dau_thay desc, ho_ten
  offset greatest(p_tu, 0) limit 50
$$;
revoke all on function public.tim_truy_na(text, int, int) from public, anon;
grant execute on function public.tim_truy_na(text, int, int) to authenticated;

-- QUYỀN: chỉ người đã được duyệt đọc được (giống crime/population của dự án
-- này). Không policy ghi → chỉ script đồng bộ (service-role) ghi.
alter table public.truy_na enable row level security;
alter table public.dong_bo_truy_na enable row level security;

drop policy if exists "doc_truy_na_khi_duoc_duyet" on public.truy_na;
create policy "doc_truy_na_khi_duoc_duyet" on public.truy_na for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

drop policy if exists "doc_dong_bo_khi_duoc_duyet" on public.dong_bo_truy_na;
create policy "doc_dong_bo_khi_duoc_duyet" on public.dong_bo_truy_na for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

notify pgrst, 'reload schema';
