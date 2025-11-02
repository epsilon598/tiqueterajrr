"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!token) {
      setMsg("Token inválido o faltante.");
      return;
    }
    if (pwd.length < 8) {
      setMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pwd !== pwd2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg(data?.error || "No se pudo restablecer la contraseña.");
        return;
      }
      setMsg("✅ Contraseña actualizada. Ya puedes iniciar sesión.");
    } catch {
      setMsg("Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-3">Nueva contraseña</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Nueva contraseña"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className="border p-2 rounded"
          required
          minLength={8}
        />
        <input
          type="password"
          placeholder="Repite la contraseña"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          className="border p-2 rounded"
          required
          minLength={8}
        />
        <button
          disabled={loading}
          className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
