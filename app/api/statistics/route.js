import { createClient } from "@supabase/supabase-js";
import { checkTable, laCotBoolean } from "../../../lib/tables";
import { requireUser } from "../../../lib/auth";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // chỉ dùng server
);

// Cột cần đọc để dựng được mọi con số của màn hình thống kê. Chỉ lấy đúng
// những cột này chứ không `select('*')`: thống kê hay quét vài chục nghìn dòng,
// kéo thêm ĐỊA CHỈ/GHI CHÚ chỉ tổ nặng đường truyền.
const COT_THONG_KE = {
  population: [
    "GIOITINH", "VANGNHA", "DANTOC", "TONGIAO", "NAMSINH", "SOHOK",
    "CRIMINALRECORD",
  ],
  crime: [
    "GIOITINH", "VANGNHA", "DANTOC", "TONGIAO", "NAMSINH", "SOHOK",
    "ANNINH", "MATUY", "TUTHA", "THACD", "TIENSU", "TREHU",
  ],
};

/**
 * Cột lọc bằng ô gõ chữ — khớp kiểu "có chứa" (ilike) như bên trang tìm kiếm,
 * để gõ "KINH" ra được cả "KINH" lẫn các cách ghi dài hơn.
 */
const COT_CHU = {
  population: ["DANTOC", "TONGIAO", "NOITHTRU"],
  crime: [
    "DANTOC", "TONGIAO", "NOITHTRU", "CHARGE", "DETENTION",
    // NGÀY BẮT / NGÀY THẢ cũng là ô gõ chữ: chúng là chuỗi "dd/mm/yyyy" nên gõ
    // "2020" ra cả năm, "05/2020" ra cả tháng — tiện hơn bắt chọn đủ khoảng.
    "DAYARRES", "FREEDAY",
  ],
};

/**
 * Cột lọc theo khoảng ngày. Là CHUỖI "dd/mm/yyyy" trong CSDL chứ không phải
 * kiểu date, nên phải đọc ra rồi so ở bộ nhớ (xem docNgay).
 */
const COT_NGAY = {
  population: ["NAMSINH"],
  crime: ["NAMSINH"],
};

// Nhãn tiếng Việt của các cột phân loại, dùng cho mục "Theo phân loại".
const NHAN_PHAN_LOAI = {
  ANNINH: "An ninh",
  MATUY: "Ma túy",
  TUTHA: "Tù tha",
  THACD: "THA CĐ",
  TIENSU: "Tiền sự",
  TREHU: "Trẻ em hư",
  CRIMINALRECORD: "Tiền án/tiền sự",
};

// PostgREST trả tối đa 1000 dòng một lần gọi, nên phải phân trang mới lấy đủ.
const PAGE = 1000;
// Trần an toàn: thống kê không bao giờ nên quét quá số này, tránh một điều kiện
// quá rộng làm route chạy mãi không dừng.
const TRAN_DONG = 500000;

/**
 * Ngày người dùng chọn (ô <input type="date"> luôn gửi "yyyy-mm-dd") → số
 * yyyymmdd để so sánh bằng phép so số, khỏi dính múi giờ của Date.
 */
function soNgayISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return null;
  return Number(m[1] + m[2] + m[3]);
}

/**
 * Đọc một cột ngày trong CSDL (NAMSINH, DAYARRES, FREEDAY). Các cột này là
 * CHUỖI do người dùng gõ nên có đủ kiểu: "09/05/2001", "9-5-2001",
 * "00/00/1985" (chỉ nhớ năm), hoặc trống.
 *
 * @returns {{ngay: number|null, nam: number|null}} ngay = yyyymmdd khi đọc được
 *          đủ ngày/tháng/năm; nam = năm khi ít nhất đọc được năm.
 */
function docNgay(giaTri) {
  const s = String(giaTri ?? "").trim();

  const m = /^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})$/.exec(s);
  if (m) {
    const ngay = Number(m[1]);
    const thang = Number(m[2]);
    const nam = Number(m[3]);
    if (ngay >= 1 && ngay <= 31 && thang >= 1 && thang <= 12) {
      return { ngay: nam * 10000 + thang * 100 + ngay, nam };
    }
    // Dạng "00/00/1985" — ngày tháng vô nghĩa nhưng năm vẫn dùng được.
    return { ngay: null, nam };
  }

  const chiNam = /(\d{4})\s*$/.exec(s);
  return { ngay: null, nam: chiNam ? Number(chiNam[1]) : null };
}

function gopTheo(rows, key) {
  const map = {};
  for (const r of rows) {
    const raw = r[key];
    const label =
      raw === null || raw === undefined || raw === "" ? "Không rõ" : String(raw);
    map[label] = (map[label] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export async function POST(req) {
  // Route dùng khóa service-role (bỏ qua Row Level Security) nên đây là chỗ
  // duy nhất kiểm soát quyền — y như /api/searchData.
  const { response: chuaDangNhap } = await requireUser();
  if (chuaDangNhap) return chuaDangNhap;

  try {
    const body = await req.json();
    const {
      database,
      gender = "all", // all | nam | nu
      vang = "all", // all | vang | khong
      text = {}, // { DANTOC: 'KINH', CHARGE: 'TRỘM CẮP', ... }
      dates = {}, // { NAMSINH: { from: 'yyyy-mm-dd', to: '...' }, ... }
      flags = {},
    } = body;

    const { table, response: bangLa } = checkTable(database);
    if (bangLa) return bangLa;

    // ===== Ô phân loại (cột boolean) =====
    const flagsDaBat = [];
    for (const [key, on] of Object.entries(flags || {})) {
      if (!on) continue;
      if (!laCotBoolean(table, key) || !COT_THONG_KE[table].includes(key)) {
        return Response.json(
          { error: `Cột phân loại không hợp lệ: ${String(key)}` },
          { status: 400 },
        );
      }
      flagsDaBat.push(key);
    }

    // ===== Ô gõ chữ =====
    const locChu = [];
    for (const [key, raw] of Object.entries(text || {})) {
      const value = String(raw ?? "").trim();
      if (!value) continue;
      if (!COT_CHU[table].includes(key)) {
        return Response.json(
          { error: `Điều kiện không hợp lệ: ${String(key)}` },
          { status: 400 },
        );
      }
      locChu.push([key, value]);
    }

    // ===== Khoảng ngày =====
    const locNgay = [];
    for (const [key, khoang] of Object.entries(dates || {})) {
      const tuChu = String(khoang?.from ?? "").trim();
      const denChu = String(khoang?.to ?? "").trim();
      if (!tuChu && !denChu) continue;

      if (!COT_NGAY[table].includes(key)) {
        return Response.json(
          { error: `Điều kiện ngày không hợp lệ: ${String(key)}` },
          { status: 400 },
        );
      }

      const tu = soNgayISO(tuChu);
      const den = soNgayISO(denChu);
      if ((tuChu && tu === null) || (denChu && den === null)) {
        return Response.json(
          { error: `Ngày không hợp lệ ở điều kiện ${key}` },
          { status: 400 },
        );
      }
      if (tu !== null && den !== null && tu > den) {
        return Response.json(
          { error: `Ngày bắt đầu phải trước ngày kết thúc (${key})` },
          { status: 400 },
        );
      }

      locNgay.push({ key, tu, den });
    }

    // Bắt buộc có ít nhất một điều kiện: không có thì đây là lệnh quét sạch
    // bảng, vừa nặng vừa không phải cái người dùng định hỏi.
    const coDieuKien =
      gender !== "all" ||
      vang !== "all" ||
      locChu.length > 0 ||
      locNgay.length > 0 ||
      flagsDaBat.length > 0;
    if (!coDieuKien) {
      return Response.json(
        { error: "Vui lòng chọn ít nhất một điều kiện thống kê" },
        { status: 400 },
      );
    }

    // Cột ngày đang lọc phải nằm trong danh sách select, nếu không thì lọc ở
    // bộ nhớ chẳng có gì để đọc. NAMSINH vốn đã có sẵn.
    const cotCanLay = new Set(COT_THONG_KE[table]);
    for (const { key } of locNgay) cotCanLay.add(key);

    const taoQuery = () => {
      let q = supabaseAdmin.from(table).select([...cotCanLay].join(","));
      if (gender !== "all") q = q.eq("GIOITINH", gender === "nam");
      if (vang !== "all") q = q.eq("VANGNHA", vang === "vang");
      // Bật nhiều ô phân loại là nối VÀ: đối tượng phải thuộc ĐỦ các nhóm đã
      // chọn (khác ô phân loại bên trang tìm kiếm — bên đó nối HOẶC).
      for (const field of flagsDaBat) q = q.eq(field, true);
      for (const [key, value] of locChu) q = q.ilike(key, `%${value}%`);

      // Khoảng ngày nằm gọn trong MỘT năm thì lọc bớt luôn ở CSDL cho nhẹ.
      // Không lọc sâu hơn được: cột ngày là chuỗi "dd/mm/yyyy", so sánh SQL
      // trên chuỗi đó ra kết quả sai (chuỗi so theo ngày trước, năm sau).
      for (const { key, tu, den } of locNgay) {
        if (tu === null || den === null) continue;
        const namTu = Math.floor(tu / 10000);
        if (namTu === Math.floor(den / 10000)) q = q.like(key, `%${namTu}`);
      }
      return q;
    };

    let rows = [];
    let chamTran = false;
    for (let offset = 0; offset < TRAN_DONG; offset += PAGE) {
      const { data, error } = await taoQuery().range(offset, offset + PAGE - 1);
      if (error) {
        console.error("Supabase error:", error);
        return Response.json({ error: error.message }, { status: 400 });
      }
      const batch = data || [];
      rows = rows.concat(batch);
      if (batch.length < PAGE) break; // hết dữ liệu
      if (rows.length >= TRAN_DONG) chamTran = true;
    }

    // Lọc khoảng ngày. Dòng chỉ ghi được năm (kiểu "1985" hoặc "00/00/1985")
    // được so ở MỨC NĂM thay vì loại thẳng — loại thì thống kê hụt mất người
    // thật, mà dữ liệu cũ dạng này khá nhiều.
    let coDongChiBietNam = false;
    for (const { key, tu, den } of locNgay) {
      const tuNam = tu === null ? null : Math.floor(tu / 10000);
      const denNam = den === null ? null : Math.floor(den / 10000);

      rows = rows.filter((r) => {
        const { ngay, nam } = docNgay(r[key]);

        if (ngay !== null) {
          if (tu !== null && ngay < tu) return false;
          if (den !== null && ngay > den) return false;
          return true;
        }

        if (nam === null) return false; // không đọc được gì thì không tính
        if (tuNam !== null && nam < tuNam) return false;
        if (denNam !== null && nam > denNam) return false;
        coDongChiBietNam = true;
        return true;
      });
    }

    const total = rows.length;
    const nam = rows.filter((r) => r.GIOITINH === true).length;
    const soHo = new Set(
      rows.map((r) => r.SOHOK).filter((v) => v !== null && v !== undefined && v !== ""),
    ).size;

    // Đếm theo từng cột phân loại của bảng đang xem.
    const cotPhanLoai = COT_THONG_KE[table].filter((c) => c in NHAN_PHAN_LOAI);
    const byLoai = cotPhanLoai.map((field) => [
      NHAN_PHAN_LOAI[field],
      rows.filter((r) => r[field] === true).length,
    ]);

    return Response.json({
      total,
      nam,
      nu: total - nam,
      vangNha: rows.filter((r) => r.VANGNHA === true).length,
      soHo,
      byDanToc: gopTheo(rows, "DANTOC"),
      byTonGiao: gopTheo(rows, "TONGIAO"),
      byLoai,
      chamTran,
      coDongChiBietNam,
    });
  } catch (err) {
    console.error("Server error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
