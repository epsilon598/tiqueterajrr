"use client";

import { signIn, signOut } from "next-auth/react";

export default function AuthButtons({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {!isLoggedIn ? (
        <>
          <button onClick={() => signIn()} className="underline">Entrar</button>
        </>
      ) : (
        <button onClick={() => signOut()} className="underline">Salir</button>
      )}
    </div>
  );
}
