/**
 * Danh sách bảng được phép thao tác qua API.
 *
 * Trước đây tên bảng lấy thẳng từ `body.database`, cộng với việc route dùng khóa
 * service-role (bỏ qua Row Level Security), nên một request bất kỳ có thể ghi
 * hoặc xóa ở MỌI bảng trong project. Chốt danh sách để tên bảng lạ bị từ chối
 * ngay, không phụ thuộc vào việc client gửi đúng.
 */
export const ALLOWED_TABLES = ['population', 'crime']

/**
 * Kiểm tra tên bảng do client gửi lên.
 * @returns {{table: string|null, response: Response|null}}
 */
export function checkTable(name) {
  if (!ALLOWED_TABLES.includes(name)) {
    return {
      table: null,
      response: Response.json(
        { error: `Bảng không hợp lệ: ${String(name)}` },
        { status: 400 },
      ),
    }
  }
  return { table: name, response: null }
}

/**
 * Cột kiểu boolean của từng bảng.
 *
 * Cần biết để KHÔNG áp `ilike` lên chúng: Postgres không so khớp chuỗi với
 * boolean, câu truy vấn sẽ hỏng chứ không phải "tìm không ra". Các cột phân
 * loại đối tượng (ANNINH/MATUY/TUTHA/THACD/TIENSU) và cờ của dân cư
 * (CRIMINALRECORD) đều thuộc nhóm này.
 */
export const BOOLEAN_COLUMNS = {
  population: ['GIOITINH', 'VANGNHA', 'CRIMINALRECORD'],
  crime: [
    'GIOITINH', 'VANGNHA',
    'ANNINH', 'MATUY', 'TUTHA', 'THACD', 'TIENSU',
  ],
}

export function laCotBoolean(table, column) {
  return (BOOLEAN_COLUMNS[table] || []).includes(column)
}

/**
 * Đổi chữ người dùng gõ ở ô tìm kiếm thành boolean.
 * Mọi cách viết "có thật" đều tính là true, còn lại là false.
 */
export function doiSangBoolean(value) {
  if (typeof value === 'boolean') return value
  const s = String(value ?? '').trim().toUpperCase()
  return ['TRUE', '1', 'NAM', 'CÓ', 'CO', 'VẮNG', 'VANG', 'RỒI', 'ROI'].includes(s)
}

/**
 * Trần số dòng một lần tìm kiếm trả về — cũng là trần một lần gọi của
 * PostgREST. Giao diện hiển thị cảnh báo khi kết quả chạm mức này.
 */
export const GIOI_HAN_KET_QUA = 1000
