// src/app/api/orders/[id]/route.ts
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // 👈 await

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      total: true,
      event: { select: { name: true } },
    },
  });

  if (!order) return new Response("Not found", { status: 404 });
  return Response.json(order);
}
