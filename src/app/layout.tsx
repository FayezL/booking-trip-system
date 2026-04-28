import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/components/Toast";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Saint Demiana | خدمه فيرينا - Trip Management",
  description: "Saint Demiana | خدمه فيرينا - Trip & Room Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="light">
          <I18nProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
