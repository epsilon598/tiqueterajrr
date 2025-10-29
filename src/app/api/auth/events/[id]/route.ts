import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { venue: true },
  });
  if (!event) return new Response("Not found", { status: 404 });
  return Response.json(event);
}
