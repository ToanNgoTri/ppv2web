"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/** Câu lệnh mẫu — bấm là điền vào ô soạn thảo. */
const MAU = [
  {
    ten: "Tìm nhiều CCCD",
    sql: `select "HOTEN", "NAMSINH", "CCCD", "SOHOK", "NOITHTRU"
from population
where "CCCD" in ('079201001234', '079201005678')`,
  },
  {
    ten: "Đếm theo tổ",
    sql: `select "NOITHTRU", count(*) as so_nguoi
from population
group by "NOITHTRU"
order by so_nguoi desc`,
  },
  {
    ten: "Người có tiền án",
    sql: `select p."HOTEN", p."NAMSINH", p."CCCD", c."CHARGE", c."JUDGMENT"
from population p
join crime c on c."CCCD" = p."CCCD"
order by p."HOTEN"`,
  },
  {
    ten: "CCCD trùng nhau",
    sql: `select "CCCD", count(*) as so_lan
from population
where "CCCD" is not null and "CCCD" <> ''
group by "CCCD"
having count(*) > 1
order by so_lan desc`,
  },
  {
    ten: "Thiếu CCCD",
    sql: `select "HOTEN", "NAMSINH", "SOHOK", "NOITHTRU"
from population
where "CCCD" is null or "CCCD" = ''
order by "SOHOK"`,
  },
];

/** Đổi ô dữ liệu bất kỳ thành chữ để hiện lên bảng. */
function hienGiaTri(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Bọc một ô cho đúng chuẩn CSV. */
function oCsv(v) {
  const s = hienGiaTri(v) ?? "";
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function TruyVanSql() {
  const [sql, setSql] = useState(MAU[0].sql);
  const [gioiHan, setGioiHan] = useState(1000);
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState(null);
  const [danhSach, setDanhSach] = useState("");
  const [hienTroGiup, setHienTroGiup] = useState(false);
  const oSoanThao = useRef(null);

  // Giữ lại câu lệnh giữa các lần mở trang — người dùng hay lỡ tay F5.
  useEffect(() => {
    const luu = localStorage.getItem("sql-cau-lenh");
    if (luu) setSql(luu);
  }, []);
  useEffect(() => {
    localStorage.setItem("sql-cau-lenh", sql);
  }, [sql]);

  const cot = useMemo(() => {
    const rows = ketQua?.rows;
    if (!rows?.length) return [];
    // Gộp tên cột của mọi dòng, giữ thứ tự xuất hiện: một số câu lệnh trả về
    // dòng thiếu cột (ví dụ json lồng nhau) nên không lấy mỗi dòng đầu.
    const ra = [];
    for (const r of rows) {
      for (const k of Object.keys(r || {})) if (!ra.includes(k)) ra.push(k);
    }
    return ra;
  }, [ketQua]);

  async function chay() {
    setDangChay(true);
    setLoi(null);
    try {
      const res = await fetch("/api/runSql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit: gioiHan }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoi(json?.chiTiet ? `${json.error}\n${json.chiTiet}` : json?.error || "Lỗi không rõ");
        setKetQua(null);
        return;
      }
      setKetQua(json);
    } catch (e) {
      console.error(e);
      setLoi("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
      setKetQua(null);
    } finally {
      setDangChay(false);
    }
  }

  /** Dán một danh sách CCCD (mỗi dòng một số) → sinh sẵn câu lệnh tìm. */
  function sinhCauLenhTuDanhSach() {
    const ma = danhSach
      .split(/[\s,;]+/)
      .map((x) => x.trim().replace(/'/g, ""))
      .filter(Boolean);

    if (!ma.length) {
      alert("Chưa dán danh sách CCCD nào.");
      return;
    }
    const trongNgoac = [...new Set(ma)].map((x) => `'${x}'`).join(", ");
    setSql(
      `select "HOTEN", "NAMSINH", "GIOITINH", "CCCD", "SOHOK", "NOITHTRU"\n` +
        `from population\n` +
        `where "CCCD" in (${trongNgoac})`,
    );
    setHienTroGiup(false);
    oSoanThao.current?.focus();
  }

  function taiCsv() {
    if (!ketQua?.rows?.length) return;
    const dong = [
      cot.join(","),
      ...ketQua.rows.map((r) => cot.map((c) => oCsv(r?.[c])).join(",")),
    ];
    // ﻿ để Excel nhận ra UTF-8, không thì tiếng Việt ra ký tự lạ.
    const blob = new Blob(["﻿" + dong.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `truy-van-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "white",
        padding: 30,
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      <main style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: "bold",
              fontFamily: "cursive",
              color: "#93c5fd",
              marginBottom: 6,
            }}
          >
            TRUY VẤN SQL
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14 }}>
            Chỉ chạy được câu lệnh đọc (SELECT / WITH). Mọi lệnh sửa, xóa đều bị từ chối.
          </div>
        </div>

        {/* CÂU LỆNH MẪU */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {MAU.map((m) => (
            <button
              key={m.ten}
              onClick={() => setSql(m.sql)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                backgroundColor: "#1e293b",
                color: "#cbd5e1",
                border: "1px solid #475569",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {m.ten}
            </button>
          ))}
          <button
            onClick={() => setHienTroGiup((v) => !v)}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              backgroundColor: hienTroGiup ? "#0e7490" : "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #0891b2",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Dán danh sách CCCD →
          </button>
        </div>

        {/* HỘP DÁN DANH SÁCH CCCD */}
        {hienTroGiup && (
          <div
            style={{
              marginBottom: 12,
              padding: 14,
              backgroundColor: "#0b3a44",
              border: "1px solid #0891b2",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "#a5f3fc", marginBottom: 8 }}>
              Dán danh sách số CCCD (mỗi dòng một số, hoặc cách nhau bằng dấu phẩy).
              Bấm nút bên dưới để tự sinh câu lệnh tìm — không phải tự gõ dấu nháy.
            </div>
            <textarea
              value={danhSach}
              onChange={(e) => setDanhSach(e.target.value)}
              placeholder={"079201001234\n079201005678\n079201009999"}
              style={{
                width: "100%",
                minHeight: 90,
                padding: 10,
                fontSize: 13,
                fontFamily: "Consolas, Menlo, monospace",
                backgroundColor: "#0f172a",
                color: "white",
                border: "1px solid #155e75",
                borderRadius: 6,
                resize: "vertical",
              }}
            />
            <button
              onClick={sinhCauLenhTuDanhSach}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                fontSize: 14,
                backgroundColor: "#0891b2",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Sinh câu lệnh tìm
            </button>
          </div>
        )}

        {/* Ô SOẠN CÂU LỆNH */}
        <textarea
          ref={oSoanThao}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              chay();
            }
          }}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 170,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: "Consolas, Menlo, monospace",
            backgroundColor: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #475569",
            borderRadius: 8,
            resize: "vertical",
          }}
        />

        {/* THANH NÚT */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <button
            onClick={chay}
            disabled={dangChay}
            style={{
              padding: "10px 22px",
              fontSize: 15,
              fontWeight: 600,
              backgroundColor: dangChay ? "#707171" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: dangChay ? "default" : "pointer",
            }}
          >
            {dangChay ? "Đang chạy…" : "Chạy (Ctrl+Enter)"}
          </button>

          <label style={{ fontSize: 14, color: "#cbd5e1" }}>
            Tối đa{" "}
            <select
              value={gioiHan}
              onChange={(e) => setGioiHan(Number(e.target.value))}
              style={{
                padding: 6,
                fontSize: 14,
                backgroundColor: "#1e293b",
                color: "white",
                border: "1px solid #475569",
                borderRadius: 6,
              }}
            >
              {[100, 500, 1000, 5000].map((n) => (
                <option key={n} value={n}>
                  {n} dòng
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={taiCsv}
            disabled={!ketQua?.rows?.length}
            style={{
              padding: "10px 18px",
              fontSize: 14,
              backgroundColor: ketQua?.rows?.length ? "#16a34a" : "#374151",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: ketQua?.rows?.length ? "pointer" : "default",
            }}
          >
            Tải CSV
          </button>

          <Link
            href="/"
            style={{
              marginLeft: "auto",
              fontSize: 14,
              color: "#93c5fd",
              textDecoration: "none",
            }}
          >
            ← Trang chủ
          </Link>
        </div>

        {/* LỖI */}
        {loi && (
          <pre
            style={{
              marginTop: 16,
              padding: 14,
              backgroundColor: "#450a0a",
              border: "1px solid #b91c1c",
              borderRadius: 8,
              color: "#fecaca",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "Consolas, Menlo, monospace",
            }}
          >
            {loi}
          </pre>
        )}

        {/* TÓM TẮT KẾT QUẢ */}
        {ketQua && !loi && (
          <div style={{ marginTop: 20, marginBottom: 10, fontSize: 14, color: "#cbd5e1" }}>
            {ketQua.soDong} dòng · {ketQua.mili} ms
            {ketQua.chamGioiHan && (
              <span style={{ color: "#fbbf24", marginLeft: 10 }}>
                ⚠ Đã chạm mức tối đa {ketQua.gioiHan} dòng — có thể còn dòng chưa hiện.
                Chọn mức cao hơn hoặc thu hẹp điều kiện.
              </span>
            )}
          </div>
        )}

        {/* BẢNG KẾT QUẢ */}
        {ketQua && !loi && ketQua.rows.length > 0 && (
          <div style={{ overflowX: "auto", borderRadius: 10 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#1e293b",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#334155" }}>
                  <th style={{ padding: 8, border: "1px solid #475569", whiteSpace: "nowrap" }}>
                    STT
                  </th>
                  {cot.map((c) => (
                    <th
                      key={c}
                      style={{ padding: 8, border: "1px solid #475569", whiteSpace: "nowrap" }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ketQua.rows.map((r, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 ? "#1e293b" : "#172033" }}>
                    <td
                      style={{
                        padding: 6,
                        border: "1px solid #475569",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      {i + 1}
                    </td>
                    {cot.map((c) => {
                      const v = hienGiaTri(r?.[c]);
                      return (
                        <td
                          key={c}
                          style={{
                            padding: 6,
                            border: "1px solid #475569",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            maxWidth: 320,
                            color: v === null ? "#475569" : "white",
                          }}
                        >
                          {v === null ? "—" : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ketQua && !loi && ketQua.rows.length === 0 && (
          <div
            style={{
              marginTop: 10,
              padding: 20,
              textAlign: "center",
              color: "#94a3b8",
              backgroundColor: "#1e293b",
              borderRadius: 8,
            }}
          >
            Câu lệnh chạy xong nhưng không có dòng nào khớp.
          </div>
        )}

        {/* GHI CHÚ */}
        <div style={{ marginTop: 30, fontSize: 12.5, color: "#64748b", lineHeight: 1.7 }}>
          <div>
            <b style={{ color: "#94a3b8" }}>Tên bảng:</b> <code>population</code>,{" "}
            <code>crime</code>
          </div>
          <div>
            <b style={{ color: "#94a3b8" }}>Tên cột phải bọc trong nháy kép</b> vì viết hoa —{" "}
            <code>&quot;HOTEN&quot;</code> chạy được, <code>HOTEN</code> thì Postgres hiểu thành{" "}
            <code>hoten</code> và báo không có cột.
          </div>
          <div>
            Chuỗi dùng nháy đơn: <code>&quot;HOTEN&quot; ilike &apos;%NGUYỄN%&apos;</code>.{" "}
            <code>ilike</code> là tìm gần đúng không phân biệt hoa thường.
          </div>
          <div>Mỗi lần chỉ chạy một câu lệnh. Câu chạy quá 15 giây sẽ bị cắt.</div>
        </div>
      </main>
    </div>
  );
}
