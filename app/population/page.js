"use client";
import { useState, useEffect } from "react";

export default function Home() {
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
    TENCHA: "TÊN CHA",
    TENME: "TÊN MẸ",
  };

  async function search() {
      setLoading(true); // 👈 bật loading
    try {
      // 👉 Gom các điều kiện có giá trị
      const filters = {};
      if (input1.trim()) filters[select1] = input1.trim();
      if (input2.trim()) filters[select2] = input2.trim();
      if (input3.trim()) filters[select3] = input3.trim();

      if (Object.keys(filters).length === 0) {
        alert("Vui lòng nhập ít nhất một điều kiện tìm kiếm!");
        return;
      }

      // 👉 Gửi request tới API
      const res = await fetch("/api/searchData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: "population",
          criteria: filters,
          fuzzy: true, // 🔍 tìm gần đúng
        }),
      });

      if (!res.ok) throw new Error("Không thể kết nối máy chủ");

      const data = await res.json();
      console.log(data);

      // 👉 Cập nhật dữ liệu kết quả
      setFixDataIndex(null);
      setData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
      alert("Đã xảy ra lỗi trong quá trình tìm kiếm!");
    }finally {
      setLoading(false); // 👈 tắt loading
    }
  }

  function reset() {
    setInput1("");
    setInput2("");
    setInput3("");
    setSelect1("HOTEN");
    setSelect2("HOTEN");
    setSelect3("HOTEN");
  }

  async function addData() {
    let newDataConvert = newData;

    newDataConvert["GIOITINH"] =
      newDataConvert["GIOITINH"] == "NAM" ? true : false;

    let supabase = await fetch("/api/addData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: "population",
        newData: newDataConvert,
      }),
    });

    alert("Thêm dữ liệu thành công");
    const result = await supabase.json();
    console.log("result", result);
    console.log("newDataConvert", newDataConvert);

    setData(data?.length ? [...data, ...[newData]] : [newData]);
    setNewData(null);
  }

  async function deleteData(cccd) {
    let supabase = await fetch("/api/deleteData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    console.log("data", data);

    let fixItem = newFixData;

    fixItem["GIOITINH"] = fixItem["GIOITINH"] == "NAM" ? true : false;

    let supabase = await fetch("/api/fixData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
                {Object.keys(title).map((item) => (
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
                }}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value.toUpperCase())}
                placeholder="NHẬP THÔNG TIN"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // 👈 tránh reload form
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
        </div>
        {loading && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div className="spinner" />
            <div>Đang tải dữ liệu...</div>
          </div>
        )}
        {/* BẢNG */}
        <table
          style={{
            width: "100%",
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
                        <input
                          style={{
                            padding: 5,
                            fontSize: 12,
                            width: "100%",
                            backgroundColor: "#1e293b",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                          }}
                          value={newFixData[key] || ""}
                          onChange={(e) => {
                            setNewFixData(
                              data.map((d, ii) =>
                                i === ii
                                  ? {
                                      ...d,
                                      [key]: e.target.value.toUpperCase(),
                                    }
                                  : d,
                              )[i],
                            );
                          }}
                        />
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
                        {key == "GIOITINH"
                          ? item[key]
                            ? "Nam"
                            : "Nữ"
                          : item[key]}
                      </td>
                    ))}
                    <td
                      style={{
                        border: "1px solid #475569",
                        textAlign: "center",
                        padding: 8,
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
                        }}
                      >
                        Xóa
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
                    <input
                      style={{
                        padding: 5,
                        fontSize: 12,
                        width: "100%",
                        backgroundColor: "#1e293b",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        textTransform: "uppercase",
                      }}
                      value={newData[key] || ""}
                      onChange={(e) => {
                        setNewData({
                          ...newData,
                          [key]: e.target.value.toUpperCase(),
                        });
                      }}
                    />
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
                TENCHA: "",
                TENME: "",
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
