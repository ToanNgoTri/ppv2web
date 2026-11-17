-- ============================================================================
-- ĐƠN VỊ + CHỨC VỤ + PHÂN QUYỀN THEO ĐƠN VỊ — dự án POPULATION (app ppv2bat)
--
-- Chạy MỘT LẦN trong Supabase → SQL Editor của dự án POPULATION
-- (feuakoaglemujpwsspie). Chạy lại cũng không sao.
-- Mô hình giống PlanRegister (src/config/units.js — cùng id đơn vị):
--
--   • 95 xã/phường của Đồng Nai (bảng don_vi). Mỗi tài khoản thuộc ĐÚNG MỘT
--     đơn vị, chức vụ: Trưởng CA / Phó Trưởng CA / Cán bộ. Cờ la_dev riêng.
--   • Đối tượng (crime), khuôn mặt, nhân khẩu, tạm trú: CHỈ người cùng đơn vị
--     đọc/ghi được. Truy nã: ai đã được duyệt (mọi đơn vị) cũng xem được.
--   • Duyệt người mới, đổi chức vụ, khoá: dev (mọi đơn vị) và Trưởng CA
--     (chỉ đơn vị mình, không giao được chức Trưởng CA). Mỗi đơn vị tối đa
--     một Trưởng CA đang hoạt động — chỉ dev giao chức này.
--   • Đăng ký trên app gửi kèm họ tên, đơn vị, chức vụ (raw_user_meta_data);
--     trigger handle_new_user ghi vào profiles với is_active = false.
--
-- Dữ liệu sẵn có (chép từ hanggon) gán cho Phường Hàng Gòn; các tài khoản cũ
-- đang hoạt động thành Cán bộ của Hàng Gòn, ngotritoan33@gmail.com là dev.
--
-- ppv2web dùng khoá service-role nên KHÔNG bị chặn theo đơn vị; bản ghi web
-- thêm mà không ghi đơn vị sẽ mặc định Phường Hàng Gòn.
-- ============================================================================

begin;

-- ─── 1. DANH MỤC ĐƠN VỊ ─────────────────────────────────────────────────────
-- id là khoá vĩnh viễn (giống PlanRegister), tên đổi thoải mái.
create table if not exists public.don_vi (
  id      text primary key,
  ten     text not null unique,
  loai    text not null check (loai in ('phuong', 'xa')),
  thu_tu  smallint not null
);

insert into public.don_vi (id, ten, loai, thu_tu) values
  ('phuong-an-loc', 'Phường An Lộc', 'phuong', 1),
  ('phuong-bao-vinh', 'Phường Bảo Vinh', 'phuong', 2),
  ('phuong-bien-hoa', 'Phường Biên Hòa', 'phuong', 3),
  ('phuong-binh-long', 'Phường Bình Long', 'phuong', 4),
  ('phuong-binh-loc', 'Phường Bình Lộc', 'phuong', 5),
  ('phuong-binh-phuoc', 'Phường Bình Phước', 'phuong', 6),
  ('phuong-chon-thanh', 'Phường Chơn Thành', 'phuong', 7),
  ('phuong-dau-giay', 'Phường Dầu Giây', 'phuong', 8),
  ('phuong-dong-phu', 'Phường Đồng Phú', 'phuong', 9),
  ('phuong-dong-xoai', 'Phường Đồng Xoài', 'phuong', 10),
  ('phuong-hang-gon', 'Phường Hàng Gòn', 'phuong', 11),
  ('phuong-ho-nai', 'Phường Hố Nai', 'phuong', 12),
  ('phuong-long-binh', 'Phường Long Bình', 'phuong', 13),
  ('phuong-long-hung', 'Phường Long Hưng', 'phuong', 14),
  ('phuong-long-khanh', 'Phường Long Khánh', 'phuong', 15),
  ('phuong-long-thanh', 'Phường Long Thành', 'phuong', 16),
  ('phuong-loc-ninh', 'Phường Lộc Ninh', 'phuong', 17),
  ('phuong-minh-hung', 'Phường Minh Hưng', 'phuong', 18),
  ('phuong-nhon-trach', 'Phường Nhơn Trạch', 'phuong', 19),
  ('phuong-phuoc-binh', 'Phường Phước Bình', 'phuong', 20),
  ('phuong-phuoc-long', 'Phường Phước Long', 'phuong', 21),
  ('phuong-phuoc-tan', 'Phường Phước Tân', 'phuong', 22),
  ('phuong-tam-hiep', 'Phường Tam Hiệp', 'phuong', 23),
  ('phuong-tam-phuoc', 'Phường Tam Phước', 'phuong', 24),
  ('phuong-tan-khai', 'Phường Tân Khai', 'phuong', 25),
  ('phuong-tan-phu', 'Phường Tân Phú', 'phuong', 26),
  ('phuong-tan-trieu', 'Phường Tân Triều', 'phuong', 27),
  ('phuong-trang-bom', 'Phường Trảng Bom', 'phuong', 28),
  ('phuong-trang-dai', 'Phường Trảng Dài', 'phuong', 29),
  ('phuong-tran-bien', 'Phường Trấn Biên', 'phuong', 30),
  ('phuong-tri-an', 'Phường Trị An', 'phuong', 31),
  ('phuong-xuan-lap', 'Phường Xuân Lập', 'phuong', 32),
  ('phuong-xuan-loc', 'Phường Xuân Lộc', 'phuong', 33),
  ('xa-an-phuoc', 'Xã An Phước', 'xa', 34),
  ('xa-an-vien', 'Xã An Viễn', 'xa', 35),
  ('xa-bau-ham', 'Xã Bàu Hàm', 'xa', 36),
  ('xa-binh-an', 'Xã Bình An', 'xa', 37),
  ('xa-binh-minh', 'Xã Bình Minh', 'xa', 38),
  ('xa-binh-tan', 'Xã Bình Tân', 'xa', 39),
  ('xa-bom-bo', 'Xã Bom Bo', 'xa', 40),
  ('xa-bu-dang', 'Xã Bù Đăng', 'xa', 41),
  ('xa-bu-gia-map', 'Xã Bù Gia Mập', 'xa', 42),
  ('xa-cam-my', 'Xã Cẩm Mỹ', 'xa', 43),
  ('xa-da-kia', 'Xã Đa Kia', 'xa', 44),
  ('xa-dai-phuoc', 'Xã Đại Phước', 'xa', 45),
  ('xa-dak-lua', 'Xã Đak Lua', 'xa', 46),
  ('xa-dak-nhau', 'Xã Đak Nhau', 'xa', 47),
  ('xa-dak-o', 'Xã Đăk Ơ', 'xa', 48),
  ('xa-dinh-quan', 'Xã Định Quán', 'xa', 49),
  ('xa-dong-tam', 'Xã Đồng Tâm', 'xa', 50),
  ('xa-gia-kiem', 'Xã Gia Kiệm', 'xa', 51),
  ('xa-hung-phuoc', 'Xã Hưng Phước', 'xa', 52),
  ('xa-hung-thinh', 'Xã Hưng Thịnh', 'xa', 53),
  ('xa-la-nga', 'Xã La Ngà', 'xa', 54),
  ('xa-long-ha', 'Xã Long Hà', 'xa', 55),
  ('xa-long-phuoc', 'Xã Long Phước', 'xa', 56),
  ('xa-loc-hung', 'Xã Lộc Hưng', 'xa', 57),
  ('xa-loc-quang', 'Xã Lộc Quang', 'xa', 58),
  ('xa-loc-tan', 'Xã Lộc Tấn', 'xa', 59),
  ('xa-loc-thanh', 'Xã Lộc Thành', 'xa', 60),
  ('xa-loc-thanh-nang', 'Xã Lộc Thạnh', 'xa', 61),
  ('xa-minh-duc', 'Xã Minh Đức', 'xa', 62),
  ('xa-nam-cat-tien', 'Xã Nam Cát Tiên', 'xa', 63),
  ('xa-nghia-trung', 'Xã Nghĩa Trung', 'xa', 64),
  ('xa-nha-bich', 'Xã Nha Bích', 'xa', 65),
  ('xa-phu-hoa', 'Xã Phú Hòa', 'xa', 66),
  ('xa-phu-lam', 'Xã Phú Lâm', 'xa', 67),
  ('xa-phu-ly', 'Xã Phú Lý', 'xa', 68),
  ('xa-phu-nghia', 'Xã Phú Nghĩa', 'xa', 69),
  ('xa-phu-rieng', 'Xã Phú Riềng', 'xa', 70),
  ('xa-phu-trung', 'Xã Phú Trung', 'xa', 71),
  ('xa-phu-vinh', 'Xã Phú Vinh', 'xa', 72),
  ('xa-phuoc-an', 'Xã Phước An', 'xa', 73),
  ('xa-phuoc-son', 'Xã Phước Sơn', 'xa', 74),
  ('xa-phuoc-thai', 'Xã Phước Thái', 'xa', 75),
  ('xa-song-ray', 'Xã Sông Ray', 'xa', 76),
  ('xa-ta-lai', 'Xã Tà Lài', 'xa', 77),
  ('xa-tan-an', 'Xã Tân An', 'xa', 78),
  ('xa-tan-hung', 'Xã Tân Hưng', 'xa', 79),
  ('xa-tan-loi', 'Xã Tân Lợi', 'xa', 80),
  ('xa-tan-quan', 'Xã Tân Quan', 'xa', 81),
  ('xa-tan-tien', 'Xã Tân Tiến', 'xa', 82),
  ('xa-thanh-son', 'Xã Thanh Sơn', 'xa', 83),
  ('xa-thien-hung', 'Xã Thiện Hưng', 'xa', 84),
  ('xa-tho-son', 'Xã Thọ Sơn', 'xa', 85),
  ('xa-thong-nhat', 'Xã Thống Nhất', 'xa', 86),
  ('xa-thuan-loi', 'Xã Thuận Lợi', 'xa', 87),
  ('xa-xuan-bac', 'Xã Xuân Bắc', 'xa', 88),
  ('xa-xuan-dinh', 'Xã Xuân Định', 'xa', 89),
  ('xa-xuan-dong', 'Xã Xuân Đông', 'xa', 90),
  ('xa-xuan-duong', 'Xã Xuân Đường', 'xa', 91),
  ('xa-xuan-hoa', 'Xã Xuân Hòa', 'xa', 92),
  ('xa-xuan-phu', 'Xã Xuân Phú', 'xa', 93),
  ('xa-xuan-que', 'Xã Xuân Quế', 'xa', 94),
  ('xa-xuan-thanh', 'Xã Xuân Thành', 'xa', 95)
on conflict (id) do update
  set ten = excluded.ten, loai = excluded.loai, thu_tu = excluded.thu_tu;

-- Danh mục công khai: màn Đăng ký (chưa đăng nhập) cũng cần đọc.
alter table public.don_vi enable row level security;
drop policy if exists "ai cung doc" on public.don_vi;
create policy "ai cung doc" on public.don_vi for select to anon, authenticated using (true);


-- ─── 2. HỒ SƠ: đơn vị, chức vụ, dev ─────────────────────────────────────────
alter table public.profiles
  add column if not exists email    text,
  add column if not exists ho_ten   text,
  add column if not exists don_vi   text references public.don_vi (id),
  add column if not exists chuc_vu  text not null default 'Cán bộ',
  add column if not exists la_dev   boolean not null default false,
  add column if not exists tao_luc  timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_chuc_vu_check;
alter table public.profiles add constraint profiles_chuc_vu_check
  check (chuc_vu in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ'));

update public.profiles set is_active = false where is_active is null;
alter table public.profiles alter column is_active set default false;
alter table public.profiles alter column is_active set not null;

-- Tài khoản cũ: email + ngày tạo thật.
update public.profiles p
set email   = coalesce(p.email, u.email),
    tao_luc = u.created_at
from auth.users u
where u.id = p.id and (p.email is null or p.tao_luc > u.created_at);

-- Tài khoản đang hoạt động mà chưa có đơn vị = người dùng cũ của Hàng Gòn.
update public.profiles set don_vi = 'phuong-hang-gon' where don_vi is null and is_active;

update public.profiles p set la_dev = true
from auth.users u
where u.id = p.id and u.email = 'ngotritoan33@gmail.com';

-- Mỗi đơn vị tối đa MỘT Trưởng CA đang hoạt động.
create unique index if not exists profiles_mot_truong_ca
  on public.profiles (don_vi)
  where chuc_vu = 'Trưởng CA' and is_active;

create index if not exists profiles_don_vi_idx on public.profiles (don_vi);

-- LỖ HỔNG CŨ: policy "id" cho MỌI vai trò (kể cả anon) toàn quyền với profiles
-- — ai có khoá anon (nằm trong APK) cũng tự bật is_active cho mình được. Bỏ,
-- chỉ cho đọc hồ sơ của chính mình. Mọi thay đổi đi qua cap_nhat_tai_khoan.
alter table public.profiles enable row level security;
drop policy if exists "id" on public.profiles;
drop policy if exists "doc ho so cua minh" on public.profiles;
create policy "doc ho so cua minh" on public.profiles
  for select to authenticated using (id = auth.uid());


-- ─── 3. HÀM TIỆN ÍCH (security definer: tự đọc profiles, không đệ quy RLS) ───
create or replace function public.duoc_duyet()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

-- Đơn vị của người đang gọi; null nếu chưa duyệt → mọi policy theo đơn vị đều chặn.
create or replace function public.don_vi_cua_toi()
returns text language sql stable security definer set search_path = public as $$
  select don_vi from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.la_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select la_dev from public.profiles where id = auth.uid() and is_active), false);
$$;

create or replace function public.la_truong_ca()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select chuc_vu = 'Trưởng CA' and don_vi is not null
                   from public.profiles where id = auth.uid() and is_active), false);
$$;

revoke all on function public.duoc_duyet()     from public, anon;
revoke all on function public.don_vi_cua_toi() from public, anon;
revoke all on function public.la_dev()         from public, anon;
revoke all on function public.la_truong_ca()   from public, anon;
grant execute on function public.duoc_duyet()     to authenticated;
grant execute on function public.don_vi_cua_toi() to authenticated;
grant execute on function public.la_dev()         to authenticated;
grant execute on function public.la_truong_ca()   to authenticated;


-- ─── 4. ĐĂNG KÝ: trigger ghi hồ sơ từ thông tin app gửi kèm ─────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_dv   text  := nullif(trim(v_meta ->> 'don_vi'), '');
  v_cv   text  := coalesce(nullif(trim(v_meta ->> 'chuc_vu'), ''), 'Cán bộ');
  v_ten  text  := left(nullif(trim(v_meta ->> 'ho_ten'), ''), 100);
begin
  if v_dv is not null and not exists (select 1 from public.don_vi where id = v_dv) then
    v_dv := null;
  end if;
  if v_cv not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ') then
    v_cv := 'Cán bộ';
  end if;
  -- Chức vụ chỉ là ĐỀ NGHỊ: luôn chờ duyệt; người duyệt đổi được trước khi duyệt.
  insert into public.profiles (id, email, ho_ten, don_vi, chuc_vu, is_active)
  values (new.id, new.email, v_ten, v_dv, v_cv, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 5. QUẢN LÝ TÀI KHOẢN (dev + Trưởng CA) ─────────────────────────────────
-- Danh sách tài khoản người gọi được quản lý: dev thấy tất cả, Trưởng CA thấy
-- người của đơn vị mình. Người khác gọi → 0 dòng.
create or replace function public.ds_tai_khoan()
returns table (
  id             uuid,
  email          text,
  ho_ten         text,
  don_vi         text,
  ten_don_vi     text,
  chuc_vu        text,
  la_dev         boolean,
  is_active      boolean,
  tao_luc        timestamptz,
  dang_nhap_cuoi timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.email, u.email)::text, p.ho_ten, p.don_vi, d.ten,
         p.chuc_vu, p.la_dev, p.is_active, p.tao_luc, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.don_vi d on d.id = p.don_vi
  where public.la_dev()
     or (public.la_truong_ca() and p.don_vi = public.don_vi_cua_toi())
  order by p.is_active, d.thu_tu nulls first, p.ho_ten nulls last, u.email;
$$;

revoke all on function public.ds_tai_khoan() from public, anon;
grant execute on function public.ds_tai_khoan() to authenticated;

-- Duyệt / khoá / đổi chức vụ / đổi đơn vị một tài khoản.
create or replace function public.cap_nhat_tai_khoan(
  p_id        uuid,
  p_is_active boolean,
  p_chuc_vu   text,
  p_don_vi    text,
  p_ho_ten    text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  t        public.profiles%rowtype;
  v_dev    boolean := public.la_dev();
  v_truong boolean := public.la_truong_ca();
  v_dv     text    := public.don_vi_cua_toi();
  v_cu     text;
begin
  if not (v_dev or v_truong) then
    raise exception 'Chỉ dev hoặc Trưởng CA được quản lý tài khoản' using errcode = '42501';
  end if;

  select * into t from public.profiles where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy tài khoản';
  end if;
  if p_chuc_vu is null or p_chuc_vu not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ') then
    raise exception 'Chức vụ không hợp lệ';
  end if;
  if p_don_vi is not null and not exists (select 1 from public.don_vi where id = p_don_vi) then
    raise exception 'Đơn vị không hợp lệ';
  end if;
  if coalesce(p_is_active, false) and p_don_vi is null then
    raise exception 'Phải chọn đơn vị trước khi duyệt';
  end if;
  if p_id = auth.uid() and not coalesce(p_is_active, false) then
    raise exception 'Không tự khoá tài khoản của mình được';
  end if;

  if not v_dev then
    -- Trưởng CA: chỉ trong đơn vị mình, không đụng dev, không giao/bỏ chức Trưởng CA.
    if t.don_vi is distinct from v_dv then
      raise exception 'Tài khoản không thuộc đơn vị của bạn' using errcode = '42501';
    end if;
    if p_don_vi is distinct from v_dv then
      raise exception 'Chỉ dev mới chuyển người sang đơn vị khác' using errcode = '42501';
    end if;
    if t.la_dev and p_id <> auth.uid() then
      raise exception 'Không sửa được tài khoản dev' using errcode = '42501';
    end if;
    if p_id = auth.uid() and p_chuc_vu <> 'Trưởng CA' then
      raise exception 'Muốn thôi chức Trưởng CA, nhờ dev chuyển' using errcode = '42501';
    end if;
    if p_id <> auth.uid() and p_chuc_vu = 'Trưởng CA' then
      raise exception 'Chỉ dev mới giao chức Trưởng CA' using errcode = '42501';
    end if;
  end if;

  if coalesce(p_is_active, false) and p_chuc_vu = 'Trưởng CA' then
    select coalesce(ho_ten, email) into v_cu from public.profiles
    where don_vi = p_don_vi and chuc_vu = 'Trưởng CA' and is_active and id <> p_id;
    if found then
      raise exception 'Đơn vị này đã có Trưởng CA (%). Đổi chức vụ người đó trước.', v_cu;
    end if;
  end if;

  update public.profiles
  set is_active = coalesce(p_is_active, false),
      chuc_vu   = p_chuc_vu,
      don_vi    = p_don_vi,
      ho_ten    = coalesce(left(nullif(trim(p_ho_ten), ''), 100), ho_ten)
  where id = p_id;
end;
$$;

revoke all on function public.cap_nhat_tai_khoan(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.cap_nhat_tai_khoan(uuid, boolean, text, text, text) to authenticated;


-- ─── 6. DỮ LIỆU THEO ĐƠN VỊ ─────────────────────────────────────────────────
-- Cột don_vi, mặc định = đơn vị người ghi (app không phải gửi). Ghi bằng
-- service-role (ppv2web, script) không có đơn vị → mặc định Phường Hàng Gòn.

-- crime — đối tượng
alter table public.crime add column if not exists don_vi text references public.don_vi (id);
update public.crime set don_vi = 'phuong-hang-gon' where don_vi is null;
alter table public.crime alter column don_vi set default coalesce(public.don_vi_cua_toi(), 'phuong-hang-gon');
alter table public.crime alter column don_vi set not null;
create index if not exists crime_don_vi_idx on public.crime (don_vi);

alter table public.crime enable row level security;
drop policy if exists "user id" on public.crime;
drop policy if exists "nguoi duoc duyet toan quyen" on public.crime;
drop policy if exists "cung don vi" on public.crime;
create policy "cung don vi" on public.crime for all to authenticated
  using (don_vi = public.don_vi_cua_toi())
  with check (don_vi = public.don_vi_cua_toi());

-- population — nhân khẩu (ppv2bat không dùng, nhưng chặn đọc chéo qua khoá anon)
alter table public.population add column if not exists don_vi text references public.don_vi (id);
update public.population set don_vi = 'phuong-hang-gon' where don_vi is null;
alter table public.population alter column don_vi set default coalesce(public.don_vi_cua_toi(), 'phuong-hang-gon');
alter table public.population alter column don_vi set not null;
create index if not exists population_don_vi_idx on public.population (don_vi);

alter table public.population enable row level security;
drop policy if exists "population policy" on public.population;
drop policy if exists "nguoi duoc duyet toan quyen" on public.population;
drop policy if exists "cung don vi" on public.population;
create policy "cung don vi" on public.population for all to authenticated
  using (don_vi = public.don_vi_cua_toi())
  with check (don_vi = public.don_vi_cua_toi());

-- tamtru — tạm trú
alter table public.tamtru add column if not exists don_vi text references public.don_vi (id);
update public.tamtru set don_vi = 'phuong-hang-gon' where don_vi is null;
alter table public.tamtru alter column don_vi set default coalesce(public.don_vi_cua_toi(), 'phuong-hang-gon');
alter table public.tamtru alter column don_vi set not null;
create index if not exists tamtru_don_vi_idx on public.tamtru (don_vi);

alter table public.tamtru enable row level security;
drop policy if exists "nguoi duoc duyet toan quyen" on public.tamtru;
drop policy if exists "cung don vi" on public.tamtru;
create policy "cung don vi" on public.tamtru for all to authenticated
  using (don_vi = public.don_vi_cua_toi())
  with check (don_vi = public.don_vi_cua_toi());

-- khuon_mat — chỉ thấy mặt của đối tượng mình đọc được (RLS crime áp vào subquery).
drop policy if exists "doc_khuon_mat_khi_duoc_duyet" on public.khuon_mat;
drop policy if exists "doc khuon mat cung don vi" on public.khuon_mat;
create policy "doc khuon mat cung don vi" on public.khuon_mat for select to authenticated
  using (exists (select 1 from public.crime c where c."CCCD" = khuon_mat."CCCD"));

-- Tìm mặt: lọc theo đơn vị TRƯỚC rồi mới xếp theo độ giống (quét thẳng, không
-- qua chỉ mục HNSW — HNSW lấy top-k toàn kho rồi mới lọc thì có thể mất kết
-- quả của đơn vị mình). Kho vài nghìn mặt quét thẳng vẫn vài ms.
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
language sql stable security invoker set search_path = public, extensions as $$
  with cua_toi as materialized (
    select k."CCCD", k.duong_dan, k.vector
    from public.khuon_mat k
    join public.crime c on c."CCCD" = k."CCCD"
    where k.vector is not null
  ),
  gan_nhat as (
    select t."CCCD", t.duong_dan, 1 - (t.vector <=> vec) as do_giong
    from cua_toi t
    order by t.vector <=> vec
    limit greatest(so_luong, 1) * 5
  ),
  moi_nguoi as (
    select distinct on (g."CCCD") g.*
    from gan_nhat g
    order by g."CCCD", g.do_giong desc
  )
  select m."CCCD"::varchar, c."HOTEN"::text, c."NAMSINH"::text, c."NOITHTRU"::text,
         m.do_giong, m.duong_dan
  from moi_nguoi m
  join public.crime c on c."CCCD" = m."CCCD"
  where m.do_giong >= nguong
  order by m.do_giong desc
  limit least(greatest(so_luong, 1), 50);
$$;

revoke all on function public.tim_khuon_mat(extensions.vector, integer, double precision) from public, anon;
grant execute on function public.tim_khuon_mat(extensions.vector, integer, double precision) to authenticated, service_role;

-- Ghi mặt: chỉ cho đối tượng thuộc đơn vị mình.
create or replace function public.luu_khuon_mat(p_cccd text, p_mat jsonb)
returns integer language plpgsql security definer set search_path = public, extensions as $$
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
  if not exists (select 1 from public.crime c
                 where c."CCCD" = p_cccd and c.don_vi = public.don_vi_cua_toi()) then
    raise exception 'Không có đối tượng với CCCD % trong đơn vị của bạn', p_cccd;
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

-- ─── 7. TỰ SỬA THÔNG TIN CÁ NHÂN (màn Cài đặt) ──────────────────────────────
-- Họ tên: sửa thoải mái. Đổi đơn vị hoặc chức vụ (không phải dev) → quay về
-- CHỜ DUYỆT, người duyệt là Trưởng CA đơn vị mới / dev — như PlanRegister.
-- Trả về true nếu vừa bị chuyển về chờ duyệt.
create or replace function public.sua_ho_so_cua_toi(
  p_ho_ten  text,
  p_don_vi  text,
  p_chuc_vu text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  t      public.profiles%rowtype;
  v_doi  boolean;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  select * into t from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Không tìm thấy hồ sơ';
  end if;
  if nullif(trim(p_ho_ten), '') is null then
    raise exception 'Họ tên không được để trống';
  end if;
  if p_chuc_vu is null or p_chuc_vu not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ') then
    raise exception 'Chức vụ không hợp lệ';
  end if;
  if p_don_vi is null or not exists (select 1 from public.don_vi where id = p_don_vi) then
    raise exception 'Đơn vị không hợp lệ';
  end if;

  v_doi := p_don_vi is distinct from t.don_vi or p_chuc_vu is distinct from t.chuc_vu;

  begin
    update public.profiles
    set ho_ten    = left(trim(p_ho_ten), 100),
        don_vi    = p_don_vi,
        chuc_vu   = p_chuc_vu,
        is_active = case when v_doi and not t.la_dev then false else is_active end
    where id = auth.uid();
  exception when unique_violation then
    raise exception 'Đơn vị này đã có Trưởng CA đang hoạt động';
  end;

  return v_doi and not t.la_dev and t.is_active;
end;
$$;

revoke all on function public.sua_ho_so_cua_toi(text, text, text) from public, anon;
grant execute on function public.sua_ho_so_cua_toi(text, text, text) to authenticated;

-- truy_na / dong_bo_truy_na: GIỮ NGUYÊN — ai đã được duyệt (mọi đơn vị) đều xem.

commit;

notify pgrst, 'reload schema';


-- ─── KIỂM CHỨNG ─────────────────────────────────────────────────────────────
select count(*) as so_don_vi from public.don_vi;                       -- 95

select coalesce(d.ten, '(chưa có)') as don_vi, p.chuc_vu, p.la_dev, p.is_active, p.email
from public.profiles p left join public.don_vi d on d.id = p.don_vi
order by p.is_active desc, d.thu_tu, p.email;

select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'crime', 'population', 'tamtru', 'khuon_mat', 'don_vi')
order by tablename;
-- mong đợi: crime/population/tamtru "cung don vi"; khuon_mat "doc khuon mat cung don vi";
--           profiles CHỈ "doc ho so cua minh"; don_vi "ai cung doc".


-- ─── DÙNG HẰNG NGÀY (hoặc làm trên app: màn Tài khoản) ──────────────────────
-- Giao Trưởng CA cho một người:
--   update public.profiles set chuc_vu = 'Trưởng CA', is_active = true,
--          don_vi = 'phuong-hang-gon'
--   where email = 'ten@vidu.com';
-- Thêm dev:
--   update public.profiles set la_dev = true where email = 'ten@vidu.com';
