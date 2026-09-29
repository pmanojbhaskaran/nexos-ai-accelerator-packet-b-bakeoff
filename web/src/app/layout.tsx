import "./globals.css";
import { QueryProvider } from "@/lib/api/query-provider";
import { ThemeProvider } from "@/lib/theme";
import { ToastContainer } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "NEXOS",
  description: "AI-first multi-tenant logistics operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
