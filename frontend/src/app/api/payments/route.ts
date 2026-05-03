import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, patientId, doctorId, amount, method, transactionId, status } = body;

    // Validate required fields
    if (!appointmentId || !patientId || !doctorId || !amount || !method || !transactionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        appointmentId,
        patientId,
        doctorId,
        amount: parseFloat(amount),
        currency: "INR",
        status: status || "COMPLETED",
        method,
        transactionId,
        ...(method === "UPI" ? { upiId: "saswatsusmoy@upi" } : {}),
        paidAt: new Date(),
      },
    });

    // Update appointment status to ACCEPTED
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "ACCEPTED" },
    });

    // Create payment log
    await prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        action: "completed",
        status: "COMPLETED",
        amount: parseFloat(amount),
        metadata: JSON.stringify({
          transaction_id: transactionId,
          method: method,
          appointment_status: "ACCEPTED"
        }),
      },
    });

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
