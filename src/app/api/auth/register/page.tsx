"use client";
import { useState } from "react";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Error");
    else setMsg("Registrado. Ahora inicia sesión.");
  }

  return (
    <div>
      <h1>Registro</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/>
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
        <input placeholder="Contraseña (min 6)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/>
        <button>Crear cuenta</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
