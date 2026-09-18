"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Hai bảng thống kê được, gộp chung một màn hình — đổi bằng nút ở đầu trang.
const BANG = {
  population: { nhan: "Dân số", accent: "#4f46e5" },
  crime: { nhan: "Đối tượng", accent: "#ef4444" },
};

// Ô phân loại (cột boolean) của từng bảng.
const FLAG_LABELS = {
  population: {
    CRIMINALRECORD: "Tiền án/tiền sự",
  },
  crime: {
    ANNINH: "An ninh",
    MATUY: "Ma túy",
    TUTHA: "Tù tha",
    THACD: "THA CĐ",
    TIENSU: "Tiền sự",
    TREHU: "Trẻ em hư",
  },
};

// Ô gõ chữ — khớp kiểu "có chứa", gõ một phần cũng ra.
const O_CHU = {
  population: [
    { key: "DANTOC", label: "Dân tộc", ph: "VD: KINH" },
    { key: "TONGIAO", label: "Tôn giáo", ph: "VD: PHẬT GIÁO" },
    { key: "NOITHTRU", label: "Địa chỉ", ph: "VD: THÔN 3" },
  ],
  crime: [
    { key: "DANTOC", label: "Dân tộc", ph: "VD: KINH" },
    { key: "TONGIAO", label: "Tôn giáo", ph: "VD: PHẬT GIÁO" },
    { key: "NOITHTRU", label: "Địa chỉ", ph: "VD: THÔN 3" },
    { key: "CHARGE", label: "Tội danh", ph: "VD: TRỘM CẮP TÀI SẢN" },
    { key: "DETENTION", label: "Nơi chấp hành", ph: "VD: TRẠI GIAM XUÂN LỘC" },
    { key: "DAYARRES", label: "Ngày bắt", ph: "VD: 2020 hoặc 05/2020" },
    { key: "FREEDAY", label: "Ngày thả", ph: "VD: 2023 hoặc 12/05/2023" },
  ],
};

// Ô chọn khoảng ngày.
const O_NGAY = {
  population: [{ key: "NAMSINH", label: "Ngày sinh" }],
  crime: [{ key: "NAMSINH", label: "Ngày sinh" }],
};

const card = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};

const s = {
  page: {
    backgroundColor: "#f5f6fa",
    minHeight: "100vh",
    padding: 30,
    color: "#333",
  },
  wrap: { maxWidth: 900, margin: "0 auto" },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    fontFamily: "Segoe UI",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 20,
  },
  tabs: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  label: {
    fontWeight: 600,
    color: "#334155",
    display: "block",
    margin: "16px 0 8px",
  },
  labelNho: {
    fontWeight: 600,
    fontSize: 13,
    color: "#334155",
    display: "block",
    marginBottom: 6,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 150,
    padding: 10,
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#333",
  },
  hint: {
    textAlign: "center",
    color: "#868e96",
    marginTop: 28,
    fontStyle: "italic",
  },
  note: { fontSize: 13, color: "#6c757d", marginTop: 8 },
  cardRow: { display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" },
  statValue: { fontSize: 26, fontWeight: 800 },
  statLabel: { fontSize: 13, color: "#6c757d", marginTop: 2 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#343a40",
    marginBottom: 12,
  },
  breakHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
  },
  breakLabel: {
    fontSize: 13,
    color: "#495057",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  breakCount: {
    fontSize: 13,
    fontWeight: 600,
    color: "#212529",
    whiteSpace: "nowrap",
  },
  barBg: { height: 8, borderRadius: 4, background: "#e9ecef", overflow: "hidden" },
};

function nutStyle(mau, rong) {
  return {
    padding: "11px 20px",
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: mau,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    flex: rong ? 1 : "none",
  };
}

const flagsRong = (table) =>
  Object.fromEntries(Object.keys(FLAG_LABELS[table]).map((k) => [k, false]));

/** Gộp ô của cả hai bảng để giữ được nội dung đã gõ khi đổi qua đổi lại. */
function chuRong() {
  const keys = new Set(
    [...O_CHU.population, ...O_CHU.crime].map((o) => o.key),
  );
  return Object.fromEntries([...keys].map((k) => [k, ""]));
}

function ngayRong() {
  const keys = new Set(
    [...O_NGAY.population, ...O_NGAY.crime].map((o) => o.key),
  );
  return Object.fromEntries([...keys].map((k) => [k, { from: "", to: "" }]));
}

/** "2001-05-09" → "09/05/2001", để câu tóm tắt đọc thuận mắt người Việt. */
function ngayVN(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Câu mô tả một khoảng ngày đã chọn, rỗng khi để trống cả hai ô. */
function moTaKhoangNgay(label, tu, den) {
  if (tu && den) return `${label} từ ${ngayVN(tu)} đến ${ngayVN(den)}`;
  if (tu) return `${label} từ ${ngayVN(tu)} trở đi`;
  if (den) return `${label} đến hết ${ngayVN(den)}`;
  return "";
}

/**
 * Màn hình thống kê theo điều kiện, gộp cả hai bảng vào một trang:
 *  - Dân số (population): giới tính, khoảng ngày sinh, vắng nhà, dân tộc,
 *    tôn giáo, địa chỉ, tiền án
 *  - Đối tượng (crime): thêm tội danh, nơi chấp hành, khoảng ngày bắt, khoảng
 *    ngày thả và các phân loại ANNINH / MATUY / TUTHA / THACD / TIENSU / TREHU
 *
 * Nút ở đầu trang đổi bảng; đổi bảng thì xoá kết quả cũ vì hai bảng không cùng
 * bộ điều kiện, để lại số liệu cũ là mời người dùng đọc nhầm. Nội dung đã gõ
 * vẫn giữ nguyên, nhưng chỉ ô nào đang hiện mới được tính vào điều kiện.
 *
 * Việc gộp số nằm ở /api/statistics chứ không làm ở đây: một điều kiện rộng có
 * thể khớp vài chục nghìn dòng, kéo hết về trình duyệt rồi mới đếm là vô ích.
 */
function Statistics() {
  const searchParams = useSearchParams();

  // Bảng mở đầu: cho phép /statistics?table=crime để giữ được link cũ.
  const [table, setTable] = useState(() =>
    searchParams.get("table") === "crime" ? "crime" : "population",
  );
  const accent = BANG[table].accent;
  const flagLabels = FLAG_LABELS[table];
  const oChu = O_CHU[table];
  const oNgay = O_NGAY[table];

  // ===== Điều kiện lọc =====
  const [gender, setGender] = useState("all"); // all | nam | nu
  const [vang, setVang] = useState("all"); // all | vang | khong
  const [text, setText] = useState(chuRong); // { DANTOC: '...', ... }
  const [dates, setDates] = useState(ngayRong); // { NAMSINH: {from,to}, ... }
  const [flags, setFlags] = useState(() => flagsRong(table));

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  // Điều kiện lúc bấm "Thống kê" — dòng tóm tắt phải mô tả ĐÚNG số đang hiện,
  // không phải mấy ô người dùng vừa sửa sau đó.
  const [daChay, setDaChay] = useState(null);

  // Chỉ ô của bảng đang xem mới tính là điều kiện.
  const chuDangDung = () =>
    oChu.map((o) => [o.key, text[o.key].trim()]).filter(([, v]) => v !== "");
  const ngayDangDung = () =>
    oNgay
      .map((o) => [o.key, dates[o.key]])
      .filter(([, k]) => k.from !== "" || k.to !== "");

  const coDieuKien =
    gender !== "all" ||
    vang !== "all" ||
    chuDangDung().length > 0 ||
    ngayDangDung().length > 0 ||
    Object.values(flags).some(Boolean);

  function doiBang(moi) {
    if (moi === table) return;
    setTable(moi);
    setFlags(flagsRong(moi)); // cột phân loại của hai bảng khác nhau
    setStats(null);
  }

  function datChu(key, value) {
    setText((prev) => ({ ...prev, [key]: value }));
  }

  function datNgay(key, phia, value) {
    setDates((prev) => ({ ...prev, [key]: { ...prev[key], [phia]: value } }));
  }

  async function compute() {
    if (!coDieuKien) {
      setStats(null);
      alert("Vui lòng chọn ít nhất một điều kiện thống kê!");
      return;
    }
    for (const [, khoang] of ngayDangDung()) {
      if (khoang.from && khoang.to && khoang.from > khoang.to) {
        alert("Ngày bắt đầu phải trước ngày kết thúc!");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: table,
          gender,
          vang,
          text: Object.fromEntries(
            chuDangDung().map(([k, v]) => [k, v.toUpperCase()]),
          ),
          dates: Object.fromEntries(ngayDangDung()),
          flags,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Không thể kết nối máy chủ");

      setDaChay({
        table,
        moTa: [
          ...chuDangDung().map(([k, v]) => {
            const o = oChu.find((x) => x.key === k);
            return `${o.label}: ${v.toUpperCase()}`;
          }),
          ...ngayDangDung().map(([k, khoang]) => {
            const o = oNgay.find((x) => x.key === k);
            return moTaKhoangNgay(o.label, khoang.from, khoang.to);
          }),
        ],
      });
      setStats(json);
    } catch (e) {
      console.error("Lỗi thống kê:", e);
      alert(e.message || "Đã xảy ra lỗi trong quá trình thống kê!");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setGender("all");
    setVang("all");
    setText(chuRong());
    setDates(ngayRong());
    setFlags(flagsRong(table));
    setStats(null);
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.title}>📊 THỐNG KÊ</div>

        {/* --- Chọn bảng --- */}
        <div style={s.tabs}>
          {Object.keys(BANG).map((key) => {
            const active = key === table;
            return (
              <button
                key={key}
                type="button"
                onClick={() => doiBang(key)}
                style={{
                  padding: "10px 28px",
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${active ? BANG[key].accent : "#ccc"}`,
                  backgroundColor: active ? BANG[key].accent : "#fff",
                  color: active ? "#fff" : "#495057",
                }}
              >
                {BANG[key].nhan}
              </button>
            );
          })}
        </div>

        {/* --- Bảng điều kiện --- */}
        <div style={card}>
          <label style={{ ...s.label, marginTop: 0 }}>Giới tính</label>
          <SegRow
            value={gender}
            onChange={setGender}
            accent={accent}
            options={[
              { key: "all", label: "Tất cả" },
              { key: "nam", label: "Nam" },
              { key: "nu", label: "Nữ" },
            ]}
          />

          <label style={s.label}>Vắng nhà</label>
          <SegRow
            value={vang}
            onChange={setVang}
            accent={accent}
            options={[
              { key: "all", label: "Tất cả" },
              { key: "vang", label: "Vắng" },
              { key: "khong", label: "Không" },
            ]}
          />

          {/* Ô gõ chữ: dân tộc, tôn giáo, địa chỉ (+ tội danh, nơi chấp hành) */}
          <label style={s.label}>Thông tin</label>
          <div style={s.row}>
            {oChu.map((o) => (
              <div key={o.key} style={{ flex: 1, minWidth: 220 }}>
                <label style={s.labelNho}>{o.label}</label>
                <input
                  style={{ ...s.input, width: "100%", textTransform: "uppercase" }}
                  value={text[o.key]}
                  onChange={(e) => datChu(o.key, e.target.value)}
                  placeholder={o.ph}
                  onKeyDown={(e) => e.key === "Enter" && compute()}
                />
              </div>
            ))}
          </div>
          <div style={s.note}>
            Gõ một phần cũng ra: &quot;THÔN 3&quot; khớp mọi địa chỉ có chứa
            &quot;THÔN 3&quot;, ô ngày gõ &quot;2020&quot; là ra cả năm 2020. Bỏ
            trống là không lọc theo ô đó.
          </div>

          {/* Khoảng ngày: ngày sinh (+ ngày bắt, ngày thả) */}
          {oNgay.map((o) => (
            <div key={o.key}>
              <label style={s.label}>{o.label} từ ngày — đến ngày</label>
              <div style={s.row}>
                <input
                  type="date"
                  style={s.input}
                  value={dates[o.key].from}
                  max={dates[o.key].to || undefined}
                  onChange={(e) => datNgay(o.key, "from", e.target.value)}
                />
                <input
                  type="date"
                  style={s.input}
                  value={dates[o.key].to}
                  min={dates[o.key].from || undefined}
                  onChange={(e) => datNgay(o.key, "to", e.target.value)}
                />
              </div>
            </div>
          ))}
          <div style={s.note}>
            Chỉ điền một ô cũng được: bỏ trống ô đầu là tính từ người sinh sớm
            nhất, bỏ trống ô sau là tính đến người sinh muộn nhất. Dòng chỉ ghi
            được năm sinh (ví dụ 00/00/1985) được tính theo năm.
          </div>

          <label style={s.label}>
            {table === "crime" ? "Phân loại đối tượng" : "Phân loại"}
          </label>
          <div style={{ ...s.row, gap: 8 }}>
            {Object.keys(flagLabels).map((field) => {
              const on = flags[field];
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() =>
                    setFlags((prev) => ({ ...prev, [field]: !prev[field] }))
                  }
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 16,
                    cursor: "pointer",
                    border: `1px solid ${on ? accent : "#ccc"}`,
                    backgroundColor: on ? accent : "#fafafa",
                    color: on ? "#fff" : "#495057",
                  }}
                >
                  {on ? "✓ " : ""}
                  {flagLabels[field]}
                </button>
              );
            })}
          </div>
          <div style={s.note}>
            Mọi điều kiện đều nối VÀ: bật nhiều ô phân loại là chỉ tính người
            thuộc ĐỦ các nhóm đã chọn.
          </div>

          <div style={{ ...s.row, marginTop: 20 }}>
            <button
              style={nutStyle(loading ? "#707171" : accent, true)}
              onClick={compute}
              disabled={loading}
            >
              {loading ? "Đang thống kê…" : "📊 Thống kê"}
            </button>
            <button style={nutStyle("#6c757d")} onClick={reset}>
              Xóa điều kiện
            </button>
          </div>
        </div>

        {/* --- Kết quả --- */}
        {loading ? (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <div className="spinner" />
            <div>Đang tải dữ liệu...</div>
          </div>
        ) : stats === null ? (
          <div style={s.hint}>
            Chọn điều kiện phía trên rồi bấm &quot;Thống kê&quot; để xem kết quả.
          </div>
        ) : stats.total === 0 ? (
          <div style={s.hint}>Không có dữ liệu phù hợp điều kiện.</div>
        ) : (
          <>
            <div style={{ ...s.note, marginTop: 20, textAlign: "center" }}>
              Kết quả bảng <b>{BANG[daChay.table].nhan}</b>
              {daChay.moTa.length > 0 && ` · ${daChay.moTa.join(" · ")}`}
            </div>

            {stats.chamTran && (
              <div style={{ ...s.hint, color: "#b45309" }}>
                Đã chạm trần 500.000 dòng — thu hẹp điều kiện để số liệu chính
                xác.
              </div>
            )}

            <div style={s.cardRow}>
              <StatCard label="Tổng số" value={stats.total} color={accent} />
              {daChay.table === "population" && (
                <StatCard label="Số hộ" value={stats.soHo} color="#0d6efd" />
              )}
              <StatCard label="Vắng nhà" value={stats.vangNha} color="#dc3545" />
            </div>

            <div style={s.cardRow}>
              <StatCard label="Nam" value={stats.nam} color="#0d6efd" />
              <StatCard label="Nữ" value={stats.nu} color="#d63384" />
            </div>

            <Breakdown
              title="Theo phân loại"
              data={stats.byLoai}
              total={stats.total}
              accent={accent}
            />
            <Breakdown
              title="Theo dân tộc"
              data={stats.byDanToc}
              total={stats.total}
              accent={accent}
            />
            <Breakdown
              title="Theo tôn giáo"
              data={stats.byTonGiao}
              total={stats.total}
              accent={accent}
            />

            {stats.coDongChiBietNam && (
              <div style={{ ...s.note, marginTop: 14 }}>
                Trong kết quả có dòng chỉ ghi được năm, không có ngày/tháng —
                những dòng đó được tính theo năm.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SegRow({ value, onChange, options, accent }) {
  return (
    <div style={s.row}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              minWidth: 90,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${active ? accent : "#ccc"}`,
              backgroundColor: active ? accent : "#fafafa",
              color: active ? "#fff" : "#495057",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{ ...card, flex: 1, minWidth: 140, borderLeft: `4px solid ${color}` }}
    >
      <div style={{ ...s.statValue, color }}>
        {Number(value || 0).toLocaleString("vi-VN")}
      </div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function Breakdown({ title, data, total, accent }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ ...card, marginTop: 14 }}>
      <div style={s.sectionTitle}>{title}</div>
      {data.map(([label, count]) => {
        const percent = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={s.breakHeader}>
              <span style={s.breakLabel} title={label}>
                {label}
              </span>
              <span style={s.breakCount}>
                {count.toLocaleString("vi-VN")} ({percent}%)
              </span>
            </div>
            <div style={s.barBg}>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: `${percent}%`,
                  background: accent,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Page() {
  // useSearchParams cần ranh giới Suspense, nếu không `next build` sẽ chết ở
  // bước prerender trang này.
  return (
    <Suspense fallback={<div style={s.page} />}>
      <Statistics />
    </Suspense>
  );
}
