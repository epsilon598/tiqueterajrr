"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Por seguridad, no revelar si el correo existe o no
      if (!res.ok) {
        // igual mostramos mensaje genérico
      }
      setMsg("Si el correo existe, te enviamos un enlace para restablecer la contraseña.");
    } catch {
      setMsg("No se pudo procesar la solicitud. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-3">Restablecer contraseña</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Tu correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          disabled={loading}
          className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
