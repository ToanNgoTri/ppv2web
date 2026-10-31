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
