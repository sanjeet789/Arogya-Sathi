import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/hash";

export async function GET() {
  const users = await prisma.user.findMany({
    include: {
      doctorProfile: {
        select: { department: true, speciality: true }
      }
    }
  });
  const result = users.reduce<Record<string, { id: string; username: string; passwordHash: string; role: string; department?: string; speciality?: string }>>((acc, u) => {
    acc[u.username] = { 
      id: u.id, 
      username: u.username, 
      passwordHash: u.passwordHash, 
      role: u.role,
      department: u.doctorProfile?.department || undefined,
      speciality: u.doctorProfile?.speciality || undefined
    };
    return acc;
  }, {});
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { username?: string; password?: string; role?: "doctor" | "patient" };
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  const role = body.role;
  if (!username || !password || (role !== "doctor" && role !== "patient")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });
  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { username, passwordHash: hashPassword(password), role } });
    if (role === "patient") {
      await tx.patientProfile.create({ data: { userId: created.id } });
    } else if (role === "doctor") {
      await tx.doctorProfile.create({ data: { userId: created.id } });
    }
  });
  return NextResponse.json({ ok: true });
}


