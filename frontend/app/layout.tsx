import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "EduAgent — DevNest Academy",
  description: "Nova, the AI voice assistant for DevNest Academy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
