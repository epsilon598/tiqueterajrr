"use client";
import { useState } from "react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const body = new URLSearchParams();
    body.append("email", form.email);
    body.append("password", form.password);
    body.append("callbackUrl", "/");

    const res = await fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (res.redirected) window.location.href = res.url;
    else setMsg("Credenciales inválidas");
  }

  function loginGoogle() {
    window.location.href = "/api/auth/signin/google?callbackUrl=/";
  }

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
        <input placeholder="Contraseña" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/>
        <button>Entrar</button>
      </form>
      <div style={{ marginTop: 12 }}>
        <button onClick={loginGoogle}>Continuar con Google</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
