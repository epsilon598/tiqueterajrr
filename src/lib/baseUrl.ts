// src/lib/baseUrl.ts
export function getBaseUrl(): string {
  // 1) En el browser, usa rutas relativas
  if (typeof window !== "undefined") return "";

  // 2) Si tienes un dominio público (ngrok o prod)
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;           // p. ej. https://xxxxx.ngrok-free.app
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 3) Fallback local dev
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}
