'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const EMPTY_FORM = {
  cccd: '', hoten: '', ngaysinh: '', thangsinh: '', namsinh: '',
  gioitinh: '', noithtru: '', tencha: '', tenme: '', dantoc: '', tongiao: '',
  tenkhac: '', noisinh: '', tdhv: '', sdt: '', nghenghiep: '', quequan: '',
  noiohientai: '', noioSameAsThuongtru: false,
  ngaycap: '', thangcap: '', namcap: '', noicap: '',
  noilamviec: '',
}

const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f0f4ff',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 64,
    paddingLeft: 16,
    paddingRight: 16,
    fontFamily: 'Segoe UI, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    padding: '20px 24px',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0,
  },
  headerSub: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 4,
  },
  body: {
    padding: '20px 24px',
  },
  msgSuccess: {
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
    backgroundColor: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
  msgError: {
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#3b82f6',
    marginBottom: 8,
  },
  searchRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    outline: 'none',
  },
  btnFind: {
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    cursor: 'pointer',
  },
  btnFindDisabled: {
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#9ca3af',
    border: 'none',
    cursor: 'not-allowed',
  },
  divider: {
    borderTop: '1px solid #f3f4f6',
    paddingTop: 16,
    marginBottom: 16,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 16px',
  },
  fieldFull: {
    gridColumn: '1 / -1',
  },
  fieldHalf: {
    gridColumn: 'span 1',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#4b5563',
    marginBottom: 4,
  },
  fieldInput: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fieldInputDisabled: {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    color: '#9ca3af',
    backgroundColor: '#f9fafb',
    outline: 'none',
    boxSizing: 'border-box',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px 12px',
    marginBottom: 8,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 12,
    color: '#4b5563',
  },
  btnSubmit: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    border: 'none',
    cursor: 'pointer',
    marginTop: 4,
  },
  btnSubmitDisabled: {
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#d1d5db',
    border: 'none',
    cursor: 'not-allowed',
    marginTop: 4,
  },
}

function Field({ label, name, placeholder = '', half = false, value, onChange, onKeyDown }) {
  return (
    <div style={half ? s.fieldHalf : s.fieldFull}>
      <label style={s.label}>{label}</label>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        style={s.fieldInput}
      />
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()

  const [cccd, setCccd] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [source, setSource] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const cccdFromUrl = searchParams.get('cccd')
    if (cccdFromUrl) {
      // Navigate từ màn hình 1 — KHÔNG lấy QR, truyền fromNav=true để clear ngày cấp
      setCccd(cccdFromUrl)
      doLookup(cccdFromUrl, true)
    } else {
      // Vào thẳng trang — lấy CCCD từ QR như bình thường
      const fetchQR = async () => {
        try {
          const res = await fetch('/api/qr')
          const json = await res.json()
          if (json.cccd) setCccd(json.cccd)
        } catch {}
      }
      fetchQR()
    }
  }, [])

  async function doLookup(cccdValue, fromNav = false) {
    if (!cccdValue?.trim()) {
      setMessage({ type: 'error', text: 'Chưa có CCCD để tìm kiếm' })
      return
    }
    setLookupLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/lookup?cccd=${encodeURIComponent(cccdValue.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSource(json.source)

      // Nếu navigate từ màn hình 1 thì xóa ngày cấp / nơi cấp
      // vì QR của người này chưa được quét, không có dữ liệu đó
      const formData = { ...EMPTY_FORM, ...json.form }
      if (fromNav) {
        formData.ngaycap = ''
        formData.thangcap = ''
        formData.namcap = ''
        formData.noicap = ''
      }

      setForm(() => formData)
      setMessage({
        type: 'success',
        text: json.source === 'db' ? '✅ Tìm thấy trong database' : '⚠️ Không có trong DB, vui lòng điền thêm',
      })
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setLookupLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'noioSameAsThuongtru' && checked ? { noiohientai: '' } : {}),
    }))
  }

  const handleLookup = () => doLookup(cccd)

  const handleSubmit = async () => {
    if (!form.cccd.trim()) {
      setMessage({ type: 'error', text: 'Chưa có thông tin để tạo hồ sơ' })
      return
    }
    setSubmitLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/generatedocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Lỗi tạo hồ sơ')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      const filename = match ? decodeURIComponent(match[1]) : 'ho-so.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: 'success', text: '✅ Đã tạo hồ sơ! File ZIP đang tải về.' })
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err.message}` })
    } finally {
      setSubmitLoading(false)
    }
  }

  const onEnterSubmit = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div style={s.page}>
      <div style={s.card}>

        <div style={s.header}>
          <div style={s.headerTitle}>🗂️ Tạo Hồ Sơ Công Dân</div>
          <div style={s.headerSub}>Tìm kiếm theo CCCD → Kiểm tra → Xuất Word</div>
        </div>

        <div style={s.body}>

          {message && (
            <div style={message.type === 'success' ? s.msgSuccess : s.msgError}>
              {message.text}
            </div>
          )}

          <div style={s.sectionLabel}>Tìm kiếm</div>
          <div style={s.searchRow}>
            <input
              type="text"
              value={cccd}
              onChange={e => setCccd(e.target.value)}
              placeholder="Số CCCD..."
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              style={s.input}
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading}
              style={lookupLoading ? s.btnFindDisabled : s.btnFind}
            >
              {lookupLoading ? '⏳' : '🔍 Tìm'}
            </button>
          </div>

          {source && (
            <>
              <div style={s.divider}>
                <div style={s.sectionLabel}>
                  Thông tin {source === 'db' ? '(Database)' : '(QR — điền thêm)'}
                </div>
                <div style={s.grid2}>
                  <Field label="Họ tên" name="hoten" value={form.hoten} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Ngày sinh" name="ngaysinh" placeholder="DD" half value={form.ngaysinh} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Tháng sinh" name="thangsinh" placeholder="MM" half value={form.thangsinh} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Năm sinh" name="namsinh" placeholder="YYYY" half value={form.namsinh} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Giới tính" name="gioitinh" half value={form.gioitinh} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="CCCD" name="cccd" value={form.cccd} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Nơi thường trú" name="noithtru" value={form.noithtru} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Cha" name="tencha" half value={form.tencha} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Mẹ" name="tenme" half value={form.tenme} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Dân tộc" name="dantoc" half value={form.dantoc} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Tôn giáo" name="tongiao" half value={form.tongiao} onChange={handleChange} onKeyDown={onEnterSubmit} />
                </div>
              </div>

              <div style={s.divider}>
                <div style={s.sectionLabel}>Thông tin bổ sung</div>
                <div style={s.grid2}>
                  <Field label="Tên khác" name="tenkhac" placeholder="Nếu có" value={form.tenkhac} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Nơi sinh" name="noisinh" half value={form.noisinh} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Trình độ HV" name="tdhv" placeholder="VD: 12/12" half value={form.tdhv} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Số điện thoại" name="sdt" half value={form.sdt} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Nghề nghiệp" name="nghenghiep" half value={form.nghenghiep} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Quê quán" name="quequan" value={form.quequan} onChange={handleChange} onKeyDown={onEnterSubmit} />
                  <Field label="Nơi làm việc" name="noilamviec" value={form.noilamviec} onChange={handleChange} onKeyDown={onEnterSubmit} />
                </div>

                <div style={{ marginTop: 8 }}>
                  <label style={s.label}>Nơi ở hiện tại</label>
                  <input
                    type="text"
                    name="noiohientai"
                    value={form.noiohientai}
                    onChange={handleChange}
                    disabled={form.noioSameAsThuongtru}
                    placeholder="Địa chỉ nơi ở hiện tại..."
                    style={form.noioSameAsThuongtru ? s.fieldInputDisabled : s.fieldInput}
                  />
                  <label style={s.checkRow}>
                    <input
                      type="checkbox"
                      name="noioSameAsThuongtru"
                      checked={form.noioSameAsThuongtru}
                      onChange={handleChange}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={s.checkLabel}>Giống Nơi thường trú</span>
                  </label>
                </div>
              </div>

              <div style={s.divider}>
                <div style={s.sectionLabel}>Thông tin CCCD</div>
                <div style={s.grid3}>
                  <div>
                    <label style={s.label}>Ngày cấp</label>
                    <input type="text" name="ngaycap" value={form.ngaycap} onChange={handleChange} placeholder="DD" style={s.fieldInput} />
                  </div>
                  <div>
                    <label style={s.label}>Tháng cấp</label>
                    <input type="text" name="thangcap" value={form.thangcap} onChange={handleChange} placeholder="MM" style={s.fieldInput} />
                  </div>
                  <div>
                    <label style={s.label}>Năm cấp</label>
                    <input type="text" name="namcap" value={form.namcap} onChange={handleChange} placeholder="YYYY" style={s.fieldInput} />
                  </div>
                </div>
                <Field label="Nơi cấp" name="noicap" placeholder="Cục Cảnh sát..." value={form.noicap} onChange={handleChange} onKeyDown={onEnterSubmit} />
              </div>
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitLoading || !source}
            style={submitLoading || !source ? s.btnSubmitDisabled : s.btnSubmit}
          >
            {submitLoading ? '⏳ Đang xử lý...' : '🚀 Tạo hồ sơ'}
          </button>

        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f0f4ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Segoe UI, sans-serif',
        color: '#6b7280',
        fontSize: 14,
      }}>
        Đang tải...
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
