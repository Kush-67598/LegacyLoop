import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";

export const metadata = {
  title: "LegacyLoop — Evidence-based handover",
  description: "Preserve technical knowledge with evidence-linked handovers."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
