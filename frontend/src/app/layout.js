import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import { Geist } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans"
});

export const metadata = {
  title: "LegacyLoop — Evidence-based handover",
  description: "Preserve technical knowledge with evidence-linked handovers."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
