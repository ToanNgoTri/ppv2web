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
