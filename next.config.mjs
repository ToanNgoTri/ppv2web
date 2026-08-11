/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cppilyhbusukcmrwpvfc.supabase.co",
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
