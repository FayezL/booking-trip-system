import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { cn } from "@/lib/utils";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verena Church - Trip Management",
  description: "Verena Church Trip & Room Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={cn("font-sans", font.variable)}>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="light">
          <I18nProvider>
            {children}
            <Toaster position="top-center" dir="rtl" richColors />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
