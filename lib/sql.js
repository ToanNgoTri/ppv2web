/**
 * Kiểm câu lệnh SQL do người dùng dán vào màn hình /sql.
 *
 * ĐÂY LÀ LỚP CHẶN THỨ NHẤT, KHÔNG PHẢI LỚP DUY NHẤT. Chặn thật nằm ở Postgres:
 * hàm public.chay_truy_van (xem sql/truy-van-sql.sql) bật transaction_read_only
 * cho cả transaction, lại còn bọc câu lệnh vào trong `select ... from (<câu
 * lệnh>) t` — DELETE/UPDATE/INSERT nhét vào đó là lỗi cú pháp, không phải "chạy
 * nhưng bị từ chối".
 *
 * Lớp này tồn tại để báo lỗi tiếng Việt dễ hiểu NGAY trên giao diện, thay vì để
 * người dùng nhận một dòng lỗi cú pháp Postgres khó đoán.
 */

/** Số dòng tối đa trả về nếu client không nói gì. */
export const GIOI_HAN_MAC_DINH = 1000

/** Trần cứng — client gửi số lớn hơn cũng bị kẹp về đây. */
export const GIOI_HAN_TOI_DA = 5000

const TU_KHOA_CAM = [
  'insert', 'update', 'delete', 'merge', 'truncate',
  'drop', 'alter', 'create', 'comment', 'rename',
  'grant', 'revoke', 'copy', 'call', 'do',
  'vacuum', 'analyze', 'reindex', 'cluster', 'refresh',
  'begin', 'commit', 'rollback', 'savepoint', 'set', 'reset',
  'listen', 'notify', 'lock', 'prepare', 'execute', 'discard',
]

/**
 * Che mọi chuỗi, tên trong nháy kép và chú thích thành khoảng trắng.
 *
 * Phải quét bằng vòng lặp chứ không thay bằng regex: thứ tự xử lý giữa chuỗi và
 * chú thích không cố định. `where "GHICHU" = 'a--b'` mà bóc chú thích trước thì
 * mất nửa chuỗi; `-- ghi chú có dấu '` mà bóc chuỗi trước thì lệch nháy. Quét
 * một lượt từ trái sang phải thì cả hai trường hợp đều đúng.
 *
 * Giữ nguyên độ dài để vị trí ký tự không lệch, tiện soi lỗi sau này.
 */
export function cheChuoiVaChuThich(sql) {
  const n = sql.length
  const out = new Array(n)
  let i = 0

  const giu = (tu, den) => { for (let k = tu; k < den; k++) out[k] = sql[k] }
  const xoa = (tu, den) => {
    for (let k = tu; k < den; k++) out[k] = sql[k] === '\n' ? '\n' : ' '
  }

  while (i < n) {
    const c = sql[i]
    const hai = sql.slice(i, i + 2)

    // chú thích một dòng: -- tới hết dòng
    if (hai === '--') {
      let j = sql.indexOf('\n', i)
      if (j === -1) j = n
      xoa(i, j)
      i = j
      continue
    }

    // chú thích khối: /* ... */ , Postgres cho lồng nhau
    if (hai === '/*') {
      let sau = 1
      let j = i + 2
      while (j < n && sau > 0) {
        if (sql.slice(j, j + 2) === '/*') { sau++; j += 2 }
        else if (sql.slice(j, j + 2) === '*/') { sau--; j += 2 }
        else j++
      }
      xoa(i, j)
      i = j
      continue
    }

    // chuỗi thường: '...' , hai nháy liền là một nháy trong chuỗi
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") j += 2
          else { j++; break }
        } else j++
      }
      xoa(i, j)
      i = j
      continue
    }

    // tên cột/bảng trong nháy kép: "CCCD" — che luôn để tên cột trùng từ khóa
    // (ví dụ một cột tên "UPDATE") không bị báo nhầm là câu lệnh ghi
    if (c === '"') {
      let j = i + 1
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') j += 2
          else { j++; break }
        } else j++
      }
      xoa(i, j)
      i = j
      continue
    }

    // chuỗi kiểu $$ ... $$ hoặc $tag$ ... $tag$
    const mo = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))
    if (mo) {
      const the = mo[0]
      const j = sql.indexOf(the, i + the.length)
      const het = j === -1 ? n : j + the.length
      xoa(i, het)
      i = het
      continue
    }

    giu(i, i + 1)
    i++
  }

  return out.join('')
}

/**
 * Bỏ chú thích, khoảng trắng thừa và dấu ; ở cuối.
 * Trả về đúng chuỗi sẽ được nhét vào hàm Postgres.
 */
export function donCauLenh(sql) {
  return String(sql ?? '').trim().replace(/;+\s*$/, '').trim()
}

/**
 * @param {string} sql câu lệnh thô người dùng dán vào
 * @returns {string|null} null nghĩa là hợp lệ, ngược lại là thông báo lỗi
 */
export function kiemTraChiDoc(sql) {
  const cauLenh = donCauLenh(sql)
  if (!cauLenh) return 'Chưa nhập câu lệnh'

  const che = cheChuoiVaChuThich(cauLenh)

  // Không còn gì sau khi bỏ chú thích
  if (!che.trim()) return 'Câu lệnh chỉ có chú thích, chưa có lệnh nào'

  // Một câu lệnh mỗi lần. Dấu ; ở giữa là dấu hiệu ghép nhiều lệnh — kiểu
  // `select 1; delete from population` — chặn ngay cho rõ ràng.
  if (che.includes(';')) {
    return 'Chỉ chạy được MỘT câu lệnh mỗi lần. Bỏ dấu ; ở giữa câu.'
  }

  if (!/^\s*(select|with|table|values)\b/i.test(che)) {
    const dau = che.trim().split(/\s+/)[0] || ''
    return `Chỉ cho phép câu lệnh đọc (SELECT / WITH). Câu này bắt đầu bằng "${dau.toUpperCase()}".`
  }

  for (const tu of TU_KHOA_CAM) {
    // \b không dùng được cho mọi trường hợp vì tên cột có gạch dưới, nên bắt
    // theo ranh giới ký tự định danh của Postgres.
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${tu}([^A-Za-z0-9_$]|$)`, 'i')
    if (re.test(che)) {
      return `Không cho phép từ khóa ${tu.toUpperCase()} — màn hình này chỉ đọc dữ liệu, không sửa/xóa.`
    }
  }

  return null
}

/** Kẹp số dòng tối đa client xin về trong khoảng cho phép. */
export function kepGioiHan(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return GIOI_HAN_MAC_DINH
  return Math.min(Math.floor(n), GIOI_HAN_TOI_DA)
}
