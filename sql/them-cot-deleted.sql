-- ============================================================================
-- CỘT "DELETED" — ghi nhận nhân khẩu đã bị xóa (xóa mềm)
--
-- Chạy MỘT LẦN trong Supabase → SQL Editor, cho MỖI dự án (population và
-- hanggon là hai project riêng, phải chạy ở cả hai).
--
-- Từ nay nút "Xóa" ở trang dân cư KHÔNG xóa dòng khỏi bảng nữa mà chỉ bật
-- DELETED = true. Nhân khẩu vẫn tìm thấy, hiện nền xám trên web lẫn app, và
-- khôi phục được. Thống kê và xuất sổ hộ bỏ qua các dòng này.
--
-- Chưa chạy file này mà đã dùng bản web mới thì bấm "Xóa" sẽ báo lỗi
-- `column population.DELETED does not exist` — không mất dữ liệu.
-- ============================================================================

alter table public.population
  add column if not exists "DELETED" boolean not null default false;

-- PostgREST lưu bộ nhớ đệm lược đồ — bảo nó đọc lại để thấy cột mới ngay.
notify pgrst, 'reload schema';
