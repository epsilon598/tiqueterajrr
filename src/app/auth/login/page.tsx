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
      // adónde quieres ir al terminar:
      callbackUrl: "/",
    });

    setLoading(false);

    if (res?.error) {
      setMsg("Credenciales inválidas");
      return;
    }
    // si no hay error:
    window.location.href = res?.url || "/";
  }

  async function loginGoogle() {
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-3">Login</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-sm">
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2"
        />
        <input
          placeholder="Contraseña"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="border p-2"
        />
        <button disabled={loading} className="bg-black text-white p-2">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-4">
        <button onClick={loginGoogle} className="border p-2">
          Continuar con Google
        </button>
      </div>

      {msg && <p className="mt-3 text-red-600">{msg}</p>}
    </div>
  );
}
