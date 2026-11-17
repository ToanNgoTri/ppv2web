-- ppv2bat — Chức vụ "Cán bộ (admin)" = quản trị CỦA MỘT ĐƠN VỊ.
-- Chạy SAU don-vi-phan-quyen.sql và truong-ca-mot-don-vi.sql. Dán toàn bộ vào
-- SQL Editor dự án POPULATION rồi Run. Chạy lại nhiều lần được — và chạy được
-- dù trước đó đã chạy bản cũ của file này (bản "admin = dev toàn tỉnh").
--
--   • Dev toàn tỉnh: cờ la_dev (ngotritoan33) — như cũ, quản lý mọi đơn vị.
--   • Cán bộ (admin): quản lý tài khoản CHỈ trong đơn vị mình (giống Trưởng CA).
--     Mỗi đơn vị tối đa MỘT admin đang hoạt động.
--   • Cán bộ ĐÃ ĐƯỢC DUYỆT trong đơn vị, đơn vị đang khuyết admin → tự chọn
--     "Cán bộ (admin)" trong Cài đặt là thành admin NGAY, không cần duyệt.
--     Còn lại (đăng ký mới, chuyển từ đơn vị khác sang) → người quản lý đơn
--     vị đó duyệt (xem dưới), không có thì dev.
--   • Giao / thu / chuyển chức trong đơn vị (màn Quản lý tài khoản):
--       – Trưởng CA: giao hoặc thu admin của bất kỳ cán bộ nào trong đơn vị
--         (đang có admin khác → người đó tự về Cán bộ); khoá được admin;
--         chuyển chức Trưởng CA của mình cho người khác (mình về Cán bộ).
--       – Cán bộ (admin): chuyển chức admin của mình cho người khác (mình về
--         Cán bộ); giao Trưởng CA khi đơn vị đang KHUYẾT Trưởng CA.
--       – Không ai ngoài dev sửa / khoá được Trưởng CA đang giữ chức.
--     Duyệt người xin chức Trưởng CA / admin cũng theo đúng quy tắc trên.
--   • Dữ liệu đối tượng vẫn theo đơn vị như mọi người.

-- ─── 9a. Chức vụ mới ────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_chuc_vu_check;
alter table public.profiles add constraint profiles_chuc_vu_check
  check (chuc_vu in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ', 'Cán bộ (admin)'));

-- Gỡ phần của bản cũ (admin = dev): la_dev không còn đi theo chức vụ.
drop trigger if exists profiles_dong_bo_la_dev on public.profiles;
drop function if exists public.dong_bo_la_dev();
drop function if exists public.so_admin_khac(uuid);
update public.profiles p
set la_dev = (u.email = 'ngotritoan33@gmail.com')
from auth.users u
where u.id = p.id;

-- Dev (ngotritoan33) không chiếm chỗ admin của đơn vị nào.
update public.profiles set chuc_vu = 'Cán bộ'
where la_dev and chuc_vu = 'Cán bộ (admin)';

-- Mỗi đơn vị một admin: thừa thì giữ người có la_dev / tạo sớm nhất, còn lại về Cán bộ.
update public.profiles p set chuc_vu = 'Cán bộ'
where p.chuc_vu = 'Cán bộ (admin)' and p.is_active
  and exists (
    select 1 from public.profiles q
    where q.don_vi = p.don_vi and q.chuc_vu = 'Cán bộ (admin)' and q.is_active
      and q.id <> p.id
      and (q.la_dev, -extract(epoch from q.tao_luc)) > (p.la_dev, -extract(epoch from p.tao_luc))
  );

create unique index if not exists profiles_mot_admin
  on public.profiles (don_vi)
  where chuc_vu = 'Cán bộ (admin)' and is_active;

-- ─── 9b. Người quản lý đơn vị: Trưởng CA hoặc Cán bộ (admin), đã duyệt ──────
create or replace function public.la_quan_ly_don_vi()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select chuc_vu in ('Trưởng CA', 'Cán bộ (admin)') and don_vi is not null
                   from public.profiles where id = auth.uid() and is_active), false);
$$;
revoke all on function public.la_quan_ly_don_vi() from public, anon;
grant execute on function public.la_quan_ly_don_vi() to authenticated;

-- Đơn vị nào đã có Trưởng CA / admin (app làm mờ mục tương ứng). anon gọi được.
create or replace function public.chuc_vu_da_co()
returns table (don_vi text, chuc_vu text)
language sql stable security definer set search_path = public as $$
  select distinct p.don_vi, p.chuc_vu from public.profiles p
  where p.is_active and p.don_vi is not null
    and p.chuc_vu in ('Trưởng CA', 'Cán bộ (admin)');
$$;
revoke all on function public.chuc_vu_da_co() from public;
grant execute on function public.chuc_vu_da_co() to anon, authenticated;

-- ─── 9c. Đăng ký ────────────────────────────────────────────────────────────
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
  if v_cv not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ', 'Cán bộ (admin)') then
    v_cv := 'Cán bộ';
  end if;
  -- Đơn vị đã có người giữ chức này → Cán bộ (app đã chặn trước).
  if v_cv in ('Trưởng CA', 'Cán bộ (admin)') and exists (
    select 1 from public.profiles
    where don_vi = v_dv and chuc_vu = v_cv and is_active
  ) then
    v_cv := 'Cán bộ';
  end if;
  -- Chức vụ chỉ là ĐỀ NGHỊ: luôn chờ duyệt.
  insert into public.profiles (id, email, ho_ten, don_vi, chuc_vu, is_active)
  values (new.id, new.email, v_ten, v_dv, v_cv, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── 9d. Danh sách + quản lý tài khoản ──────────────────────────────────────
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
     or (public.la_quan_ly_don_vi() and p.don_vi = public.don_vi_cua_toi())
  order by p.is_active, d.thu_tu nulls first, p.ho_ten nulls last, u.email;
$$;

revoke all on function public.ds_tai_khoan() from public, anon;
grant execute on function public.ds_tai_khoan() to authenticated;

create or replace function public.cap_nhat_tai_khoan(
  p_id        uuid,
  p_is_active boolean,
  p_chuc_vu   text,
  p_don_vi    text,
  p_ho_ten    text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  t      public.profiles%rowtype;
  v_dev  boolean := public.la_dev();
  v_ql   boolean := public.la_quan_ly_don_vi();
  v_dv   text    := public.don_vi_cua_toi();
  v_toi  text    := (select chuc_vu from public.profiles where id = auth.uid() and is_active);
  v_giu  public.profiles%rowtype;   -- người đang giữ chức (Trưởng CA / admin) sẽ giao
begin
  if not (v_dev or v_ql) then
    raise exception 'Chỉ dev, Trưởng CA hoặc Cán bộ (admin) được quản lý tài khoản'
      using errcode = '42501';
  end if;

  select * into t from public.profiles where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy tài khoản';
  end if;
  if p_chuc_vu is null or p_chuc_vu not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ', 'Cán bộ (admin)') then
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

  -- Người đang giữ chức sắp giao (nếu có, khác người được giao).
  if p_chuc_vu in ('Trưởng CA', 'Cán bộ (admin)') then
    select * into v_giu from public.profiles
    where don_vi = p_don_vi and chuc_vu = p_chuc_vu and is_active and id <> p_id;
  end if;

  if not v_dev then
    -- Trưởng CA / admin: chỉ đơn vị mình, không đụng dev, không tự đổi chức
    -- trực tiếp (chuyển chức = giao cho người khác; sửa mình dùng Cài đặt).
    if t.don_vi is distinct from v_dv then
      raise exception 'Tài khoản không thuộc đơn vị của bạn' using errcode = '42501';
    end if;
    if p_don_vi is distinct from v_dv then
      raise exception 'Chỉ dev mới chuyển người sang đơn vị khác' using errcode = '42501';
    end if;
    if p_id = auth.uid() then
      if p_chuc_vu is distinct from t.chuc_vu then
        raise exception 'Đổi chức vụ của mình trong Cài đặt, hoặc giao chức cho người khác'
          using errcode = '42501';
      end if;
    else
      if t.la_dev then
        raise exception 'Không sửa được tài khoản dev' using errcode = '42501';
      end if;
      -- Trưởng CA đang giữ chức: chỉ dev sửa / khoá.
      if t.is_active and t.chuc_vu = 'Trưởng CA' then
        raise exception 'Chỉ dev mới sửa / khoá Trưởng CA' using errcode = '42501';
      end if;
      -- Admin đang giữ chức: chỉ Trưởng CA (thu / khoá) hoặc dev.
      if t.is_active and t.chuc_vu = 'Cán bộ (admin)' and v_toi <> 'Trưởng CA' then
        raise exception 'Chỉ Trưởng CA hoặc dev mới thu / khoá admin' using errcode = '42501';
      end if;
      -- Giao Trưởng CA: Trưởng CA chuyển chức của mình, hoặc đơn vị đang khuyết.
      if p_chuc_vu = 'Trưởng CA' and v_giu.id is not null and v_toi <> 'Trưởng CA' then
        raise exception 'Đơn vị đã có Trưởng CA — chỉ Trưởng CA đó (hoặc dev) chuyển chức được'
          using errcode = '42501';
      end if;
      -- Giao admin: Trưởng CA (thu của người cũ nếu có) hoặc admin chuyển chức của mình.
      if p_chuc_vu = 'Cán bộ (admin)' and v_toi not in ('Trưởng CA', 'Cán bộ (admin)') then
        raise exception 'Không giao được chức admin' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Chuyển chức: người đang giữ về Cán bộ (chỉ khi người được giao được duyệt).
  if coalesce(p_is_active, false) and v_giu.id is not null then
    update public.profiles set chuc_vu = 'Cán bộ' where id = v_giu.id;
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

-- ─── 9e. Tự sửa thông tin (Cài đặt) ─────────────────────────────────────────
-- Trả về true nếu vừa bị chuyển về chờ duyệt.
--   dev                                   : đổi gì cũng không về chờ duyệt.
--   cán bộ đã duyệt, cùng đơn vị → admin  : thành admin ngay (đơn vị khuyết admin).
--   Trưởng CA / admin tự xuống Cán bộ, cùng đơn vị : không cần duyệt.
--   còn lại đổi đơn vị / chức vụ          : về chờ duyệt.
create or replace function public.sua_ho_so_cua_toi(
  p_ho_ten  text,
  p_don_vi  text,
  p_chuc_vu text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  t        public.profiles%rowtype;
  v_doi    boolean;
  v_giu    boolean;   -- giữ trạng thái đã duyệt
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
  if p_chuc_vu is null or p_chuc_vu not in ('Trưởng CA', 'Phó Trưởng CA', 'Cán bộ', 'Cán bộ (admin)') then
    raise exception 'Chức vụ không hợp lệ';
  end if;
  if p_don_vi is null or not exists (select 1 from public.don_vi where id = p_don_vi) then
    raise exception 'Đơn vị không hợp lệ';
  end if;
  if p_chuc_vu in ('Trưởng CA', 'Cán bộ (admin)') and exists (
    select 1 from public.profiles
    where don_vi = p_don_vi and chuc_vu = p_chuc_vu and is_active and id <> auth.uid()
  ) then
    raise exception 'Đơn vị này đã có %, không chọn chức vụ này được', p_chuc_vu;
  end if;

  v_doi := p_don_vi is distinct from t.don_vi or p_chuc_vu is distinct from t.chuc_vu;
  v_giu := not v_doi
        or t.la_dev
        or (t.is_active and p_don_vi = t.don_vi and p_chuc_vu = 'Cán bộ (admin)')
        or (t.is_active and p_don_vi = t.don_vi and p_chuc_vu = 'Cán bộ'
            and t.chuc_vu in ('Trưởng CA', 'Cán bộ (admin)'));

  begin
    update public.profiles
    set ho_ten    = left(trim(p_ho_ten), 100),
        don_vi    = p_don_vi,
        chuc_vu   = p_chuc_vu,
        is_active = case when v_giu then is_active else false end
    where id = auth.uid();
  exception when unique_violation then
    raise exception 'Đơn vị này đã có % đang hoạt động', p_chuc_vu;
  end;

  return t.is_active and not v_giu;
end;
$$;

revoke all on function public.sua_ho_so_cua_toi(text, text, text) from public, anon;
grant execute on function public.sua_ho_so_cua_toi(text, text, text) to authenticated;

-- Kiểm chứng:
--   select d.ten, p.email, p.chuc_vu, p.la_dev, p.is_active
--   from public.profiles p left join public.don_vi d on d.id = p.don_vi
--   where p.la_dev or p.chuc_vu in ('Trưởng CA', 'Cán bộ (admin)');
