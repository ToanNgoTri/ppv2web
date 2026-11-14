-- ============================================================================
-- HÀM "luu_khuon_mat" — app ppv2 ghi khuôn mặt của ảnh đối tượng vừa tải lên
--
-- Chạy trong Supabase → SQL Editor của dự án HANGGON, SAU tao-bang-khuon-mat.sql.
-- Chạy lại cũng không sao.
--
-- Điện thoại tự tính vector (model buffalo_s trong APK) rồi gọi hàm này. Hàm
-- xoá các dòng cũ của ảnh subject/<CCCD>.jpg và ghi các mặt mới.
--
-- security definer vì bảng khuon_mat không cho người dùng ghi trực tiếp; bên
-- trong tự kiểm tra duoc_duyet() — tài khoản chưa duyệt gọi sẽ bị từ chối.
-- Chỉ ghi được cho CCCD có trong bảng crime, nên không chèn rác vào kho được.
-- ============================================================================

create or replace function public.luu_khuon_mat(
  p_cccd text,
  p_mat  jsonb          -- [{ "khung": [x1,y1,x2,y2], "diem": 0.87, "vector": "[...512 số...]" }, ...]
)
returns integer         -- số mặt đã ghi
language plpgsql
security definer
set search_path = public, extensions
as $$
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
  if not exists (select 1 from public.crime c where c."CCCD" = p_cccd) then
    raise exception 'Không có đối tượng với CCCD %', p_cccd;
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
