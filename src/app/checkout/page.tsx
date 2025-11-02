// src/app/checkout/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  return <CheckoutClient isAdmin={isAdmin} />;
}
