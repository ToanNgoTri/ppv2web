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
