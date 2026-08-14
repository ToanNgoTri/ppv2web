-- ============================================================================
-- TỰ KIỂM MÀN HÌNH TRUY VẤN SQL
--
-- Chạy SAU khi đã chạy sql/truy-van-sql.sql, ở mỗi dự án.
-- Dán cả file này vào Supabase → SQL Editor → Run, rồi chạy:
--
--     select * from public.kiem_tra_truy_van();
--
-- Cột `dat` phải TRUE hết. Chỗ nào false thì cột `ket_qua` nói rõ vì sao.
-- ============================================================================

create or replace function public.kiem_tra_truy_van()
returns table (muc text, ket_qua text, dat boolean)
language plpgsql
as $kt$
declare
  v text;
  j json;
begin
  ---------------------------------------------------------------- 1
  select case p.provolatile
           when 'v' then 'volatile'
           when 's' then 'stable'
           when 'i' then 'immutable'
         end
    into v
    from pg_proc p
   where p.proname = 'chay_truy_van'
     and p.pronamespace = 'public'::regnamespace;

  muc := '1. Hàm tồn tại và là volatile';
  ket_qua := coalesce(v, '✗ KHÔNG TÌM THẤY HÀM — chưa chạy sql/truy-van-sql.sql');
  dat := (v = 'volatile');
  if v = 'stable' then
    ket_qua := '✗ đang là stable — bạn dán nhầm BẢN CŨ. Postgres cấm SET trong hàm stable';
  end if;
  return next;

  ---------------------------------------------------------------- 2
  begin
    j := public.chay_truy_van('select 1 as x');
    muc := '2. SELECT chạy được';
    ket_qua := j::text;
    dat := (j -> 0 ->> 'x' = '1');
  exception when others then
    muc := '2. SELECT chạy được';
    ket_qua := '✗ LỖI: ' || sqlerrm;
    dat := false;
  end;
  return next;

  ---------------------------------------------------------------- 3
  begin
    j := public.chay_truy_van('select current_setting(''transaction_read_only'') as ro');
    muc := '3. Khoá ghi (transaction_read_only) đang BẬT';
    ket_qua := coalesce(j -> 0 ->> 'ro', 'null');
    dat := (j -> 0 ->> 'ro' = 'on');
  exception when others then
    muc := '3. Khoá ghi (transaction_read_only) đang BẬT';
    ket_qua := '✗ LỖI: ' || sqlerrm;
    dat := false;
  end;
  return next;

  ---------------------------------------------------------------- 4
  begin
    j := public.chay_truy_van('select current_setting(''statement_timeout'') as t');
    muc := '4. Cắt câu lệnh chạy quá lâu';
    ket_qua := coalesce(j -> 0 ->> 't', 'null');
    dat := (j -> 0 ->> 't' = '15s');
  exception when others then
    muc := '4. Cắt câu lệnh chạy quá lâu';
    ket_qua := '✗ LỖI: ' || sqlerrm;
    dat := false;
  end;
  return next;

  ---------------------------------------------------------------- 5
  begin
    j := public.chay_truy_van('delete from population');
    muc := '5. DELETE bị chặn';
    ket_qua := '✗ NGUY HIỂM: câu lệnh xoá KHÔNG bị chặn';
    dat := false;
  exception when others then
    muc := '5. DELETE bị chặn';
    ket_qua := 'bị từ chối: ' || left(sqlerrm, 60);
    dat := true;
  end;
  return next;

  ---------------------------------------------------------------- 6
  begin
    j := public.chay_truy_van('with x as (delete from population returning *) select * from x');
    muc := '6. CTE ghi dữ liệu bị chặn';
    ket_qua := '✗ NGUY HIỂM: CTE xoá KHÔNG bị chặn';
    dat := false;
  exception when others then
    muc := '6. CTE ghi dữ liệu bị chặn';
    ket_qua := 'bị từ chối: ' || left(sqlerrm, 60);
    dat := true;
  end;
  return next;

  ---------------------------------------------------------------- 7
  begin
    j := public.chay_truy_van('select generate_series(1, 100) as n', 3);
    muc := '7. Chặn trần số dòng trả về';
    ket_qua := 'xin 3 dòng, nhận ' || json_array_length(j) || ' dòng';
    dat := (json_array_length(j) = 3);
  exception when others then
    muc := '7. Chặn trần số dòng trả về';
    ket_qua := '✗ LỖI: ' || sqlerrm;
    dat := false;
  end;
  return next;

  ---------------------------------------------------------------- 8
  muc := '8. anon KHÔNG gọi được hàm';
  dat := not has_function_privilege('anon', 'public.chay_truy_van(text,integer)', 'execute');
  ket_qua := case when dat then 'đã thu hồi quyền'
                  else '✗ NGUY HIỂM: khoá anon công khai trong bundle trình duyệt, ai cũng đọc được database' end;
  return next;

  ---------------------------------------------------------------- 9
  muc := '9. authenticated KHÔNG gọi được hàm';
  dat := not has_function_privilege('authenticated', 'public.chay_truy_van(text,integer)', 'execute');
  ket_qua := case when dat then 'đã thu hồi quyền' else '✗ chưa chạy phần revoke' end;
  return next;

  ---------------------------------------------------------------- 10
  muc := '10. service_role gọi được hàm';
  dat := has_function_privilege('service_role', 'public.chay_truy_van(text,integer)', 'execute');
  ket_qua := case when dat then 'có quyền' else '✗ chưa chạy phần grant — màn hình /sql sẽ không chạy được' end;
  return next;

  ---------------------------------------------------------------- 11
  begin
    j := public.chay_truy_van('select count(*) as tong from population');
    muc := '11. Đọc được bảng population';
    ket_qua := (j -> 0 ->> 'tong') || ' dòng';
    dat := true;
  exception when others then
    muc := '11. Đọc được bảng population';
    ket_qua := '✗ LỖI: ' || sqlerrm;
    dat := false;
  end;
  return next;
end;
$kt$;


-- Chạy dòng này để xem kết quả:
select * from public.kiem_tra_truy_van();


-- Dọn dẹp khi không cần nữa (không bắt buộc):
--   drop function if exists public.kiem_tra_truy_van();
