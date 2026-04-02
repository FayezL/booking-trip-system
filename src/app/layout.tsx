import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "CTRMS - Church Trip Management",
  description: "Church Trip & Room Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen">
        <I18nProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
