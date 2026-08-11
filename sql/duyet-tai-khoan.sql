-- ============================================================================
-- DUYỆT TÀI KHOẢN — người mới đăng ký bị khóa cho tới khi quản trị mở
--
-- Chạy trong Supabase → SQL Editor, theo đúng thứ tự các bước.
-- Sau khi chạy xong mới đặt REQUIRE_ACTIVE_PROFILE=true trong .env.local
-- ============================================================================


-- BƯỚC 1 — Mở khóa cho các tài khoản ĐANG DÙNG.
-- Phải làm TRƯỚC, nếu không chính bạn cũng bị khóa.
insert into public.profiles (id, email, is_active)
select u.id, u.email, true
from auth.users u
on conflict (id) do update set is_active = true;


-- BƯỚC 2 — Người đăng ký mới mặc định CHƯA được duyệt.
alter table public.profiles alter column is_active set default false;


-- BƯỚC 3 — Tự tạo hồ sơ mỗi khi có người đăng ký.
-- security definer để hàm chạy được dù bảng có bật RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_active)
  values (new.id, new.email, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- BƯỚC 4 — Bật RLS cho bảng profiles.
-- Người dùng chỉ đọc được hồ sơ của chính mình và KHÔNG tự sửa được is_active.
-- (Phía máy chủ dùng khóa service-role nên không bị RLS chặn.)
alter table public.profiles enable row level security;

drop policy if exists "doc ho so cua minh" on public.profiles;
create policy "doc ho so cua minh"
  on public.profiles for select
  using (auth.uid() = id);


-- ============================================================================
-- DÙNG HẰNG NGÀY
-- ============================================================================

-- Xem ai đang chờ duyệt:
--   select id, email, created_at from public.profiles
--   where is_active = false order by created_at desc;

-- Duyệt một người:
--   update public.profiles set is_active = true where email = 'ten@vidu.com';

-- Khóa một người:
--   update public.profiles set is_active = false where email = 'ten@vidu.com';
