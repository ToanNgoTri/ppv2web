import "./globals.css";
import AccountBar from "./components/AccountBar";

export const metadata = {
  title: "Tra cứu dân cư",
  description: "Công cụ tra cứu dân cư",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <AccountBar />
        {children}
      </body>
    </html>
  );
}
