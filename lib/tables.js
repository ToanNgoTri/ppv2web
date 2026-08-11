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
