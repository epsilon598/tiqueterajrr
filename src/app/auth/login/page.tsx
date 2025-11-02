"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
      callbackUrl: "/",
    });

    setLoading(false);

    if (res?.error) {
      setMsg("Credenciales inválidas");
      return;
    }

    window.location.href = res?.url || "/";
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-3">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          placeholder="Correo electrónico"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <input
          placeholder="Contraseña"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {/* ✅ Enlace a recuperación */}
      <a
        href="/auth/forgot"
        className="text-sm underline mt-2 inline-block text-blue-600 hover:text-blue-800"
      >
        ¿Olvidaste tu contraseña?
      </a>

      {msg && <p className="mt-3 text-red-600">{msg}</p>}
    </div>
  );
}
