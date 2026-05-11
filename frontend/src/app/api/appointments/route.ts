import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { 
        patient: { select: { username: true } }, 
        doctor: { select: { username: true } },
        transcriptions: { orderBy: { createdAt: 'asc' } }
      },
    });
    if (!appt) return NextResponse.json({ error: "appointment not found" }, { status: 404 });
    return NextResponse.json(appt);
  }

  const username = req.nextUrl.searchParams.get("username");
  const role = req.nextUrl.searchParams.get("role");
  if (!username || (role !== "doctor" && role !== "patient")) {
    return NextResponse.json({ error: "username and role required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const where = role === "patient" ? { patientId: user.id } : { doctorId: user.id };
  const data = await prisma.appointment.findMany({
    where: {
      ...where,
      status: { not: "DECLINED" } // Exclude declined appointments
    },
    orderBy: { scheduledAt: "asc" },
    include: { 
      patient: { select: { username: true } }, 
      doctor: { 
        select: { 
          username: true,
          doctorProfile: { select: { consultationFee: true } }
        } 
      },
      payment: {
        include: { logs: true }
      }
    },
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    patientUsername?: string;
    doctorUsername?: string;
    scheduledAt?: string; // ISO
    reason?: string | null;
  };
  const patientUsername = (body.patientUsername || "").trim().toLowerCase();
  const doctorUsername = (body.doctorUsername || "").trim().toLowerCase();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (!patientUsername || !doctorUsername || !scheduledAt || isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const [patient, doctor] = await Promise.all([
    prisma.user.findUnique({ where: { username: patientUsername } }),
    prisma.user.findUnique({ where: { username: doctorUsername } }),
  ]);
  if (!patient || patient.role !== "patient") return NextResponse.json({ error: "patient not found" }, { status: 404 });
  if (!doctor || doctor.role !== "doctor") return NextResponse.json({ error: "doctor not found" }, { status: 404 });
  const created = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt,
      reason: body.reason ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    id?: string;
    status?: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
    scheduledAt?: string | null;
    notes?: string | null;
    aiNotes?: string | null;
    prescription?: string | null;
    prescriptionPdf?: string | null;
    recommendedTests?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  
  // If status is DECLINED, delete the appointment and associated payment
  if (body.status === "DECLINED") {
    try {
      // First, delete associated payment if it exists
      await prisma.payment.deleteMany({
        where: { appointmentId: body.id }
      });
      
      // Then delete the appointment
      await prisma.appointment.delete({
        where: { id: body.id }
      });
      
      return NextResponse.json({ message: "Appointment declined and deleted successfully" });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
    }
  }
  
  const data: any = {};
  if (body.status) data.status = body.status;
  if (typeof body.notes !== "undefined") data.notes = body.notes;
  if (typeof body.aiNotes !== "undefined") data.aiNotes = body.aiNotes;
  if (typeof body.prescription !== "undefined") data.prescription = body.prescription;
  if (typeof body.prescriptionPdf !== "undefined") data.prescriptionPdf = body.prescriptionPdf;
  if (typeof body.recommendedTests !== "undefined") data.recommendedTests = body.recommendedTests;
  if (typeof body.scheduledAt !== "undefined") {
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
  }
  const updated = await prisma.appointment.update({ where: { id: body.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  
  try {
    // First, delete associated payment if it exists (cascade should handle this, but being explicit)
    await prisma.payment.deleteMany({
      where: { appointmentId: id }
    });
    
    // Then delete the appointment
    await prisma.appointment.delete({
      where: { id }
    });
    
    return NextResponse.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
  }
}
