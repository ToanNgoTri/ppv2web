"use client";
import Image from "next/image";
import styles from "../page.module.css";
import { createClient } from "@supabase/supabase-js";
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

  const [fixDataIndex, setFixDataIndex] = useState(null);

  const title = {
    HOTEN: "HỌ TÊN",
    TENKHAC: "TÊN KHÁC",
    GIOITINH: "GIỚI TÍNH",
    NAMSINH: "NĂM SINH",
    TENCHA: "TÊN CHA",
    TENME: "TÊN MẸ",
    SOHOK: "SỐ HSHK",
    DANTOC: "DÂN TỘC",
    TONGIAO: "TÔN GIÁO",
    CCCD: "CCCD",
    NOITHTRU: "ĐỊA CHỈ",
    CHARGE: "TỘI DANH",
    JUDGMENT: "HÌNH PHẠT",
    DAYARRES: "NGÀY BẮT",
    FREEDAY: "NGÀY TỰ DO",
    DETENTION: "NƠI CHẤP HÀNH",
  };


async function search() {
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
        database: "crime",
        criteria: filters,
        fuzzy: true, // 🔍 tìm gần đúng
      }),
    });

    if (!res.ok) throw new Error("Không thể kết nối máy chủ");

    const data = await res.json();

    // 👉 Cập nhật dữ liệu kết quả
    setFixDataIndex(null);
    setData(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Lỗi tìm kiếm:", error);
    alert("Đã xảy ra lỗi trong quá trình tìm kiếm!");
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
        database: "crime",
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
        database: "crime",
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

    console.log("fixItem", fixItem);

    let supabase = await fetch("/api/fixData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: "crime",
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
    // }
  }

  return (
    <div
      style={{
        backgroundColor: "#f5f6fa",
        minHeight: "100vh",
        padding: 30,
        fontFamily: "Arial, sans-serif",
        color: "#333",
      }}
    >
      <main>
        {/* --- Tiêu đề và bộ lọc --- */}
        <div
          style={{
            marginBottom: 30,
            flexDirection: "column",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              marginBottom: 20,
              fontSize: 36,
              fontWeight: "bold",
              fontFamily: "Segoe UI",
              color: "#2c3e50",
            }}
          >
            CÔNG CỤ TÌM KIẾM ĐỐI TƯỢNG
          </div>

          {[1, 2, 3].map((num) => {
            const currentTitle =
              num === 1 ? select1 : num === 2 ? select2 : select3;
            const currentInput =
              num === 1 ? input1 : num === 2 ? input2 : input3;
            const setCurrentInput =
              num === 1 ? setInput1 : num === 2 ? setInput2 : setInput3;

            return (
              <div
                key={num}
                style={{
                  marginBottom: 15,
                  flexDirection: "row",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <label style={{ fontWeight: "bold" }}>Chọn Dữ liệu:</label>
                <select
                  value={currentTitle}
                  style={{
                    padding: 10,
                    fontSize: 15,
                    marginLeft: 15,
                    borderRadius: 5,
                    border: "1px solid #ccc",
                    backgroundColor: "white",
                    color: "black",
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
                    padding: 10,
                    fontSize: 15,
                    marginLeft: 15,
                    borderRadius: 5,
                    border: "1px solid #ccc",
                    width: 250,
                    textTransform: "uppercase",
                  }}
                  value={currentInput}
                  onChange={(e) =>
                    setCurrentInput(e.target.value.toUpperCase())
                  }
                  placeholder="NHẬP THÔNG TIN"
                />
              </div>
            );
          })}
        </div>

        {/* --- Nút điều khiển --- */}
        <div
          style={{
            justifyContent: "center",
            display: "flex",
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              fontSize: 15,
              backgroundColor: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Xóa dữ liệu
          </button>

          <button
            style={{
              padding: "10px 20px",
              fontSize: 15,
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              marginLeft: 20,
            }}
            onClick={() => search()}
          >
            Tìm kiếm
          </button>
        </div>

        {/* --- Kết quả --- */}
        <div style={{ marginTop: 10, marginBottom: 20, textAlign: "center" }}>
          <b>Tìm thấy {data && data.length} kết quả</b>
        </div>

        {/* --- Bảng dữ liệu --- */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "white",
            borderRadius: 6,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <tbody>
            {/* Tiêu đề cột */}
            <tr style={{ backgroundColor: "#2c3e50", color: "white" }}>
              <td style={{ padding: 8, textAlign: "center" }}>STT</td>
              {Object.keys(title).map((item) => (
                <td
                  key={item}
                  style={{
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  {title[item]}
                </td>
              ))}
              <td style={{ padding: 8, textAlign: "center" }}>Hành động</td>
            </tr>

            {/* Dữ liệu */}
            {data &&
              data.map((item, i) =>
                fixDataIndex === i ? (
                  <tr key={i} style={{ backgroundColor: "#ecf0f1" }}>
                    <td style={{ textAlign: "center", padding: 5 }}>{i + 1}</td>
                    {Object.keys(title).map((key) => (
                      <td key={key} style={{ padding: 5, textAlign: "center" }}>
                        <input
                          style={{
                            padding: 5,
                            fontSize: 13,
                            width: "90%",
                            border: "1px solid #ccc",
                            borderRadius: 4,
                          }}
                          value={newFixData[key]}
                          onChange={(e) =>
                            setNewFixData(
                              data.map((d, ii) =>
                                i === ii
                                  ? {
                                      ...d,
                                      [key]: e.target.value.toUpperCase(),
                                    }
                                  : d
                              )[i]
                            )
                          }
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      <button
                        style={{
                          backgroundColor: "#27ae60",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          padding: "5px 10px",
                          cursor: "pointer",
                          border: "1px solid black",
                        }}
                        onClick={() => fixData(data[fixDataIndex].CCCD)}
                      >
                        Lưu
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#fafafa" : "white",
                    }}
                  >
                    <td
                      style={{
                        textAlign: "center",
                        padding: 6,
                        border: "1px solid black",
                      }}
                    >
                      {i + 1}
                    </td>
                    {Object.keys(title).map((key) => (
                      <td
                        key={key}
                        style={{
                          padding: 6,
                          textAlign: "center",
                          color: "#333",
                          border: "1px solid black",
                        }}
                      >
                        {key === "GIOITINH"
                          ? item[key] === true
                            ? "Nam"
                            : "Nữ"
                          : item[key]}
                      </td>
                    ))}
                    <td style={{ textAlign: "center",border: "1px solid black", }}>
                      <button
                        style={{
                          fontSize: 12,
                          backgroundColor: "#3498db",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          cursor: "pointer",
                          padding: "5px 10px",
                          // marginRight: 5,
                          // border: "1px solid black",
                        }}
                        onClick={() => {
                          setFixDataIndex(i);
                          setNewFixData({ ...item });
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        style={{
                          fontSize: 12,
                          backgroundColor: "#e74c3c",
                          color: "white",
                          border: "none",
                          borderRadius: 5,
                          cursor: "pointer",
                          padding: "5px 10px",
                        }}
                        onClick={() => deleteData(item.CCCD)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                )
              )}

            {/* Thêm dữ liệu mới */}
            {newData && (
              <tr style={{ backgroundColor: "#e8f5e9" }}>
                <td style={{ padding: 5, textAlign: "center" }}>
                  {data && data.length + 1}
                </td>
                {Object.keys(title).map((key) => (
                  <td key={key} style={{ padding: 5, textAlign: "center" }}>
                    <input
                      style={{
                        padding: 5,
                        fontSize: 13,
                        width: "90%",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                        textTransform: "uppercase",
                      }}
                      value={newData[key]}
                      onChange={(e) =>
                        setNewData({
                          ...newData,
                          [key]: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </td>
                ))}
                <td style={{ textAlign: "center" }}>
                  <button
                    style={{
                      backgroundColor: "#2ecc71",
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
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* --- Nút thêm mới ở dưới --- */}
        <div style={{ marginTop: 20, textAlign: "center" }}>
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
                CHARGE: "",
                JUDGMENT: "",
                DETENTION: "",
                DAYARRES: "",
                FREEDAY: "",
              })
            }
            style={{
              backgroundColor: "#43a047",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            + Thêm dữ liệu
          </button>
        </div>
      </main>
    </div>
  );
}
