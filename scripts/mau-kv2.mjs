/**
 * Tạo file mẫu public/templates/KV2.docx — sổ hộ gia đình theo mẫu KV2
 * (một hộ một trang A4 ngang, bảng 18 cột, 20 dòng).
 *
 * File mẫu được dựng bằng code chứ không vẽ tay trong Word, để bề rộng cột và
 * chiều cao dòng là con số chính xác — cộng lại vừa đúng một trang. Sau khi
 * tạo xong, mở bằng Word chỉnh font/cỡ chữ tuỳ ý; chỉ cần GIỮ NGUYÊN các thẻ
 * {…} thì scripts/xuat-so-ho.mjs vẫn điền được.
 *
 * Các thẻ docxtemplater trong mẫu:
 *   {#HO} … {/HO}              lặp theo hộ (mỗi hộ một trang)
 *   {#CHUA_DAU}…{/CHUA_DAU}    ngắt trang trước mọi hộ trừ hộ đầu tiên
 *   {CHUHO} {SOHOK} {DIACHI}   dòng đầu trang
 *   {#NK} … {/NK}              lặp theo nhân khẩu — một dòng bảng
 *   {TT} {HOTEN} {QUANHE} {NAM} {NU} {QUEQUAN} {CCCD} {DANTOC} {QUOCTICH}
 *   {TONGIAO} {NGHENGHIEP} {ODAUDEN} {CHUYENDI} {THAIDO} {THUCTE} {QHXH}
 *   {SDT} {GHICHU}
 *
 * Chạy riêng:  node scripts/mau-kv2.mjs   → ghi public/templates/KV2.docx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DUONG_DAN_MAU = path.join(__dirname, '..', 'public', 'templates', 'KV2.docx')

/** Số dòng nhân khẩu trên một trang — đúng như mẫu giấy. */
export const DONG_MOI_TRANG = 20

// ---- Kích thước (đơn vị twip = 1/20 pt; 567 twip = 1 cm) --------------------
const TRANG = { w: 16838, h: 11906 }          // A4 ngang
const LE = { top: 450, bottom: 450, left: 567, right: 567 }
const RONG_BANG = TRANG.w - LE.left - LE.right // 15704

/** 18 cột theo đúng thứ tự mẫu. `tag` là thẻ dữ liệu, bề rộng cộng lại = RONG_BANG. */
const COT = [
  { w: 400,  tag: 'TT',         tieuDe: 'TT' },
  { w: 2000, tag: 'HOTEN',      tieuDe: 'Họ và tên' },
  { w: 800,  tag: 'QUANHE',     tieuDe: 'Quan hệ với chủ hộ/người đại diện' },
  { w: 950,  tag: 'NAM',        tieuDe: 'Nam',  nhom: 'Ngày, tháng, năm sinh' },
  { w: 950,  tag: 'NU',         tieuDe: 'Nữ',   nhom: 'Ngày, tháng, năm sinh' },
  { w: 750,  tag: 'QUEQUAN',    tieuDe: 'Quê quán' },
  { w: 1150, tag: 'CCCD',       tieuDe: 'Số định danh cá nhân/căn cước/ Số giấy tờ tùy thân khác còn giá trị sử dụng' },
  { w: 600,  tag: 'DANTOC',     tieuDe: 'Dân tộc' },
  { w: 800,  tag: 'QUOCTICH',   tieuDe: 'Quốc tịch' },
  { w: 900,  tag: 'TONGIAO',    tieuDe: 'Tôn giáo' },
  { w: 750,  tag: 'NGHENGHIEP', tieuDe: 'Nghề nghiệp, nơi làm việc' },
  { w: 750,  tag: 'ODAUDEN',    tieuDe: 'Ở đâu đến, ngày đến, mục đích' },
  { w: 750,  tag: 'CHUYENDI',   tieuDe: 'Chuyển đi đâu, ngày đi, mục đích' },
  { w: 600,  tag: 'THAIDO',     tieuDe: 'Thái độ chính trị' },
  { w: 1000, tag: 'THUCTE',     tieuDe: 'Thực tế sinh sống nhưng không đủ điều kiện đăng ký thường trú, tạm trú, chưa khai báo thông tin cư trú' },
  { w: 700,  tag: 'QHXH',       tieuDe: 'Quan hệ xã hội cần chú ý (nếu có)' },
  { w: 950,  tag: 'SDT',        tieuDe: 'Số điện thoại' },
  // Ghi chú in cỡ chữ nhỏ hơn: dòng bị khoá chiều cao nên chỉ hiện được ~2 dòng chữ
  { w: 904,  tag: 'GHICHU',     tieuDe: 'Ghi chú', sz: 14 },
]

const tongRong = COT.reduce((s, c) => s + c.w, 0)
if (tongRong !== RONG_BANG) {
  throw new Error(`Bề rộng cột cộng lại ${tongRong}, phải bằng ${RONG_BANG}`)
}

const CO_CHU_DU_LIEU = 16   // 8 pt — 12 số CCCD vừa cột 1150 twip, 10 số ĐT vừa cột 950
const CO_CHU_TIEU_DE = 16   // 8 pt
// 20 pt, KHOÁ CỨNG (exact): 20 dòng luôn = 8000 twip nên một hộ không bao giờ tràn
// sang trang sau. Chữ dài hơn 2 dòng trong ô sẽ bị cắt — script xuất có cảnh báo.
const CAO_DONG = 400

// ---- Tiện ích XML -----------------------------------------------------------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Một run chữ. `them` là XML thêm vào rPr (ví dụ <w:b/>). */
function run(text, { sz = CO_CHU_DU_LIEU, dam = false } = {}) {
  const rPr = `<w:rPr>${dam ? '<w:b/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

/** Đoạn văn, canh giữa nếu `giua`, không giãn dòng. */
function p(runs, { giua = false, pPr = '' } = {}) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${giua ? '<w:jc w:val="center"/>' : ''}${pPr}</w:pPr>${runs}</w:p>`
}

const VIEN = '<w:tcBorders>'
  + ['top', 'left', 'bottom', 'right']
    .map((c) => `<w:${c} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('')
  + '</w:tcBorders>'

/**
 * Một ô bảng. `span` gộp ngang, `vMerge` = 'restart' | 'continue' gộp dọc.
 */
function tc(noiDung, w, { span = 1, vMerge = null, giua = true } = {}) {
  const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>`
    + (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '')
    + (vMerge ? `<w:vMerge${vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : '')
    + VIEN
    + '<w:vAlign w:val="center"/></w:tcPr>'
  return `<w:tc>${tcPr}${p(noiDung, { giua })}</w:tc>`
}

function tr(cells, { cao = null, exact = false, tieuDe = false } = {}) {
  let trPr = ''
  if (cao || tieuDe) {
    trPr = '<w:trPr>'
      + (cao ? `<w:trHeight w:val="${cao}" w:hRule="${exact ? 'exact' : 'atLeast'}"/>` : '')
      + (tieuDe ? '<w:tblHeader/>' : '')
      + '<w:cantSplit/></w:trPr>'
  }
  return `<w:tr>${trPr}${cells.join('')}</w:tr>`
}

// ---- Dựng bảng --------------------------------------------------------------
function bang() {
  const tblPr = '<w:tblPr>'
    + `<w:tblW w:w="${RONG_BANG}" w:type="dxa"/>`
    + '<w:tblLayout w:type="fixed"/>'
    + '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="57" w:type="dxa"/>'
    + '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar>'
    + '</w:tblPr>'
  const grid = '<w:tblGrid>' + COT.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('') + '</w:tblGrid>'

  const td = (t) => run(t, { sz: CO_CHU_TIEU_DE, dam: true })

  // Hàng tiêu đề 1: nhóm "Ngày, tháng, năm sinh" gộp 2 cột; các cột khác gộp dọc xuống hàng 2.
  const hang1 = []
  for (let i = 0; i < COT.length; i++) {
    const c = COT[i]
    if (c.nhom) {
      if (i > 0 && COT[i - 1].nhom === c.nhom) continue
      const cacCot = COT.filter((x) => x.nhom === c.nhom)
      hang1.push(tc(td(c.nhom), cacCot.reduce((s, x) => s + x.w, 0), { span: cacCot.length }))
    } else {
      hang1.push(tc(td(c.tieuDe), c.w, { vMerge: 'restart' }))
    }
  }
  // Hàng tiêu đề 2: Nam / Nữ; các cột khác tiếp tục gộp dọc.
  const hang2 = COT.map((c) => c.nhom
    ? tc(td(c.tieuDe), c.w)
    : tc('', c.w, { vMerge: 'continue' }))
  // Hàng số thứ tự cột (1)…(18)
  const hang3 = COT.map((c, i) => tc(run(`(${i + 1})`, { sz: CO_CHU_TIEU_DE }), c.w))

  // Hàng dữ liệu: {#NK} ở ô đầu, {/NK} ở ô cuối → docxtemplater lặp cả hàng.
  const hangDuLieu = COT.map((c, i) => {
    let t = `{${c.tag}}`
    if (i === 0) t = '{#NK}' + t
    if (i === COT.length - 1) t = t + '{/NK}'
    return tc(run(t, { sz: c.sz || CO_CHU_DU_LIEU }), c.w, { giua: i !== 1 })
  })

  return `<w:tbl>${tblPr}${grid}`
    + tr(hang1, { tieuDe: true })
    + tr(hang2, { tieuDe: true })
    + tr(hang3, { cao: 240, tieuDe: true })
    + tr(hangDuLieu, { cao: CAO_DONG, exact: true })
    + '</w:tbl>'
}

// ---- Dựng trang -------------------------------------------------------------
function dauTrang() {
  const nhan = (t) => run(t, { sz: 22, dam: true })
  const gt = (t) => run(t, { sz: 22 })
  const tab = '<w:r><w:tab/></w:r>'
  // Ngắt trang nằm trong điều kiện CHUA_DAU: hộ đầu tiên không ngắt.
  const ngat = `${run('{#CHUA_DAU}')}<w:r><w:br w:type="page"/></w:r>${run('{/CHUA_DAU}')}`
  const pPr = '<w:tabs><w:tab w:val="left" w:pos="6200"/><w:tab w:val="left" w:pos="10600"/></w:tabs>'
    + '<w:spacing w:before="0" w:after="120"/>'
  return `<w:p><w:pPr>${pPr}</w:pPr>${ngat}`
    + nhan('Hộ gia đình/diện cư trú khác: ') + gt('{CHUHO}') + tab
    + nhan('Số hồ sơ cư trú: ') + gt('{SOHOK}') + tab
    + nhan('Địa chỉ cư trú: ') + gt('{DIACHI}')
    + '</w:p>'
}

function documentXml() {
  const sectPr = '<w:sectPr>'
    + `<w:pgSz w:w="${TRANG.w}" w:h="${TRANG.h}" w:orient="landscape"/>`
    + `<w:pgMar w:top="${LE.top}" w:right="${LE.right}" w:bottom="${LE.bottom}" w:left="${LE.left}" w:header="0" w:footer="0" w:gutter="0"/>`
    + '</w:sectPr>'
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + p(run('{#HO}'))
    + dauTrang()
    + bang()
    + p(run('{/HO}'))
    + sectPr
    + '</w:body></w:document>'
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
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
  + '</Types>'

const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>'

const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  + '</Relationships>'

/** @returns {Buffer} file .docx mẫu */
export function taoMauKV2() {
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml', documentXml())
  zip.file('word/_rels/document.xml.rels', DOC_RELS)
  zip.file('word/styles.xml', STYLES)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function ghiMauKV2(duongDan = DUONG_DAN_MAU) {
  fs.mkdirSync(path.dirname(duongDan), { recursive: true })
  fs.writeFileSync(duongDan, taoMauKV2())
  return duongDan
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Đã ghi mẫu:', ghiMauKV2())
}
