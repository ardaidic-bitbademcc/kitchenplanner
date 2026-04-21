import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "viewer"]).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const [user] = await db.update(users).set(parsed.data).where(eq(users.id, params.id)).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  return NextResponse.json(user);
}
