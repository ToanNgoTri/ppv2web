"use client";
import Image from "next/image";
import styles from "../page.module.css";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Cột giữ nguyên chữ thường/hoa: URL in hoa lên là bấm vào không ra gì nữa,
// toạ độ cũng không có lý do gì phải đổi.
const KHONG_IN_HOA = ["LINKFOLDER", "LOCATION"];

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

// Cột boolean của bảng crime: nhãn hiển thị cho hai trạng thái.
// Gom một chỗ để phần hiển thị, phần sửa và phần thêm mới dùng chung.
const BOOLEAN_LABELS = {
  GIOITINH: { true: "Nam", false: "Nữ" },
  VANGNHA: { true: "Có", false: "Không" },
  ANNINH: { true: "Có", false: "Không" },
  MATUY: { true: "Có", false: "Không" },
  TUTHA: { true: "Có", false: "Không" },
  THACD: { true: "Có", false: "Không" },
  TIENSU: { true: "Có", false: "Không" },
};

// Phân loại đối tượng — lọc bằng ô bấm ở trên vùng tìm kiếm, không phải ô gõ
// chữ. Không bấm ô nào = không lọc = tìm tất cả.
const FLAG_LABELS = {
  ANNINH: "An ninh",
  MATUY: "Ma túy",
  TUTHA: "Tù tha",
  THACD: "THA CĐ",
  TIENSU: "Tiền sự",
};

// Cột chỉ để xem/sửa, không đưa vào ô "Chọn Dữ liệu" vì tìm theo nó vô nghĩa.
const KHONG_TIM = ["LINKFOLDER", "LOCATION"];

export default function Home() {
  const router = useRouter();

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

  // Trạng thái bật/tắt của các ô phân loại phía trên vùng tìm kiếm
  const [flags, setFlags] = useState(() =>
    Object.fromEntries(Object.keys(FLAG_LABELS).map((k) => [k, false])),
  );

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
    TENVO: "TÊN VỢ/CHỒNG",
    VANGNHA: "VẮNG NHÀ",
    ANNINH: "AN NINH",
    MATUY: "MA TÚY",
    TUTHA: "TÙ THA",
    THACD: "THA CĐ",
    TIENSU: "TIỀN SỰ",
    GHICHU: "GHI CHÚ",
    LINKFOLDER: "LINK HỒ SƠ",
    LOCATION: "TOẠ ĐỘ",
  };

  // Danh sách cột cho ô "Chọn Dữ liệu": bỏ các cột đã có ô bấm riêng.
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
          database: "crime",
          criteria: filters,
          flags,
          fuzzy: true,
        }),
      });

      if (!res.ok) throw new Error("Không thể kết nối máy chủ");

      const data = await res.json();

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
    try {
      let newDataConvert = upperFields(newData);

      // Cot boolean phai gui dung kieu true/false; o them moi da la o chon nen
      // gia tri co the da la boolean san, chi ep kieu cho chac.
      for (const key of Object.keys(BOOLEAN_LABELS)) {
        if (key in newDataConvert) {
          newDataConvert[key] =
            newDataConvert[key] === true ||
            String(newDataConvert[key]).toUpperCase() ===
              BOOLEAN_LABELS[key].true.toUpperCase();
        }
      }

      const imageUrl = await uploadImage(newData.CCCD);

      if (!imageUrl) {
        alert("Upload ảnh thất bại");
        return;
      }

      const res = await fetch("/api/addData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          database: "crime",
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

    let fixItem = upperFields(newFixData);

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
        .remove([`subject/${fileName}`]);

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
                    border: on ? "1px solid #198754" : "1px solid #ccc",
                    backgroundColor: on ? "#198754" : "#fafafa",
                    color: on ? "white" : "#495057",
                  }}
                >
                  {on ? "✓ " : ""}
                  {FLAG_LABELS[field]}
                </button>
              );
            })}
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
                  {searchFields.map((item) => (
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
          {data && data.length >= 1000 && (
            <span style={{ color: "#b45309", marginLeft: 8 }}>
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
                          BOOLEAN_LABELS[key] ? (
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
                              <option value="TRUE">
                                {BOOLEAN_LABELS[key].true}
                              </option>
                              <option value="FALSE">
                                {BOOLEAN_LABELS[key].false}
                              </option>
                            </select>
                          ) : ["NOITHTRU", "CHARGE", "JUDGMENT"].includes(
                              key,
                            ) ? (
                            <textarea
                              style={textInputStyle}
                              value={newFixData[key] || ""}
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <input
                              style={
                                KHONG_IN_HOA.includes(key)
                                  ? inputStyle
                                  : textInputStyle
                              }
                              value={newFixData[key] || ""}
                              onChange={(e) =>
                                setNewFixData({
                                  ...newFixData,
                                  [key]: e.target.value,
                                })
                              }
                            />
                          )
                        ) : BOOLEAN_LABELS[key] ? (
                          BOOLEAN_LABELS[key][item[key] ? "true" : "false"]
                        ) : key === "LOCATION" && item[key] ? (
                          <a
                            href={mapUrl(item[key])}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...textStyle, color: "#2563eb" }}
                          >
                            📍 {item[key]}
                          </a>
                        ) : key === "LINKFOLDER" && item[key] ? (
                          <a
                            href={item[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...textStyle, color: "#2563eb" }}
                          >
                            {item[key]}
                          </a>
                        ) : (
                          <span style={textStyle}>{item[key]}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* IMAGE */}
                  <div style={{ width: "30%" }}>
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
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e)}
                      />
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
                      {/* ✅ NÚT TẠO HỒ SƠ MỚI */}
                      <button
                        style={btnHoSo}
                        onClick={() =>
                          router.push(`/generatedocs?cccd=${item.CCCD}`)
                        }
                      >
                        📄 Hồ sơ
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
                  {BOOLEAN_LABELS[key] ? (
                    <select
                      style={inputStyle}
                      value={newData[key] === true ? "TRUE" : "FALSE"}
                      onChange={(e) =>
                        setNewData({
                          ...newData,
                          [key]: e.target.value === "TRUE",
                        })
                      }
                    >
                      <option value="FALSE">{BOOLEAN_LABELS[key].false}</option>
                      <option value="TRUE">{BOOLEAN_LABELS[key].true}</option>
                    </select>
                  ) : (
                    <textarea
                      style={
                        KHONG_IN_HOA.includes(key) ? inputStyle : textInputStyle
                      }
                      value={newData[key] || ""}
                      onChange={(e) =>
                        setNewData({
                          ...newData,
                          [key]: e.target.value,
                        })
                      }
                    />
                  )}
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
                TENKHAC: "",
                NAMSINH: "",
                GIOITINH: false,
                DANTOC: "",
                TONGIAO: "",
                CCCD: "",
                SOHOK: "",
                NOITHTRU: "",
                TENCHA: "",
                TENME: "",
                TENVO: "",
                CHARGE: "",
                JUDGMENT: "",
                DETENTION: "",
                DAYARRES: "",
                FREEDAY: "",
                VANGNHA: false,
                ANNINH: false,
                MATUY: false,
                TUTHA: false,
                THACD: false,
                TIENSU: false,
                GHICHU: "",
                LINKFOLDER: "",
                LOCATION: "",
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

// Ô nhập chữ: chỉ hiển thị in hoa bằng CSS, giá trị thật giữ nguyên như gõ
const textInputStyle = { ...inputStyle, textTransform: "uppercase" };

const btnEdit = {
  background: "#3498db",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};

const btnDelete = {
  background: "#e74c3c",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};

const btnSave = {
  background: "#27ae60",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};

const btnCancel = {
  background: "gray",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};

const btnHoSo = {
  background: "#10b981",
  color: "white",
  padding: "5px 10px",
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};
