-- ppv2bat — Mỗi đơn vị chỉ một Trưởng CA (chạy SAU don-vi-phan-quyen.sql).
-- Dán toàn bộ vào SQL Editor của dự án POPULATION rồi Run. Chạy lại nhiều lần được.
--
--   • Đơn vị ĐÃ có Trưởng CA đang hoạt động → app không cho chọn "Trưởng CA"
--     (đăng ký, Cài đặt, màn Quản lý tài khoản). Server cũng chặn.
--   • Đơn vị CHƯA có → cho chọn, nhưng chỉ dev duyệt được (Trưởng CA khác /
--     Phó không duyệt) — cap_nhat_tai_khoan đã chặn từ trước: người không phải
--     dev không giao được chức Trưởng CA cho người khác.

-- ─── 8a. Đơn vị nào đã có Trưởng CA (chỉ trả id đơn vị, không lộ ai) ──────────
-- anon cũng gọi được vì màn Đăng ký chưa đăng nhập.
create or replace function public.don_vi_da_co_truong()
returns setof text
language sql stable security definer set search_path = public as $$
  select distinct don_vi from public.profiles
  where chuc_vu = 'Trưởng CA' and is_active and don_vi is not null;
$$;

revoke all on function public.don_vi_da_co_truong() from public;
grant execute on function public.don_vi_da_co_truong() to anon, authenticated;

-- ─── 8b. Đăng ký: đơn vị đã có Trưởng CA mà vẫn gửi "Trưởng CA" → Cán bộ ──────
-- (không raise: raise trong trigger làm signUp báo lỗi khó hiểu; app đã chặn trước)
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
  if v_cv = 'Trưởng CA' and exists (
    select 1 from public.profiles
    where don_vi = v_dv and chuc_vu = 'Trưởng CA' and is_active
  ) then
    v_cv := 'Cán bộ';
  end if;
  -- Chức vụ chỉ là ĐỀ NGHỊ: luôn chờ duyệt; người duyệt đổi được trước khi duyệt.
  insert into public.profiles (id, email, ho_ten, don_vi, chuc_vu, is_active)
  values (new.id, new.email, v_ten, v_dv, v_cv, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── 8c. Cài đặt: không tự chọn Trưởng CA ở đơn vị đã có Trưởng CA ────────────
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
  if p_chuc_vu = 'Trưởng CA' and exists (
    select 1 from public.profiles
    where don_vi = p_don_vi and chuc_vu = 'Trưởng CA' and is_active and id <> auth.uid()
  ) then
    raise exception 'Đơn vị này đã có Trưởng CA, không chọn chức vụ này được';
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

-- Kiểm chứng:  select * from public.don_vi_da_co_truong();
