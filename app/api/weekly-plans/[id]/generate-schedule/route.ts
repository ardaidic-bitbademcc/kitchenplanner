import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateSchedule } from "@/lib/schedule-generator";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await generateSchedule(params.id);
  return NextResponse.json({ ok: true });
}
