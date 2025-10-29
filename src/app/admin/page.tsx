import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-3">Acceso restringido</h1>
        <p>Debes iniciar sesión como ADMIN.</p>
        <Link className="underline" href="/auth/login">Ir a login</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Panel Admin</h1>

      <div className="flex flex-col gap-2">
        <Link className="underline" href="/admin/scan">Abrir escáner de tickets</Link> {/* 👈 aquí */}
        {/* Aquí luego podemos agregar: crear evento, ver órdenes, etc. */}
      </div>
    </div>
  );
}
