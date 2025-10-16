"use client";
import Image from "next/image";
import styles from "../page.module.css";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";

export default function Home() {
  const [data, setData] = useState([]);
  const [input1, setinput1] = useState("");
  const [input2, setinput2] = useState("");
  const [input3, setinput3] = useState("");

  const [select1, setSelect1] = useState("HOTEN");
  const [select2, setSelect2] = useState("HOTEN");
  const [select3, setSelect3] = useState("HOTEN");

  const [newData, setNewData] = useState([]);
  const [newFixData, setNewFixData] = useState([]);

  const [fixDataIndex, setFixDataIndex] = useState(null);

  // const data = await res.json()
  // console.log(data)

  // const supabase = createClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL,
  //   process.env.SUPABASE_SERVICE_ROLE_KEY // chỉ dùng server
  // );

  async function search() {
    let filters = {};
    if (input1 !== "") filters[select1] = input1;
    if (input2 !== "") filters[select2] = input2;
    if (input3 !== "") filters[select3] = input3;

    let supabase = await fetch("/api/searchData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: "crime",
        criteria: filters,
      }),
    });
    // console.log(supabase);
    const data = await supabase.json();
    console.log('data',data);
    

    // const { data, error } = await supabase
    //   .from("crime")
    //   .select("*")
    //   .match(filters);
    setData(data);
    // console.log("data", data);
  }

  function reset() {
    setinput1("");
    setinput2("");
    setinput3("");
    setSelect1("HOTEN");
    setSelect2("HOTEN");
    setSelect3("HOTEN");
  }

  async function addData() {
    let supabase = await fetch("/api/addData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: "crime",
        newData,
      }),
    });

    // let error = await supabase

    // const { dataPP, error } = await supabase.from("crime").insert(newData);
    // if (error) {
    //   alert("Lỗi thêm dữ liệu: " + error.message);
    // } else {
    alert("Thêm dữ liệu thành công");
    setNewData([]);
    console.log("supabase", supabase);
    console.log("newData", newData);

    setData(data?.length ? [...data, ...newData] : [...newData]);
    // }
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

    // const { dt, error } = await supabase
    //   .from("crime")
    //   .delete()
    //   .eq("CCCD", cccd);
    // if (error) {
    //   alert("Lỗi xóa dữ liệu: " + error.message);
    // } else {
    alert("Xóa dữ liệu thành công");
    setData(data && data.filter((item) => item.CCCD !== cccd));
    // }
  }

  async function fixData(cccd) {
    if (fixDataIndex === null) return;
    console.log("data", data);

    const fixItem = newFixData;

    let supabase = await fetch("/api/fixData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        database: "crime",
        CCCD: cccd,
        newData:fixItem
      }),
    });
    // console.log('supabase',supabase);
    

    // const { dt, error } = await supabase
    //   .from("crime")
    //   .update(fixItem)
    //   .eq("CCCD", cccd);
    // if (error) {
    //   alert("Lỗi chỉnh sửa dữ liệu: " + error.message);
    // } else {
    alert("Chỉnh sửa dữ liệu thành công");
    const updatedData = data;
    updatedData[fixDataIndex] = fixItem;
    setData(updatedData);
    setFixDataIndex(null);
    setNewFixData([]);
    // }
  }

  useEffect(() => {
    console.log("fixDataIndex", fixDataIndex);
    console.log("newFixData", newFixData);
  });

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div
          style={{
            marginBottom: 20,
            flexDirection: "column",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{ marginBottom: 20, fontSize: 40, fontFamily: "cursive" }}
          >
            CÔNG CỤ TÌM KIẾM DÂN CƯ
          </div>
          <div
            style={{
              marginBottom: 20,
              flexDirection: "row",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label>Chọn Dữ liệu:</label>
            <select
              value={select1}
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              onChange={(e) => setSelect1(e.target.value)}
            >
              <option value="HOTEN" defaultValue={"HOTEN"}>
                HỌ VÀ TÊN
              </option>
              <option value="NAMSINH">NGÀY SINH</option>
              <option value="TODPHO">NƠI THƯỜNG TRÚ</option>
              <option value="DANTOC">DÂN TỘC</option>
              <option value="TONGIAO">TÔN GIÁO</option>
              <option value="CCCD">CCCD</option>
              <option value="TENCHA">TÊN CHA</option>
              <option value="TENME">TÊN MẸ</option>
              <option value="SOHOK">SỐ HSHK</option>
              <option value="CHARGE">TỘI DANH</option>
              <option value="JUDGMENT">HÌNH PHẠT</option>
              <option value="DETENTION">NƠI CH</option>
              <option value="DAYARRES">NGÀY BẮT</option>
              <option value="FREEDAY">NGÀY XONG</option>
            </select>
            <input
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              value={input1}
              onChange={(e) => setinput1(e.target.value)}
              placeholder="Họ và tên"
            />
          </div>
          <div
            style={{
              marginBottom: 20,
              flexDirection: "row",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label>Chọn Dữ liệu:</label>
            <select
              value={select2}
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              onChange={(e) => setSelect2(e.target.value)}
            >
              <option value="HOTEN">HỌ VÀ TÊN</option>
              <option value="NAMSINH">NGÀY SINH</option>
              <option value="NOITHTRU">NƠI THƯỜNG TRÚ</option>
              <option value="DANTOC">DÂN TỘC</option>
              <option value="TONGIAO">TÔN GIÁO</option>
              <option value="TENCHA">TÊN CHA</option>
              <option value="TENME">TÊN MẸ</option>
              <option value="SOHOK">SỐ HSHK</option>
            </select>
            <input
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              value={input2}
              onChange={(e) => setinput2(e.target.value)}
              placeholder="Năm sinh"
            />
          </div>
          <div
            style={{
              marginBottom: 20,
              flexDirection: "row",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label>Chọn Dữ liệu:</label>
            <select
              value={select3}
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              onChange={(e) => setSelect3(e.target.value)}
            >
              <option value="HOTEN">HỌ VÀ TÊN</option>
              <option value="NAMSINH">NGÀY SINH</option>
              <option value="NOITHTRU">NƠI THƯỜNG TRÚ</option>
              <option value="DANTOC">DÂN TỘC</option>
              <option value="TONGIAO">TÔN GIÁO</option>
              <option value="TENCHA">TÊN CHA</option>
              <option value="TENME">TÊN MẸ</option>
              <option value="SOHOK">SỐ HSHK</option>
              <option value="CHARGE">TỘI DANH</option>
              <option value="JUDGMENT">HÌNH PHẠT</option>
              <option value="DETENTION">NƠI CHẤP HÀNH</option>
              <option value="DAYARRES">NGÀY BẮT</option>
              <option value="FREEDAY">NGÀY CHẤP HÀNH XONG</option>
            </select>
            <input
              style={{ padding: 10, fontSize: 16, marginLeft: 20 }}
              value={input3}
              onChange={(e) => setinput3(e.target.value)}
              placeholder="Số hộ khẩu"
            />
          </div>
        </div>
        <div style={{ justifyContent: "center", display: "flex" }}>
          <button onClick={() => reset()}>Xóa dữ liệu</button>

          <button
            style={{
              padding: 10,
              fontSize: 16,
              backgroundColor: "blue",
              color: "white",
              borderRadius: 5,
              cursor: "pointer",
              marginLeft: 20,
            }}
            onClick={() => search()}
          >
            Tìm kiếm
          </button>
        </div>
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          Tìm thấy {data && data.length} kết quả
        </div>
        <table>
          <tbody>
            <tr>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                }}
              >
                STT
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                Họ và tên
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                NGÀY SINH
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 30,
                  textAlign: "center",
                }}
              >
                GIỚI TÍNH
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                DÂN TỘC
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                TÔN GIÁO
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                CCCD
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                NƠI THƯỜNG TRÚ
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                TÊN CHA
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  textAlign: "center",
                }}
              >
                TÊN MẸ
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 30,
                  textAlign: "center",
                }}
              >
                SOHOK
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                TỘI DANH
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                HÌNH PHẠT
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                NƠI CHẤP HÀNH
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                NGÀY BẮT
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                NGÀY CHẤP HÀNH XONG
              </td>
              <td
                style={{
                  borderWidth: 1,
                  borderColor: "white",
                  borderStyle: "solid",
                  padding: 5,
                  width: 50,
                  textAlign: "center",
                }}
              >
                Chức năng
              </td>
            </tr>

            {data &&
              data.map((item, i) =>
                fixDataIndex == i ? (
                  <tr key={i}>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        textAlign: "center",
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.HOTEN}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, HOTEN: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.NAMSINH}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, NAMSINH: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.GIOITINH}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii
                                ? {
                                    ...d,
                                    GIOITINH: e.target.value.match(/nam/gim)
                                      ? true
                                      : false,
                                  }
                                : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.DANTOC}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, DANTOC: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.TONGIAO}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, TONGIAO: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.CCCD}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, CCCD: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.NOITHTRU}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, NOITHTRU: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.TENCHA}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, TENCHA: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.TENME}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, TENME: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.SOHOK}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, SOHOK: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.CHARGE}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, CHARGE: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.JUDGMENT}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, JUDGMENT: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.DETENTION}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, DETENTION: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.DETENTION}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, DETENTION: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.DAYARRES}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, DAYARRES: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                      }}
                    >
                      <input
                        style={{
                          padding: 5,
                          fontSize: 12,
                          width: "100%",
                          height: 40,
                        }}
                        value={newFixData.FREEDAY}
                        onChange={(e) => {
                          setNewFixData(
                            data.map((d, ii) =>
                              i === ii ? { ...d, FREEDAY: e.target.value } : d
                            )[i]
                          );
                        }}
                      ></input>
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                        }}
                      >
                        <button
                          style={{
                            fontSize: 12,
                            backgroundColor: "blue",
                            color: "white",
                            borderRadius: 5,
                            cursor: "pointer",
                            marginRight: 5,
                            width: 70,
                          }}
                          onClick={() => setFixDataIndex(i)}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          style={{
                            padding: 5,
                            fontSize: 12,
                            backgroundColor: "red",
                            color: "white",
                            borderRadius: 5,
                            cursor: "pointer",
                            width: 70,
                          }}
                          onClick={() => deleteData(item.CCCD)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                    <td>
                      {fixDataIndex == i && (
                        <div>
                          <button
                            onClick={() => fixData(data[fixDataIndex].CCCD)}
                          >
                            Xác nhận chỉnh sửa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                        textAlign: "center",
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.HOTEN}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.NAMSINH}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.GIOITINH ? "Nam" : "Nữ"}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.DANTOC}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.TONGIAO}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.CCCD}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.NOITHTRU}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.TENCHA}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.TENME}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.SOHOK}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.CHARGE}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.JUDGMENT}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.DETENTION}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.DAYARRES}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      {item.FREEDAY}
                    </td>
                    <td
                      style={{
                        borderWidth: 1,
                        borderColor: "white",
                        borderStyle: "solid",
                        padding: 5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                        }}
                      >
                        <button
                          style={{
                            fontSize: 12,
                            backgroundColor: "blue",
                            color: "white",
                            borderRadius: 5,
                            cursor: "pointer",
                            marginRight: 5,
                            width: 70,
                          }}
                          onClick={() => {
                            setFixDataIndex(i);
                            setNewFixData({ ...item });
                          }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          style={{
                            padding: 5,
                            fontSize: 12,
                            backgroundColor: "red",
                            color: "white",
                            borderRadius: 5,
                            cursor: "pointer",
                            width: 70,
                          }}
                          onClick={() => deleteData(item.CCCD)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                    <td>
                      {fixDataIndex == i && (
                        <div>
                          <button
                            onClick={() =>
                              setNewData([
                                {
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
                                },
                              ])
                            }
                          >
                            Xác nhận chỉnh sửa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              )}

            {newData &&
              newData.map((item, index) => (
                <tr key={index}>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                      padding: 5,
                    }}
                  >
                    {data && data.length + 1}
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.HOTEN}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, HOTEN: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.NAMSINH}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, NAMSINH: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.GIOITINH}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index
                              ? {
                                  ...d,
                                  GIOITINH: e.target.value.match(/nam/gim)
                                    ? true
                                    : false,
                                }
                              : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.DANTOC}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, DANTOC: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.TONGIAO}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, TONGIAO: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.CCCD}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, CCCD: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.NOITHTRU}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, NOITHTRU: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.TENCHA}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, TENCHA: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.TENME}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, TENME: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.SOHOK}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, SOHOK: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.QUANHE}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, QUANHE: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.CHARGE}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, CHARGE: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.JUDGMENT}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, JUDGMENT: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.DETENTION}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, DETENTION: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.DAYARRES}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, DAYARRES: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <td
                    style={{
                      borderWidth: 1,
                      borderColor: "white",
                      borderStyle: "solid",
                    }}
                  >
                    <input
                      style={{ padding: 5, fontSize: 12, width: "100%" }}
                      value={newData.FREEDAY}
                      onChange={(e) => {
                        setNewData(
                          newData.map((d, i) =>
                            i === index ? { ...d, FREEDAY: e.target.value } : d
                          )
                        );
                      }}
                    ></input>
                  </td>
                  <button
                    style={{
                      padding: 5,
                      fontSize: 12,
                      marginTop: 5,
                      backgroundColor: "green",
                      color: "white",
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                    onClick={() => addData()}
                  >
                    Thêm
                  </button>
                </tr>
              ))}
          </tbody>
        </table>
        <div>
          <button
            onClick={() =>
              setNewData([
                {
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
                },
              ])
            }
          >
            Thêm dữ liệu
          </button>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
