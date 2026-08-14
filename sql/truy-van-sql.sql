-- ============================================================================
-- MÀN HÌNH TRUY VẤN SQL (/sql) — hàm chạy câu lệnh CHỈ ĐỌC
--
-- Chạy MỘT LẦN trong Supabase → SQL Editor, cho MỖI dự án (population và
-- hanggon là hai project riêng, phải chạy ở cả hai).
--
-- Vì sao phải có hàm này: thư viện supabase-js không chạy được SQL thô, nó chỉ
-- gọi được REST và RPC. Nên câu lệnh người dùng dán vào được gửi tới hàm dưới
-- đây qua RPC.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BƯỚC 1 — Tạo hàm
--
-- Hai lớp chặn ghi, độc lập nhau:
--
--   1. `set local transaction_read_only = on` → cấm ghi ở tầng động cơ Postgres,
--                  suốt phần còn lại của transaction. Chặn cả trường hợp câu
--                  SELECT gọi tới một hàm có ghi dữ liệu — thứ mà lớp 2 không
--                  nhìn thấy.
--   2. bọc câu lệnh vào trong `select * from ( ... ) sub` → DELETE/UPDATE/
--                  INSERT nhét vào đó là LỖI CÚ PHÁP, không phải "chạy rồi mới
--                  bị chặn". Kể cả CTE ghi dữ liệu
--                  (`with x as (delete ...) select ...`) cũng hỏng, vì Postgres
--                  bắt buộc CTE ghi phải nằm ở cấp cao nhất của câu lệnh.
--
-- Phía Node còn một lớp nữa (lib/sql.js) nhưng lớp đó chỉ để báo lỗi tiếng Việt
-- cho dễ hiểu — không được coi nó là hàng rào an toàn.
--
-- ⚠ ĐỪNG ĐỔI `volatile` THÀNH `stable`. Nhìn thì có vẻ đúng hơn (hàm này chỉ
-- đọc), và `stable` còn khiến PostgREST tự chạy hàm trong transaction read-only.
-- Nhưng Postgres CẤM lệnh SET trong hàm non-volatile, nên hàm sẽ chết ngay ở
-- dòng dưới với `SET is not allowed in a non-volatile function` — mất cả
-- transaction_read_only lẫn statement_timeout. Đã thử và dính đúng lỗi này.
-- ----------------------------------------------------------------------------

create or replace function public.chay_truy_van(
  cau_lenh text,
  gioi_han integer default 1000
)
returns json
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  ket_qua json;
begin
  -- Lớp 1: cấm ghi trong suốt transaction.
  set local transaction_read_only = on;

  -- Câu lệnh nặng (quét cả bảng, join nhầm) bị cắt sau 15 giây thay vì treo
  -- server. Người dùng nhận lỗi "canceling statement due to statement timeout".
  set local statement_timeout = '15s';

  -- Lớp 2: bọc trong subquery + chặn trần số dòng.
  -- json_agg trả về NULL khi không có dòng nào, nên phải coalesce về mảng rỗng.
  execute format(
    'select coalesce(json_agg(t), ''[]''::json) from (select * from (%s) sub limit %s) t',
    cau_lenh,
    gioi_han
  )
  into ket_qua;

  return ket_qua;
end;
$$;


-- ----------------------------------------------------------------------------
-- BƯỚC 2 — Chỉ service_role được gọi. BẮT BUỘC, ĐỪNG BỎ QUA.
--
-- Khóa anon nằm công khai trong bundle trình duyệt (NEXT_PUBLIC_*). Không thu
-- hồi quyền thì bất kỳ ai lấy khóa đó từ trang web đều gọi thẳng được
-- POST /rest/v1/rpc/chay_truy_van và đọc sạch mọi bảng, không cần đăng nhập,
-- không bị RLS chặn.
--
-- Sau khi thu hồi, đường vào duy nhất là /api/runSql — route đó gọi requireUser()
-- trước, nên phải đăng nhập và đã được duyệt mới chạy được.
-- ----------------------------------------------------------------------------

revoke all on function public.chay_truy_van(text, integer) from public;
revoke all on function public.chay_truy_van(text, integer) from anon, authenticated;
grant execute on function public.chay_truy_van(text, integer) to service_role;


-- ============================================================================
-- KIỂM TRA SAU KHI CHẠY — bôi đen từng dòng rồi Run
-- ============================================================================

-- 1. Đọc được (phải ra dữ liệu):
--    select public.chay_truy_van('select "HOTEN","CCCD" from population', 5);

-- 2. Đếm được:
--    select public.chay_truy_van('select count(*) as tong from population');

-- 3. Ghi phải HỎNG — kỳ vọng lỗi cú pháp, KHÔNG được trả về dữ liệu:
--    select public.chay_truy_van('delete from population');
--    → ERROR: syntax error at or near "delete"

-- 4. CTE ghi cũng phải HỎNG:
--    select public.chay_truy_van('with x as (delete from population returning *) select * from x');
--    → ERROR: WITH clause containing a data-modifying statement must be at the top level

-- 5. Lớp read-only có bật thật không (phải trả về "on"):
--    select public.chay_truy_van('select current_setting(''transaction_read_only'') as ro');

-- 6. Quyền đã thu hồi đúng chưa (cột anon/authenticated phải là false):
--    select
--      has_function_privilege('anon',          'public.chay_truy_van(text,integer)', 'execute') as anon,
--      has_function_privilege('authenticated', 'public.chay_truy_van(text,integer)', 'execute') as authenticated,
--      has_function_privilege('service_role',  'public.chay_truy_van(text,integer)', 'execute') as service_role;


-- ============================================================================
-- GỠ BỎ (nếu muốn xóa hẳn màn hình này)
-- ============================================================================
--    drop function if exists public.chay_truy_van(text, integer);
