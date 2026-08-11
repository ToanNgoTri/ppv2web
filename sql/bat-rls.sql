-- ============================================================================
-- BẬT ROW LEVEL SECURITY
--
-- Dùng chung cho CẢ HAI dự án hanggon và population — lược đồ giống nhau.
-- Chạy trong Supabase → SQL Editor.
--
-- VÌ SAO CẦN: khóa anon nằm công khai trong bundle app và trong biến
-- NEXT_PUBLIC_ của web. Chưa bật RLS thì ai có khóa đó là đọc thẳng được
-- population, crime, profiles — bỏ qua hoàn toàn lớp chặn của ppv2web.
--
-- CÁC API ROUTE CỦA PPV2WEB KHÔNG BỊ ẢNH HƯỞNG: chúng dùng khóa service-role,
-- mà khóa này bỏ qua RLS theo thiết kế.
--
-- ẢNH HƯỞNG TỚI PPV2APP: app dùng khóa anon nên sẽ chịu RLS. Người đã đăng nhập
-- VÀ được duyệt vẫn dùng bình thường; người chưa duyệt sẽ không đọc được gì.
-- ============================================================================


-- ─── BƯỚC 0 — KIỂM TRA TRƯỚC KHI BẬT ────────────────────────────────────────
-- Chạy riêng khối này trước. Nếu có dòng nào "chưa có hồ sơ" hoặc "chưa duyệt"
-- thì người đó sẽ MẤT quyền truy cập ngay khi bật RLS. Xử lý xong hãy chạy tiếp.

select
  u.email,
  case
    when p.id is null      then 'chưa có hồ sơ  → sẽ mất quyền'
    when p.is_active       then 'đã duyệt       → vẫn dùng được'
    else                        'chưa duyệt     → sẽ mất quyền'
  end as trang_thai
from auth.users u
left join public.profiles p on p.id = u.id
order by 2, 1;


-- ─── BƯỚC 1 — HÀM KIỂM TRA ĐÃ DUYỆT ─────────────────────────────────────────
-- security definer để hàm tự đọc được profiles, không bị chính RLS của bảng đó
-- chặn lại (nếu không sẽ thành đệ quy). stable để Postgres nhớ kết quả trong
-- một câu truy vấn, tránh gọi lại trên từng dòng.

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


-- ─── BƯỚC 2 — BẢNG PROFILES ─────────────────────────────────────────────────
-- Chỉ cho ĐỌC hồ sơ của chính mình. Cố ý KHÔNG có policy insert/update/delete
-- để người dùng không thể tự bật is_active cho mình.
-- Trigger tạo hồ sơ vẫn chạy được vì nó là security definer.

alter table public.profiles enable row level security;

drop policy if exists "doc ho so cua minh" on public.profiles;
create policy "doc ho so cua minh"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());


-- ─── BƯỚC 3 — BẢNG DỮ LIỆU ──────────────────────────────────────────────────
-- Người đã đăng nhập VÀ được duyệt thì toàn quyền; ai khác không thấy gì.
--   using      → lọc dòng được đọc/sửa/xóa
--   with check → chặn ghi dữ liệu mới khi chưa đủ điều kiện
-- Vai trò 'anon' không có policy nào, nên khóa anon trần không đọc được gì nữa.

alter table public.population enable row level security;
drop policy if exists "nguoi duoc duyet toan quyen" on public.population;
create policy "nguoi duoc duyet toan quyen"
  on public.population for all
  to authenticated
  using (public.duoc_duyet())
  with check (public.duoc_duyet());

alter table public.crime enable row level security;
drop policy if exists "nguoi duoc duyet toan quyen" on public.crime;
create policy "nguoi duoc duyet toan quyen"
  on public.crime for all
  to authenticated
  using (public.duoc_duyet())
  with check (public.duoc_duyet());

alter table public.qrvalue enable row level security;
drop policy if exists "nguoi duoc duyet toan quyen" on public.qrvalue;
create policy "nguoi duoc duyet toan quyen"
  on public.qrvalue for all
  to authenticated
  using (public.duoc_duyet())
  with check (public.duoc_duyet());


-- ─── BƯỚC 4 — KIỂM CHỨNG ────────────────────────────────────────────────────
-- Cả bốn bảng phải hiện rowsecurity = true và có đúng số policy như dưới.

select tablename, rowsecurity as rls_bat,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename) as so_policy
from pg_tables t
where schemaname = 'public' and tablename in ('profiles','population','crime','qrvalue')
order by tablename;
-- mong đợi:  crime 1 · population 1 · profiles 1 · qrvalue 1, rls_bat = true cả bốn


-- ============================================================================
-- CÁCH LÙI LẠI NẾU APP HỎNG
--
-- Tắt RLS cho một bảng (dữ liệu không mất, chỉ bỏ lớp chặn):
--   alter table public.crime disable row level security;
--
-- Tắt hết:
--   alter table public.profiles   disable row level security;
--   alter table public.population disable row level security;
--   alter table public.crime      disable row level security;
--   alter table public.qrvalue    disable row level security;
--
-- Ai đó bị chặn nhầm thì duyệt cho họ:
--   update public.profiles set is_active = true where id =
--     (select id from auth.users where email = 'ten@vidu.com');
-- ============================================================================


-- ============================================================================
-- CHƯA XỬ LÝ Ở ĐÂY: SUPABASE STORAGE
--
-- ppv2app tải ảnh lên bucket 'imageCrime'. Storage có hệ policy riêng trong
-- schema storage, không dính gì tới các lệnh trên. Kiểm tra ở
-- Supabase → Storage → imageCrime → Policies. Nếu bucket đang để public thì
-- ảnh vẫn ai cũng xem được dù đã bật RLS cho các bảng.
-- ============================================================================
