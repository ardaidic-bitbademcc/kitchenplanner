import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["admin", "viewer"]),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const data = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt }).from(users).orderBy(users.name);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.insert(users).values({ ...parsed.data, passwordHash: hash }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  return NextResponse.json(user, { status: 201 });
}
