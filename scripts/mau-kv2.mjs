/**
 * Tạo file mẫu public/templates/KV2.docx — sổ hộ gia đình theo mẫu KV2.
 *
 * Bố cục để ĐÓNG CUỐN: mỗi hộ chiếm MỘT CẶP TRANG ĐỐI DIỆN (A4 ngang).
 *   - Trang trái : cột (1)–(10)  TT, họ tên, quan hệ, ngày sinh, quê quán,
 *                  CCCD, dân tộc, quốc tịch, tôn giáo
 *   - Trang phải : cột (11)–(18), KHÔNG lặp TT + họ tên (đóng gáy là dòng hai
 *                  trang ngang nhau); số dòng 1–20 in ngay sau Ghi chú, ngoài
 *                  bảng, không kẻ ô
 *   - Lề đối xứng (mirror margins) + gutter 1,5 cm ở phía gáy.
 *   - File KHÔNG chứa bìa (trang 1) và trang Cán bộ quản lý (trang 2) — hai
 *     trang đó in riêng từ public/templates/KV2-trang-1-bia.docx
 *     và KV2-trang-2-can-bo-quan-ly.docx (sửa trực tiếp trong Word). Số trang của file này ĐÁNH
 *     TỪ 3. Word xếp lề gáy theo số trang chẵn/lẻ (trang chẵn = trang trái).
 *   - MỤC LỤC ở đầu sổ theo mẫu in sẵn: hai khối cạnh nhau, mỗi khối TT / Họ
 *     tên chủ hộ / Hộ gia đình-diện cư trú khác / Trang, 20 dòng mỗi khối =
 *     40 hộ một trang. Mục lục bắt đầu ở trang 3 (lẻ), nên script xuất đệm cho
 *     số trang mục lục LUÔN LẺ để hộ đầu tiên rơi vào trang chẵn (trang trái).
 *   - Mọi hàng của bảng (kể cả hàng tiêu đề) khoá chiều cao cứng, nên 20 dòng
 *     của trang trái và trang phải nằm ngang nhau khi mở sổ.
 *
 * File mẫu dựng bằng code để bề rộng cột, chiều cao dòng là số chính xác —
 * cộng lại vừa đúng một trang. Tạo xong có thể mở Word sửa chữ, font; chỉ cần
 * GIỮ NGUYÊN các thẻ {…} thì scripts/xuat-so-ho.mjs vẫn điền được.
 *
 * Thẻ docxtemplater trong mẫu:
 *   {#ML} … {/ML}            lặp theo trang mục lục; {#CHUA_DAU}…{/CHUA_DAU} ngắt
 *                            trang trước mọi trang trừ trang đầu
 *   {#DONG} … {/DONG}        một dòng mục lục: {TT1} {TEN1} {LOAI1} {TRANG1}
 *                            (khối trái) {TT2} {TEN2} {LOAI2} {TRANG2} (khối phải)
 *   {#HO} … {/HO}            lặp theo hộ (mỗi hộ = cặp trang)
 *   {CHUHO} {SOHOK} {DIACHI}  dòng đầu trang (in ở cả hai trang)
 *   {#NK} … {/NK}            lặp theo nhân khẩu — một dòng bảng, dùng ở cả hai bảng
 *   {TT} {HOTEN} {QUANHE} {NAM} {NU} {QUEQUAN} {CCCD} {DANTOC} {QUOCTICH}
 *   {TONGIAO} {NGHENGHIEP} {ODAUDEN} {CHUYENDI} {THAIDO} {THUCTE} {QHXH}
 *   {SDT} {GHICHU} {SO}      SO = số dòng trên trang phải, có cả ở dòng trống
 *   {#XOA}…{/XOA} / {^XOA}…{/XOA}  mỗi ô dòng nhân khẩu có hai bản: bản GẠCH
 *                            NGANG (nhân khẩu đã xóa, DELETED = true) và bản
 *                            thường — docxtemplater chỉ giữ lại một bản
 *
 * Chạy riêng:  node scripts/mau-kv2.mjs   → ghi public/templates/KV2.docx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DUONG_DAN_MAU = path.join(__dirname, '..', 'public', 'templates', 'KV2.docx')

/** Số dòng nhân khẩu trên một cặp trang — đúng như mẫu giấy. */
export const DONG_MOI_TRANG = 20

/** Mục lục: 20 dòng mỗi khối, hai khối một trang. */
export const DONG_MUC_LUC_MOI_KHOI = 20
export const HO_MUC_LUC_MOI_TRANG = DONG_MUC_LUC_MOI_KHOI * 2

/** Số trang (in ở chân trang) của trang mục lục đầu tiên: bìa = 1, Cán bộ quản lý = 2. */
export const TRANG_DAU = 3
/** Số trang của trang trái hộ thứ i (0-based), sau `soTrangMucLuc` trang mục lục. */
export const trangCuaCapThu = (i, soTrangMucLuc) => TRANG_DAU + soTrangMucLuc + 2 * i

// ---- Kích thước (đơn vị twip = 1/20 pt; 567 twip = 1 cm) --------------------
const TRANG = { w: 16838, h: 11906 }          // A4 ngang
// Lề: trên/dưới 0,7 cm; trái/phải 1 cm; gutter 1,5 cm cộng thêm vào phía gáy
// (Word tự đổi bên theo trang chẵn/lẻ nhờ mirrorMargins trong settings.xml).
const LE = { top: 400, bottom: 400, left: 567, right: 567, gutter: 850 }
export const RONG_BANG = TRANG.w - LE.left - LE.right - LE.gutter // 14854

/**
 * 18 cột theo đúng thứ tự mẫu, chia hai trang. `so` là số cột in ở hàng (n).
 * Bề rộng mỗi trang cộng lại phải = RONG_BANG.
 */
const COT_TT = { w: 450, tag: 'TT', tieuDe: 'TT', so: 1 }
const COT_TRAI = [
  COT_TT,
  { w: 2800, tag: 'HOTEN',    tieuDe: 'Họ và tên', so: 2 },
  { w: 1150, tag: 'QUANHE',   tieuDe: 'Quan hệ với chủ hộ/người đại diện', so: 3 },
  { w: 1150, tag: 'NAM',      tieuDe: 'Nam', so: 4, nhom: 'Ngày, tháng, năm sinh' },
  { w: 1150, tag: 'NU',       tieuDe: 'Nữ',  so: 5, nhom: 'Ngày, tháng, năm sinh' },
  { w: 3000, tag: 'QUEQUAN',  tieuDe: 'Quê quán', so: 6 },
  { w: 1504, tag: 'CCCD',     tieuDe: 'Số định danh cá nhân/căn cước/ Số giấy tờ tùy thân khác còn giá trị sử dụng', so: 7 },
  { w: 1100, tag: 'DANTOC',   tieuDe: 'Dân tộc', so: 8 },
  { w: 1150, tag: 'QUOCTICH', tieuDe: 'Quốc tịch', so: 9 },
  { w: 1400, tag: 'TONGIAO',  tieuDe: 'Tôn giáo', so: 10 },
]
// Trang phải không lặp TT + họ tên: đóng gáy là dòng hai trang đã ngang nhau.
// Thay vào đó cột SO cuối cùng in số dòng ngay sau Ghi chú, không kẻ viền (ngoaiBang).
const COT_PHAI = [
  { w: 2250, tag: 'NGHENGHIEP', tieuDe: 'Nghề nghiệp, nơi làm việc', so: 11 },
  { w: 2050, tag: 'ODAUDEN',    tieuDe: 'Ở đâu đến, ngày đến, mục đích', so: 12 },
  { w: 2050, tag: 'CHUYENDI',   tieuDe: 'Chuyển đi đâu, ngày đi, mục đích', so: 13 },
  { w: 1200, tag: 'THAIDO',     tieuDe: 'Thái độ chính trị', so: 14 },
  { w: 2100, tag: 'THUCTE',     tieuDe: 'Thực tế sinh sống nhưng không đủ điều kiện đăng ký thường trú, tạm trú, chưa khai báo thông tin cư trú', so: 15 },
  { w: 1700, tag: 'QHXH',       tieuDe: 'Quan hệ xã hội cần chú ý (nếu có)', so: 16 },
  { w: 1200, tag: 'SDT',        tieuDe: 'Số điện thoại', so: 17 },
  // Ghi chú cỡ chữ nhỏ hơn: dòng khoá chiều cao nên chỉ hiện được ~2 dòng chữ
  { w: 1904, tag: 'GHICHU',     tieuDe: 'Ghi chú', so: 18, sz: 14 },
  { w: 400,  tag: 'SO',         ngoaiBang: true },
]
for (const [ten, cot] of [['trái', COT_TRAI], ['phải', COT_PHAI]]) {
  const tong = cot.reduce((s, c) => s + c.w, 0)
  if (tong !== RONG_BANG) throw new Error(`Bề rộng cột trang ${ten} cộng lại ${tong}, phải bằng ${RONG_BANG}`)
}

const CO_CHU_DU_LIEU = 18   // 9 pt
const CO_CHU_TIEU_DE = 16   // 8 pt
// Chiều cao KHOÁ CỨNG (exact) của từng hàng — giống nhau ở hai trang để dòng
// bên trái và bên phải nằm ngang nhau. Tổng: 1200+300+260 + 20×440 = 10560 twip,
// cộng dòng đầu trang ~380 là vừa 11106 twip khả dụng.
const CAO_TIEU_DE = [1200, 300, 260]
export const CAO_DONG = 440

// ---- Tiện ích XML -----------------------------------------------------------
export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function run(text, { sz = CO_CHU_DU_LIEU, dam = false, nghieng = false, gach = false } = {}) {
  const rPr = `<w:rPr>${dam ? '<w:b/>' : ''}${nghieng ? '<w:i/>' : ''}${gach ? '<w:strike/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}
export const NGAT_TRANG = '<w:r><w:br w:type="page"/></w:r>'

export function p(runs, { giua = false, pPr = '' } = {}) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${giua ? '<w:jc w:val="center"/>' : ''}${pPr}</w:pPr>${runs}</w:p>`
}

const VIEN_DON = (c) => `<w:${c} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`
const VIEN = '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].map(VIEN_DON).join('') + '</w:tcBorders>'
/** Ô nằm ngoài bảng: chỉ giữ viền trái (cũng là viền phải của ô bên cạnh). */
const VIEN_NGOAI = '<w:tcBorders>' + VIEN_DON('left')
  + ['top', 'bottom', 'right'].map((c) => `<w:${c} w:val="nil"/>`).join('') + '</w:tcBorders>'

export function tc(noiDung, w, { span = 1, vMerge = null, giua = true, ngoai = false } = {}) {
  const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>`
    + (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '')
    + (vMerge ? `<w:vMerge${vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : '')
    + (ngoai ? VIEN_NGOAI : VIEN)
    + '<w:vAlign w:val="center"/></w:tcPr>'
  return `<w:tc>${tcPr}${p(noiDung, { giua })}</w:tc>`
}

export function tr(cells, { cao = null, exact = true, tieuDe = false } = {}) {
  const trPr = '<w:trPr>'
    + (cao ? `<w:trHeight w:val="${cao}" w:hRule="${exact ? 'exact' : 'atLeast'}"/>` : '')
    + (tieuDe ? '<w:tblHeader/>' : '')
    + '<w:cantSplit/></w:trPr>'
  return `<w:tr>${trPr}${cells.join('')}</w:tr>`
}

export function tblPr(rong) {
  return '<w:tblPr>'
    + `<w:tblW w:w="${rong}" w:type="dxa"/>`
    + '<w:tblLayout w:type="fixed"/>'
    + '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="57" w:type="dxa"/>'
    + '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar>'
    + '</w:tblPr>'
}
export const tblGrid = (cot) => '<w:tblGrid>' + cot.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('') + '</w:tblGrid>'

// ---- Bảng nhân khẩu (một trang) --------------------------------------------------
function bangNhanKhau(COT) {
  const td = (t) => run(t, { sz: CO_CHU_TIEU_DE, dam: true })

  // Hàng tiêu đề 1: nhóm (Ngày, tháng, năm sinh) gộp ngang; cột khác gộp dọc xuống hàng 2.
  const hang1 = []
  for (let i = 0; i < COT.length; i++) {
    const c = COT[i]
    if (c.ngoaiBang) {
      hang1.push(tc('', c.w, { ngoai: true }))
    } else if (c.nhom) {
      if (i > 0 && COT[i - 1].nhom === c.nhom) continue
      const cacCot = COT.filter((x) => x.nhom === c.nhom)
      hang1.push(tc(td(c.nhom), cacCot.reduce((s, x) => s + x.w, 0), { span: cacCot.length }))
    } else {
      hang1.push(tc(td(c.tieuDe), c.w, { vMerge: 'restart' }))
    }
  }
  const hang2 = COT.map((c) => c.ngoaiBang
    ? tc('', c.w, { ngoai: true })
    : c.nhom
      ? tc(td(c.tieuDe), c.w)
      : tc('', c.w, { vMerge: 'continue' }))
  const hang3 = COT.map((c) => c.ngoaiBang
    ? tc('', c.w, { ngoai: true })
    : tc(run(`(${c.so})`, { sz: CO_CHU_TIEU_DE }), c.w))

  // Hàng dữ liệu: {#NK} ở ô đầu, {/NK} ở ô cuối → docxtemplater lặp cả hàng.
  // Mỗi ô có hai run: run gạch ngang chỉ hiện khi nhân khẩu đã xóa (XOA), run
  // thường hiện trong trường hợp còn lại — gạch ngang thì gạch cả dòng.
  // Số dòng ngoài bảng không phải dữ liệu nên không gạch.
  const hangDuLieu = COT.map((c, i) => {
    const sz = c.sz || CO_CHU_DU_LIEU
    const noiDung = (i === 0 ? run('{#NK}', { sz }) : '')
      + (c.ngoaiBang
        ? run(`{${c.tag}}`, { sz })
        : run(`{#XOA}{${c.tag}}{/XOA}`, { sz, gach: true }) + run(`{^XOA}{${c.tag}}{/XOA}`, { sz }))
      + (i === COT.length - 1 ? run('{/NK}', { sz }) : '')
    return tc(noiDung, c.w, { giua: c.tag !== 'HOTEN', ngoai: c.ngoaiBang })
  })

  return `<w:tbl>${tblPr(RONG_BANG)}${tblGrid(COT)}`
    + tr(hang1, { cao: CAO_TIEU_DE[0], tieuDe: true })
    + tr(hang2, { cao: CAO_TIEU_DE[1], tieuDe: true })
    + tr(hang3, { cao: CAO_TIEU_DE[2], tieuDe: true })
    + tr(hangDuLieu, { cao: CAO_DONG })
    + '</w:tbl>'
}

/** Dòng đầu trang hộ, luôn mở đầu bằng ngắt trang (trước đó luôn có mục lục). */
function dauTrangHo() {
  const nhan = (t) => run(t, { sz: 22, dam: true })
  const gt = (t) => run(t, { sz: 22 })
  const tab = '<w:r><w:tab/></w:r>'
  const pPr = '<w:tabs><w:tab w:val="left" w:pos="5900"/><w:tab w:val="left" w:pos="10000"/></w:tabs>'
    + '<w:spacing w:before="0" w:after="120"/>'
  return `<w:p><w:pPr>${pPr}</w:pPr>${NGAT_TRANG}`
    + nhan('Hộ gia đình/diện cư trú khác: ') + gt('{CHUHO}') + tab
    + nhan('Số hồ sơ cư trú: ') + gt('{SOHOK}') + tab
    + nhan('Địa chỉ cư trú: ') + gt('{DIACHI}')
    + '</w:p>'
}

// ---- Mục lục đầu sổ (theo mẫu in sẵn) ----------------------------------------------
const NUA = RONG_BANG / 2 // 7427 — mỗi khối một nửa trang
const COT_MUC_LUC = [
  { w: 500,  tag: 'TT',    tieuDe: 'TT', so: 1 },
  { w: 3300, tag: 'TEN',   tieuDe: 'Họ và tên chủ hộ/người đại diện', so: 2, trai: true },
  { w: 2200, tag: 'LOAI',  tieuDe: 'Hộ gia đình/ diện cư trú khác', so: 3 },
  { w: 1427, tag: 'TRANG', tieuDe: 'Trang', so: 4 },
]
{
  const tong = COT_MUC_LUC.reduce((s, c) => s + c.w, 0)
  if (tong !== NUA) throw new Error(`Bề rộng cột mục lục cộng lại ${tong}, phải bằng ${NUA}`)
}
function mucLuc() {
  const haiKhoi = [
    ...COT_MUC_LUC.map((c) => ({ ...c, tag: c.tag + '1' })),
    ...COT_MUC_LUC.map((c) => ({ ...c, tag: c.tag + '2' })),
  ]
  const hang1 = haiKhoi.map((c) => tc(run(c.tieuDe, { sz: 22, dam: true }), c.w))
  const hang2 = haiKhoi.map((c) => tc(run(`(${c.so})`, { sz: 20 }), c.w))
  const hang = haiKhoi.map((c, i) => {
    let t = `{${c.tag}}`
    if (i === 0) t = '{#DONG}' + t
    if (i === haiKhoi.length - 1) t = t + '{/DONG}'
    return tc(run(t, { sz: 20 }), c.w, { giua: !c.trai })
  })
  const tieuDe = '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>'
    + `${run('{#CHUA_DAU}')}${NGAT_TRANG}${run('{/CHUA_DAU}')}${run('MỤC LỤC', { sz: 28, dam: true })}</w:p>`
  return p(run('{#ML}'))
    + tieuDe
    + `<w:tbl>${tblPr(RONG_BANG)}${tblGrid(haiKhoi)}`
    + tr(hang1, { cao: 700, tieuDe: true })
    + tr(hang2, { cao: 260, tieuDe: true })
    + tr(hang, { cao: CAO_DONG })
    + '</w:tbl>'
    + p(run('{/ML}'))
}

// ---- Trang ---------------------------------------------------------------------------
const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

/**
 * Thiết lập trang dùng chung cho mọi file của bộ sổ: A4 ngang, lề đối xứng có
 * gutter, số trang bắt đầu từ `trangDau`, chân trang ghi số trang nếu `coChanTrang`.
 */
export function sectPrXml({ trangDau, coChanTrang }) {
  return '<w:sectPr>'
    + (coChanTrang ? '<w:footerReference w:type="default" r:id="rIdFooter"/>' : '')
    + `<w:pgSz w:w="${TRANG.w}" w:h="${TRANG.h}" w:orient="landscape"/>`
    + `<w:pgMar w:top="${LE.top}" w:right="${LE.right}" w:bottom="${LE.bottom}" w:left="${LE.left}" w:header="0" w:footer="200" w:gutter="${LE.gutter}"/>`
    + `<w:pgNumType w:start="${trangDau}"/>`
    + '</w:sectPr>'
}

function documentXml() {
  return '<w:body>'
    + mucLuc()
    + p(run('{#HO}'))
    + dauTrangHo() + bangNhanKhau(COT_TRAI)
    + dauTrangHo() + bangNhanKhau(COT_PHAI)
    + p(run('{/HO}'))
    // Đoạn kết thúc bắt buộc sau bảng cuối, thu nhỏ hết cỡ để không tràn thêm một trang trắng.
    + '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'
    + sectPrXml({ trangDau: TRANG_DAU, coChanTrang: true })
    + '</w:body>'
}

/** Chân trang: số trang, canh giữa — để tra mục lục. */
const FOOTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + `<w:ftr ${NS_W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>`
  + '<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">Trang </w:t></w:r>'
  + '<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>'
  + '</w:p></w:ftr>'

/** mirrorMargins: lề trong/ngoài đổi bên theo trang chẵn/lẻ, gutter luôn ở phía gáy. */
const SETTINGS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + `<w:settings ${NS_W}><w:mirrorMargins/></w:settings>`

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + `<w:styles ${NS_W}>`
  + '<w:docDefaults><w:rPrDefault><w:rPr>'
  + '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>'
  + `<w:sz w:val="${CO_CHU_DU_LIEU}"/><w:szCs w:val="${CO_CHU_DU_LIEU}"/><w:lang w:val="vi-VN"/>`
  + '</w:rPr></w:rPrDefault>'
  + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
  + '</w:docDefaults>'
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
  + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>'
  + '<w:tblPr><w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
  + '</w:styles>'

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
  + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
  + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
  + '</Types>'

const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>'

const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
  + '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
  + '</Relationships>'

/**
 * Đóng gói một `<w:body>…</w:body>` (đã có sectPr, xem sectPrXml) thành file
 * .docx hoàn chỉnh với font, lề đối xứng và chân trang của bộ sổ.
 * @returns {Buffer}
 */
export function dongGoiDocx(bodyXml) {
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<w:document ${NS_W} ${NS_R}>${bodyXml}</w:document>`)
  zip.file('word/_rels/document.xml.rels', DOC_RELS)
  zip.file('word/styles.xml', STYLES)
  zip.file('word/settings.xml', SETTINGS)
  zip.file('word/footer1.xml', FOOTER)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** @returns {Buffer} file .docx mẫu */
export function taoMauKV2() {
  return dongGoiDocx(documentXml())
}

export function ghiMauKV2(duongDan = DUONG_DAN_MAU) {
  fs.mkdirSync(path.dirname(duongDan), { recursive: true })
  fs.writeFileSync(duongDan, taoMauKV2())
  return duongDan
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Đã ghi mẫu:', ghiMauKV2())
}
