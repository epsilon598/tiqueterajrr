import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
//import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    //GoogleProvider({
    //  clientId: process.env.GOOGLE_CLIENT_ID || "",
    //  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    //  allowDangerousEmailAccountLinking: true,
    //}),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        // Lo que regresas aquí se convierte en "user" en el primer jwt callback
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 'token' ya es tipo JWT por los tipos de next-auth
      const t = token as JWT;

      // Primera vez (sign-in) viene 'user'
      if (user?.id) t.uid = user.id as string;

      // Adjuntamos el rol desde la BD (si existe uid)
      if (t.uid) {
        const u = await prisma.user.findUnique({ where: { id: t.uid } });
        if (u) t.role = u.role as "ADMIN" | "USER";
      }

      return t;
    },
    async session({ session, token }) {
      const t = token as JWT;

      if (t.uid) session.userId = t.uid;
      if (t.role) {
        session.user = {
          ...session.user,
          role: t.role,
        };
      }
      return session;
    },
  },
};
