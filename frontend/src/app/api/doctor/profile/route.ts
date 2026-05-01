import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { username }, include: { doctorProfile: true } });
  if (!user || user.role !== "doctor") return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(user.doctorProfile || null);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    username?: string;
    name?: string | null;
    age?: number | null;
    phone?: string | null;
    department?: string | null;
    speciality?: string | null;
    signature?: string | null;
    signatureType?: string | null;
    clinicName?: string | null;
    clinicAddress?: string | null;
    clinicPhone?: string | null;
    consultationFee?: number | null;
  };
  const username = (body.username || "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.role !== "doctor") return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const upserted = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: {
        name: body.name ?? undefined,
        age: body.age ?? undefined,
        phone: body.phone ?? undefined,
        department: body.department ?? undefined,
        speciality: body.speciality ?? undefined,
        signature: body.signature ?? undefined,
        signatureType: body.signatureType ?? undefined,
        clinicName: body.clinicName ?? undefined,
        clinicAddress: body.clinicAddress ?? undefined,
        clinicPhone: body.clinicPhone ?? undefined,
        consultationFee: body.consultationFee ?? undefined,
      },
      create: {
        userId: user.id,
        name: body.name ?? null,
        age: body.age ?? null,
        phone: body.phone ?? null,
        department: body.department ?? null,
        speciality: body.speciality ?? null,
        signature: body.signature ?? null,
        signatureType: body.signatureType ?? null,
        clinicName: body.clinicName ?? null,
        clinicAddress: body.clinicAddress ?? null,
        clinicPhone: body.clinicPhone ?? null,
        consultationFee: body.consultationFee ?? null,
      },
    });
    return NextResponse.json(upserted);
  } catch (error: any) {
    console.error("Error saving doctor profile:", error);
    return NextResponse.json({ error: error?.message || "Failed to save profile" }, { status: 500 });
  }
}


