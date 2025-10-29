import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "ADMIN" | "USER";
  }
}

declare module "next-auth" {
  interface Session {
    userId?: string;
    user: DefaultSession["user"] & {
      role?: "ADMIN" | "USER";
    };
  }
}
