// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Ignora errores de TypeScript en el build (no interrumpe el despliegue)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ✅ Ignora errores de ESLint en el build (no interrumpe el despliegue)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Puedes agregar más configuraciones de Next aquí si las necesitas
  // experimental: { serverActions: true },
};

export default nextConfig;
