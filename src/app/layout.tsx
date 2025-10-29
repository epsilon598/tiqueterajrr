import "./globals.css";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthButtons from "@/components/AuthButtons";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="es">
      <body className="max-w-3xl mx-auto p-4">
        <header className="flex items-center justify-between mb-6 border-b pb-3">
          <nav className="flex gap-4">
            <Link href="/">Inicio</Link>
            <Link href="/events">Eventos</Link> {/* 👈 nuevo */}
            <Link href="/auth/login">Login</Link>
            <Link href="/auth/register">Registro</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          <AuthButtons isLoggedIn={Boolean(session?.user)} />
        </header>
        {children}
      </body>
    </html>
  );
}
