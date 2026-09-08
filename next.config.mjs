// Host ảnh phải theo ĐÚNG dự án Supabase trong .env.local, không viết cứng:
// gõ cứng một ref (cppilyhbusukcmrwpvfc) là đổi dự án xong ảnh chân dung im lặng
// hỏng. Thêm cả wildcard *.supabase.co làm lưới an toàn cho mọi dự án.
const HOST_ANH = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  } catch {
    return null
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...(HOST_ANH
        ? [{ protocol: "https", hostname: HOST_ANH, pathname: "/storage/v1/object/public/**" }]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],

    // Tắt tối ưu ảnh để gói mang đi được sang HỆ KHÁC.
    // Bộ tối ưu của Next cần sharp, mà sharp là native module riêng cho từng
    // hệ/chip: đóng gói Windows từ máy Mac sẽ nhét bản darwin-arm64 vào gói và
    // ảnh chết khi chạy trên Windows. Ảnh ở đây là ảnh chân dung hiển thị 120px
    // lấy trực tiếp từ Supabase, không cần tối ưu.
    unoptimized: true,
  },

  // Gom mọi thứ cần thiết vào .next/standalone để đóng gói mang sang máy khác
  // mà không phải chạy npm install. Xem scripts/dong-goi.mjs
  output: "standalone",

  // API /generatedocs đọc template bằng fs từ process.cwd()/public/templates,
  // không phải qua import — bộ dò phụ thuộc của Next không thấy nên không gom.
  // dong-goi.mjs copy tay cả thư mục public, dòng dưới chỉ là lớp bảo hiểm.
  outputFileTracingIncludes: {
    "/api/generatedocs": ["./public/templates/**/*"],
  },
};

export default nextConfig;
