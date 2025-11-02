// src/lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
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

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Primera vez de login: adjunta uid
      if (user?.id) token.uid = user.id as string;

      // Adjunta rol desde BD si hay uid
      if (token.uid) {
        const u = await prisma.user.findUnique({ where: { id: token.uid } });
        if (u) token.role = u.role as "ADMIN" | "USER";
      }
      return token;
    },
    async session({ session, token }) {
      // Expone en session para el cliente
      if (token.uid) session.userId = token.uid;
      if (token.role) {
        session.user = { ...session.user, role: token.role };
      }
      return session;
    },
  },
};
