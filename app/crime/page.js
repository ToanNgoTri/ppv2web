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

  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState(null);

  const [newData, setNewData] = useState(null);
  const [newFixData, setNewFixData] = useState([]);

  const [fixDataIndex, setFixDataIndex] = useState(null);

  const [preview, setPreview] = useState(null);

  const Supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

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
    VANGNHA: "VẮNG NHÀ",
    GHICHU: "GHI CHÚ",
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
    } finally {
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
    try {
      let newDataConvert = { ...newData };

      newDataConvert["GIOITINH"] = newDataConvert["GIOITINH"] === "NAM";

      // upload ảnh
      const imageUrl = await uploadImage(newData.CCCD);

      if (!imageUrl) {
        alert("Upload ảnh thất bại");
        return;
      }

      // newDataConvert.IMAGE_URL = imageUrl;

      const res = await fetch("/api/addData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          database: "crime", // ⚠️ sửa lại cho đúng
          newData: newDataConvert,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("API ERROR:", result);
        alert(result?.error || "Insert thất bại");
        return;
      }

      setData((prev) => [...prev, newDataConvert]);
      setNewData(null);

      alert("Thêm dữ liệu thành công");
      // setPreview(null);
      // setFile(null);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi thêm dữ liệu");
    }
  }
  async function deleteData(cccd) {
    await deleteImage(cccd);

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

    // fixItem["GIOITINH"] = fixItem["GIOITINH"] == "NAM" ? true : false;

    console.log("fixItem", fixItem);

    const imageUrl = await uploadImage(cccd);

    console.log("file", file);

    if (!imageUrl) {
      alert("Upload ảnh thất bại");
      return;
    }

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
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  }

  async function uploadImage(cccd) {
    try {
      const fileName = `${cccd}.jpg`;
      console.log("fileName", fileName);

      const { error } = await Supabase.storage
        .from("imageCrime")
        .upload(`subject/${fileName}`, file, {
          contentType: "image/jpg",
          upsert: true,
        });

      if (error) throw error;

      const { data } = Supabase.storage
        .from("imageCrime")
        .getPublicUrl(`subject/${fileName}`);

      return data.publicUrl;
    } catch (err) {
      console.error("Upload failed:", err);
      return null;
    }
  }

  async function deleteImage(cccd) {
    try {
      const fileName = `${cccd}.jpg`;

      const { error } = await Supabase.storage
        .from("imageCrime")
        .remove([`subject/${fileName}`]); // 👈 phải là array

      if (error) throw error;

      console.log("Xóa ảnh thành công");
      return true;
    } catch (err) {
      console.error("Delete failed:", err);
      return false;
    }
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
              backgroundColor: loading ? "#707171" : "#3498db",
              color: "white",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              marginLeft: 20,
            }}
            onClick={() => search()}
            disabled={loading}
          >
            Tìm kiếm
          </button>
        </div>

        {/* --- Kết quả --- */}
        <div style={{ marginTop: 10, marginBottom: 20, textAlign: "center" }}>
          <b>Tìm thấy {data && data.length} kết quả</b>
        </div>
        {loading && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <div className="spinner" />
            <div>Đang tải dữ liệu...</div>
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          {data.map((item, i) => {
            const isEditing = fixDataIndex === i;

            function getImageUrl(cccd) {
              const path = `subject/${cccd}.jpg`;

              const { data } = Supabase.storage
                .from("imageCrime")
                .getPublicUrl(path);

              return data?.publicUrl;
            }

            return (
              <div
                key={i}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 15,
                  marginBottom: 15,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                }}
              >
                {/* HEADER */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <b>
                    {i + 1}. {item.HOTEN}
                  </b>
                  <span>{item.CCCD}</span>
                </div>

                {/* CONTENT */}
                <div style={{ display: "flex", gap: 15 }}>
                  {/* LEFT INFO */}
                  <div style={{ flex: 1 }}>
                    {Object.keys(title).map((key) => (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <b>{title[key]}: </b>

                        {isEditing ? (
                          key === "GIOITINH" ? (
                            <select
                              style={inputStyle}
                              value={
                                newFixData[key] === true ? "TRUE" : "FALSE"
                              }
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value === "TRUE",
                                })
                              }
                            >
                              <option value="TRUE">Nam</option>
                              <option value="FALSE">Nữ</option>
                            </select>
                          ) : key === "VANGNHA" ? (
                            <select
                              style={inputStyle}
                              value={
                                newFixData[key] === true ? "TRUE" : "FALSE"
                              }
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value === "TRUE",
                                })
                              }
                            >
                              <option value="TRUE">Có</option>
                              <option value="FALSE">Không</option>
                            </select>
                          ) : ["NOITHTRU", "CHARGE", "JUDGMENT"].includes(
                              key,
                            ) ? (
                            <textarea
                              style={inputStyle}
                              value={newFixData[key] || ""}
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value.toUpperCase(),
                                })
                              }
                            />
                          ) : (
                            <input
                              style={inputStyle}
                              value={newFixData[key] || ""}
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value.toUpperCase(),
                                })
                              }
                            />
                          )
                        ) : key === "GIOITINH" ? (
                          item[key] ? (
                            "Nam"
                          ) : (
                            "Nữ"
                          )
                        )  : key === "VANGNHA" ? (
                          item[key] ? (
                            "Có"
                          ) : (
                            "Không"
                          )
                        ) :(
                          <span style={textStyle}>{item[key]}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* IMAGE */}
                  <div
                    style={{
                      width: "30%",
                    }}
                  >
                    <Image
                      src={
                        fixDataIndex == i
                          ? preview && preview.trim() !== null
                            ? preview
                            : getImageUrl(item.CCCD)
                          : getImageUrl(item.CCCD) || "/assets/unknown.jpg"
                      }
                      width={400}
                      height={400}
                      alt="avatar"
                      style={{
                        borderRadius: 10,
                        objectFit: "cover",
                        width: "100%",
                      }}
                    />
                    {isEditing && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e)}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* ACTION */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {isEditing ? (
                    <>
                      <button
                        style={btnSave}
                        onClick={() => fixData(item.CCCD)}
                      >
                        Lưu
                      </button>

                      <button
                        style={btnCancel}
                        onClick={() => {
                          setFixDataIndex(null);
                          setNewFixData({});
                        }}
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={btnEdit}
                        onClick={() => {
                          setFixDataIndex(i);
                          setNewFixData({ ...item });
                        }}
                      >
                        Sửa
                      </button>

                      <button
                        style={btnDelete}
                        onClick={() => deleteData(item.CCCD)}
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* ADD NEW */}
          {newData && (
            <div
              style={{
                background: "#e8f5e9",
                borderRadius: 12,
                padding: 15,
              }}
            >
              {Object.keys(title).map((key) => (
                <div key={key} style={{ marginBottom: 6 }}>
                  <b>{title[key]}: </b>
                  <textarea
                    style={inputStyle}
                    value={newData[key] || ""}
                    onChange={(e) =>
                      setNewData({
                        ...newData,
                        [key]: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              ))}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e)}
              />
              {preview && (
                <Image
                  src={preview}
                  width={120}
                  height={120}
                  alt="preview"
                  style={{ borderRadius: 10 }}
                />
              )}

              <button style={btnSave} onClick={addData}>
                Thêm
              </button>
              <button style={btnCancel} onClick={() => setNewData(null)}>
                Hủy
              </button>
            </div>
          )}
        </div>

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
const textStyle = {
  display: "inline-block",
  maxWidth: "100%",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const inputStyle = {
  width: 400,
  padding: 5,
  marginTop: 3,
  borderRadius: 5,
  border: "1px solid #ccc",
};

const btnEdit = {
  background: "#3498db",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
};

const btnDelete = {
  background: "#e74c3c",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
};

const btnSave = {
  background: "#27ae60",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
};

const btnCancel = {
  background: "gray",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
};
