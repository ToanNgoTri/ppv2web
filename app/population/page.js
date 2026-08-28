"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Cột giữ nguyên chữ như người dùng gõ. Toạ độ in hoa lên thì vô nghĩa, mà
// còn làm link bản đồ trông kỳ.
const KHONG_IN_HOA = ["LOCATION"];

// Cột chỉ để xem/sửa, không đưa vào ô "Chọn Dữ liệu" vì tìm theo nó vô nghĩa.
const KHONG_TIM = ["LOCATION"];

// Toạ độ lưu dạng "10.863423, 107.224308". Dựng sẵn link Google Maps để bấm
// vào là mở đúng vị trí, khỏi phải copy dán tay.
function mapUrl(toaDo) {
  return `https://www.google.com/maps?q=${encodeURIComponent(
    String(toaDo).trim(),
  )}`;
}

// Chuẩn hoá in hoa lúc gửi dữ liệu, không transform trong lúc gõ
// (transform khi gõ sẽ làm hỏng bộ gõ tiếng Việt - Unikey/Telex)
function upperFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] =
      typeof v === "string" && !KHONG_IN_HOA.includes(k)
        ? v.trim().toUpperCase()
        : v;
  }
  return out;
}

// Cột boolean của bảng population: nhãn hiển thị cho hai trạng thái.
// Gom vào một chỗ để cả lúc hiển thị lẫn lúc sửa dùng chung, không phải lồng
// thêm một tầng ternary mỗi khi thêm cột mới.
const BOOLEAN_LABELS = {
  GIOITINH: { true: "Nam", false: "Nữ" },
  VANGNHA: { true: "Có", false: "Không" },
  CRIMINALRECORD: { true: "Có", false: "Không" },
};

// Các cột được lọc bằng ô bấm ở trên vùng tìm kiếm thay vì ô nhập chữ.
// Không bấm ô nào = không lọc = tìm tất cả.
const FLAG_LABELS = {
  CRIMINALRECORD: "Tiền án/tiền sự",
};

export default function Home() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [input3, setInput3] = useState("");

  const [select1, setSelect1] = useState("HOTEN");
  const [select2, setSelect2] = useState("HOTEN");
  const [select3, setSelect3] = useState("HOTEN");

  const [newData, setNewData] = useState(null);
  const [newFixData, setNewFixData] = useState([]);

  const [loading, setLoading] = useState(false);

  const [fixDataIndex, setFixDataIndex] = useState(null);

  // Trạng thái bật/tắt của các ô phân loại phía trên vùng tìm kiếm
  const [flags, setFlags] = useState(() =>
    Object.fromEntries(Object.keys(FLAG_LABELS).map((k) => [k, false])),
  );

  const title = {
    HOTEN: "HỌ TÊN",
    GIOITINH: "GIỚI TÍNH",
    NAMSINH: "NĂM SINH",
    QUANHE: "QUAN HỆ VỚI CH",
    SOHOK: "SỐ HSHK",
    CCCD: "CCCD",
    DANTOC: "DÂN TỘC",
    TONGIAO: "TÔN GIÁO",
    NOITHTRU: "ĐỊA CHỈ",
    NOIOHIENTAI: "NƠI Ở HIỆN TẠI",
    TENCHA: "TÊN CHA",
    TENME: "TÊN MẸ",
    SDT: "SĐT",
    VANGNHA: "VẮNG NHÀ",
    CRIMINALRECORD: "TIỀN ÁN/TIỀN SỰ",
    GHICHU: "GHI CHÚ",
    LOCATION: "TOẠ ĐỘ",
  };

  // Danh sách cột cho ô "Chọn Dữ liệu": bỏ các cột đã có ô bấm riêng và các
  // cột không tìm theo được.
  const searchFields = Object.keys(title).filter(
    (k) => !(k in FLAG_LABELS) && !KHONG_TIM.includes(k),
  );

  async function search() {
    setLoading(true);
    try {
      const filters = {};
      if (input1.trim()) filters[select1] = input1.trim().toUpperCase();
      if (input2.trim()) filters[select2] = input2.trim().toUpperCase();
      if (input3.trim()) filters[select3] = input3.trim().toUpperCase();

      const flagsBat = Object.values(flags).some(Boolean);
      if (Object.keys(filters).length === 0 && !flagsBat) {
        alert("Vui lòng nhập ít nhất một điều kiện tìm kiếm!");
        return;
      }

      const res = await fetch("/api/searchData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: "population",
          criteria: filters,
          flags,
          fuzzy: true,
        }),
      });

      if (!res.ok) throw new Error("Không thể kết nối máy chủ");

      const data = await res.json();
      console.log(data);

      setFixDataIndex(null);
      setData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
      alert("Đã xảy ra lỗi trong quá trình tìm kiếm!");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setInput1("");
    setInput2("");
    setInput3("");
    setSelect1("HOTEN");
    setSelect2("HOTEN");
    setSelect3("HOTEN");
    setFlags(
      Object.fromEntries(Object.keys(FLAG_LABELS).map((k) => [k, false])),
    );
  }

  async function addData() {
    let newDataConvert = upperFields(newData);
    // Cột boolean phải gửi đúng kiểu true/false, gửi chuỗi thì Postgres từ chối
    for (const key of Object.keys(BOOLEAN_LABELS)) {
      if (key in newDataConvert) {
        newDataConvert[key] =
          newDataConvert[key] === true ||
          String(newDataConvert[key]).toUpperCase() ===
            BOOLEAN_LABELS[key].true.toUpperCase();
      }
    }

    let supabase = await fetch("/api/addData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database: "population",
        newData: newDataConvert,
      }),
    });

    alert("Thêm dữ liệu thành công");
    const result = await supabase.json();
    console.log("result", result);
    console.log("newDataConvert", newDataConvert);

    setData(data?.length ? [...data, newDataConvert] : [newDataConvert]);
    setNewData(null);
  }

  async function deleteData(cccd) {
    let supabase = await fetch("/api/deleteData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database: "population",
        CCCD: cccd,
      }),
    });
    alert("Xóa dữ liệu thành công");
    setData(data && data.filter((item) => item.CCCD !== cccd));
  }

  async function fixData(cccd) {
    if (fixDataIndex === null) return;

    let fixItem = upperFields(newFixData);

    let supabase = await fetch("/api/fixData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database: "population",
        CCCD: cccd,
        newData: fixItem,
      }),
    });

    alert("Chỉnh sửa dữ liệu thành công");
    const updatedData = data;
    updatedData[fixDataIndex] = fixItem;
    setData(updatedData);
    setFixDataIndex(null);
    setNewFixData([]);
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
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* TIÊU ĐỀ */}
        <div style={{ marginBottom: 30, textAlign: "center" }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: "bold",
              fontFamily: "cursive",
              color: "#93c5fd",
              marginBottom: 10,
            }}
          >
            CÔNG CỤ TÌM KIẾM DÂN CƯ
          </div>
        </div>

        {/* Ô PHÂN LOẠI — bấm để lọc, không bấm ô nào thì tìm tất cả */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
            justifyContent: "center",
          }}
        >
          {Object.keys(FLAG_LABELS).map((field) => {
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
                  border: `1px solid ${on ? "#22c55e" : "#475569"}`,
                  backgroundColor: on ? "#22c55e" : "#1e293b",
                  color: on ? "white" : "#cbd5e1",
                }}
              >
                {on ? "✓ " : ""}
                {FLAG_LABELS[field]}
              </button>
            );
          })}
        </div>

        {/* FORM TÌM KIẾM */}
        {[1, 2, 3].map((num) => {
          const currentTitle =
            num === 1 ? select1 : num === 2 ? select2 : select3;
          const currentInput = num === 1 ? input1 : num === 2 ? input2 : input3;
          const setCurrentInput =
            num === 1 ? setInput1 : num === 2 ? setInput2 : setInput3;

          return (
            <div
              key={num}
              style={{
                marginBottom: 15,
                display: "flex",
                alignItems: "center",
                gap: 15,
              }}
            >
              <label style={{ minWidth: 100 }}>Chọn Dữ liệu:</label>
              <select
                value={currentTitle}
                style={{
                  padding: 8,
                  fontSize: 15,
                  borderRadius: 6,
                  backgroundColor: "#1e293b",
                  color: "white",
                  border: "1px solid #475569",
                }}
                onChange={(e) => {
                  if (num === 1) setSelect1(e.target.value);
                  if (num === 2) setSelect2(e.target.value);
                  if (num === 3) setSelect3(e.target.value);
                }}
              >
                {searchFields.map((item) => (
                  <option key={item} value={item}>
                    {title[item]}
                  </option>
                ))}
              </select>
              <input
                style={{
                  padding: 8,
                  fontSize: 15,
                  borderRadius: 6,
                  border: "1px solid #475569",
                  backgroundColor: "#0f172a",
                  color: "white",
                  width: 250,
                  textTransform: "uppercase",
                }}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="NHẬP THÔNG TIN"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
              />
            </div>
          );
        })}

        {/* NÚT TÌM & RESET */}
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: "#475569",
              padding: "10px 18px",
              color: "white",
              fontSize: 15,
              borderRadius: 6,
              cursor: "pointer",
              border: "none",
            }}
          >
            Xóa dữ liệu
          </button>
          <button
            onClick={() => search()}
            disabled={loading}
            style={{
              padding: "10px 18px",
              fontSize: 15,
              backgroundColor: loading ? "#707171" : "#2563eb",
              color: "white",
              borderRadius: 6,
              cursor: "pointer",
              border: "none",
            }}
          >
            Tìm kiếm
          </button>
        </div>

        {/* KẾT QUẢ */}
        <div style={{ marginTop: 25, marginBottom: 10 }}>
          Tìm thấy {data && data.length} kết quả
          {data && data.length >= 1000 && (
            <span style={{ color: "#fbbf24", marginLeft: 8 }}>
              (đã cắt ở 1000 dòng — thu hẹp điều kiện để xem hết)
            </span>
          )}
        </div>
        {loading && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div className="spinner" />
            <div>Đang tải dữ liệu...</div>
          </div>
        )}

        {/* BẢNG */}
        <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 1400,
            borderCollapse: "collapse",
            backgroundColor: "#1e293b",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#334155" }}>
              <th style={{ padding: 10, border: "1px solid #475569" }}>STT</th>
              {Object.keys(title).map((item) => (
                <th
                  key={item}
                  style={{ padding: 10, border: "1px solid #475569" }}
                >
                  {title[item]}
                </th>
              ))}
              <th style={{ padding: 10, border: "1px solid #475569" }}>
                Chức năng
              </th>
            </tr>
          </thead>

          <tbody>
            {data &&
              data.map((item, i) =>
                fixDataIndex == i ? (
                  /* --- HÀNG ĐANG EDIT --- */
                  <tr key={i} style={{ backgroundColor: "#0f172a" }}>
                    <td
                      style={{
                        border: "1px solid #475569",
                        textAlign: "center",
                        padding: 8,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {i + 1}
                    </td>
                    {Object.keys(title).map((key) => (
                      <td
                        key={key}
                        style={{
                          border: "1px solid #475569",
                          padding: 5,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {BOOLEAN_LABELS[key] ? (
                          <select
                            value={newFixData[key] ? "TRUE" : "FALSE"}
                            onChange={(e) => {
                              setNewFixData({
                                ...newFixData,
                                [key]: e.target.value === "TRUE",
                              });
                            }}
                          >
                            <option value="TRUE">
                              {BOOLEAN_LABELS[key].true}
                            </option>
                            <option value="FALSE">
                              {BOOLEAN_LABELS[key].false}
                            </option>
                          </select>
                        ) : (
                          <input
                            style={{
                              padding: 5,
                              fontSize: 12,
                              width: "100%",
                              backgroundColor: "#1e293b",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              textTransform: KHONG_IN_HOA.includes(key)
                                ? "none"
                                : "uppercase",
                            }}
                            value={newFixData[key] || ""}
                            onChange={(e) => {
                              setNewFixData({
                                ...newFixData,
                                [key]: e.target.value,
                              });
                            }}
                          />
                        )}
                      </td>
                    ))}
                    <td
                      style={{
                        border: "1px solid #475569",
                        textAlign: "center",
                        padding: 8,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      <button
                        onClick={() => fixData(data[fixDataIndex].CCCD)}
                        style={{
                          backgroundColor: "#22c55e",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          padding: "6px 12px",
                          cursor: "pointer",
                          marginRight: 4,
                        }}
                      >
                        Lưu
                      </button>
                      <button
                        style={{
                          background: "gray",
                          color: "white",
                          padding: "5px 10px",
                          borderRadius: 5,
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setFixDataIndex(null);
                          setNewFixData({});
                        }}
                      >
                        Hủy
                      </button>
                    </td>
                  </tr>
                ) : (
                  /* --- HÀNG BÌNH THƯỜNG --- */
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#1e293b" : "#0f172a",
                    }}
                  >
                    <td
                      style={{
                        border: "1px solid #475569",
                        textAlign: "center",
                        padding: 8,
                      }}
                    >
                      {i + 1}
                    </td>
                    {Object.keys(title).map((key) => (
                      <td
                        key={key}
                        style={{
                          border: "1px solid #475569",
                          textAlign: "center",
                          padding: 8,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {BOOLEAN_LABELS[key] ? (
                          BOOLEAN_LABELS[key][item[key] ? "true" : "false"]
                        ) : key === "LOCATION" && item[key] ? (
                          <a
                            href={mapUrl(item[key])}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#93c5fd" }}
                          >
                            📍 {item[key]}
                          </a>
                        ) : (
                          item[key]
                        )}
                      </td>
                    ))}
                    <td
                      style={{
                        border: "1px solid #475569",
                        textAlign: "center",
                        padding: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        onClick={() => {
                          setFixDataIndex(i);
                          setNewFixData({ ...item });
                        }}
                        style={{
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          padding: "6px 10px",
                          cursor: "pointer",
                          marginRight: 4,
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => deleteData(item.CCCD)}
                        style={{
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          padding: "6px 10px",
                          cursor: "pointer",
                          marginRight: 4,
                        }}
                      >
                        Xóa
                      </button>
                      {/* ✅ NÚT TẠO HỒ SƠ MỚI */}
                      <button
                        onClick={() =>
                          router.push(`/generatedocs?cccd=${item.CCCD}`)
                        }
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          padding: "6px 10px",
                          cursor: "pointer",
                        }}
                      >
                        📄 Hồ sơ
                      </button>
                    </td>
                  </tr>
                ),
              )}

            {/* THÊM DỮ LIỆU */}
            {newData && (
              <tr style={{ backgroundColor: "#0f172a" }}>
                <td
                  style={{
                    border: "1px solid #475569",
                    textAlign: "center",
                    padding: 8,
                  }}
                >
                  {data && data.length + 1}
                </td>
                {Object.keys(title).map((key) => (
                  <td
                    key={key}
                    style={{
                      border: "1px solid #475569",
                      padding: 5,
                    }}
                  >
                    {BOOLEAN_LABELS[key] ? (
                      <select
                        value={newData[key] ? "TRUE" : "FALSE"}
                        onChange={(e) => {
                          setNewData({
                            ...newData,
                            [key]: e.target.value === "TRUE",
                          });
                        }}
                      >
                        <option value="FALSE">
                          {BOOLEAN_LABELS[key].false}
                        </option>
                        <option value="TRUE">
                          {BOOLEAN_LABELS[key].true}
                        </option>
                      </select>
                    ) : (
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          backgroundColor: "#1e293b",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          textTransform: KHONG_IN_HOA.includes(key)
                            ? "none"
                            : "uppercase",
                        }}
                        value={newData[key] || ""}
                        onChange={(e) => {
                          setNewData({
                            ...newData,
                            [key]: e.target.value,
                          });
                        }}
                      />
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "center", padding: 8 }}>
                  <button
                    style={{
                      backgroundColor: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: 5,
                      padding: "6px 12px",
                      cursor: "pointer",
                      marginRight: 4,
                    }}
                    onClick={() => addData()}
                  >
                    Thêm
                  </button>
                  <button
                    style={{
                      backgroundColor: "#626262",
                      color: "white",
                      border: "none",
                      borderRadius: 5,
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                    onClick={() => setNewData(null)}
                  >
                    Hủy
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        {/* NÚT THÊM */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() =>
              setNewData({
                HOTEN: "",
                NAMSINH: "",
                GIOITINH: "",
                DANTOC: "",
                TONGIAO: "",
                CCCD: "",
                SOHOK: "",
                NOITHTRU: "",
                NOIOHIENTAI: "",
                TENCHA: "",
                TENME: "",
                SDT: "",
                VANGNHA: false,
                CRIMINALRECORD: false,
                GHICHU: "",
                LOCATION: "",
              })
            }
            style={{
              backgroundColor: "#16a34a",
              color: "white",
              padding: "10px 20px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            + Thêm dữ liệu
          </button>
        </div>
      </main>
    </div>
  );
}
