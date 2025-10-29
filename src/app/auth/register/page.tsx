"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setMsg(data?.error || "No se pudo registrar");
        return;
      }

      // Auto-login tras registrarse
      const login = await signIn("credentials", {
        redirect: false,
        email: form.email,
        password: form.password,
        callbackUrl: "/",
      });

      if (login?.error) {
        // Usuario creado pero fallo de login (poco probable si provider/contraseña están bien)
        setMsg("Registrado. Inicia sesión con tu correo y contraseña.");
        return;
      }

      // Redirige al inicio
      window.location.href = login?.url || "/";
    } catch {
      setMsg("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-semibold mb-3">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          className="border p-2"
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="border p-2"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="border p-2"
          type="password"
          placeholder="Contraseña (mín. 6)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button disabled={loading} className="bg-black text-white p-2">
          {loading ? "Creando..." : "Registrarme"}
        </button>
      </form>

      {msg && <p className="mt-3 text-red-600">{msg}</p>}
    </div>
  );
}
