"use client";

import React, { useEffect, useState } from "react";
import DateTimePicker from "./DateTimePicker";
import PaymentModal from "./PaymentModal";

type Doctor = { username: string; consultationFee?: number | null };

export default function BookAppointment({ patientUsername }: { patientUsername: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorUsername, setDoctorUsername] = useState("");
  const [datetime, setDatetime] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // Payment states
  const [showPayment, setShowPayment] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [feeLoading, setFeeLoading] = useState(false);

  useEffect(() => {
    // Load all doctors from /api/users (simple map), filter role doctor
    fetch("/api/users").then(r => r.json()).then((map: Record<string, { role: string }>) => {
      const list = Object.values(map).filter(u => u.role === "doctor").map(u => ({ username: (u as any).username }));
      setDoctors(list);
      if (list[0]) {
        setDoctorUsername(list[0].username);
        setSelectedDoctor(list[0]);
        fetchDoctorFee(list[0].username);
      }
    }).catch(() => setDoctors([]));
    
    // Get patient ID
    fetch("/api/users").then(r => r.json()).then((map: Record<string, { id: string }>) => {
      const patient = Object.values(map).find(u => (u as any).username === patientUsername);
      if (patient) setPatientId(patient.id);
    }).catch(() => {});
  }, [patientUsername]);

  // Fetch doctor's consultation fee from their profile
  const fetchDoctorFee = async (username: string) => {
    setFeeLoading(true);
    try {
      const res = await fetch(`/api/doctor/profile?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const profile = await res.json();
        if (profile && profile.consultationFee != null) {
          setConsultationFee(profile.consultationFee);
        } else {
          setConsultationFee(500); // Default if not set
        }
      }
    } catch {
      setConsultationFee(500); // Default on error
    } finally {
      setFeeLoading(false);
    }
  };

  const handleDoctorChange = (username: string) => {
    setDoctorUsername(username);
    const doc = doctors.find(d => d.username === username);
    setSelectedDoctor(doc || null);
    fetchDoctorFee(username);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    setPaymentInProgress(false);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({ patientUsername, doctorUsername, scheduledAt: datetime ? new Date(datetime).toISOString() : null, reason: reason || null }),
      });
      if (!res.ok) throw new Error("create failed");
      
      const appointment = await res.json();
      setAppointmentId(appointment.id);
      
      // Get doctor ID for payment
      const usersRes = await fetch("/api/users");
      const users = await usersRes.json();
      const doctor = Object.values(users).find((u: any) => u.username === doctorUsername);
      if (doctor) setDoctorId((doctor as any).id);
      
      // Don't set saved=true yet - wait for payment completion
      setReason("");
      
      // Show payment modal
      setPaymentInProgress(true);
      setShowPayment(true);
    } catch {
      setError("Failed to book appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setPaymentInProgress(false);
    setSaved(true);
  };

  const handlePaymentClose = () => {
    setShowPayment(false);
    setPaymentInProgress(false);
    // Don't reset appointmentId so user can retry payment
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm mb-1">Doctor</label>
          <select className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={doctorUsername} onChange={(e) => handleDoctorChange(e.target.value)}>
            {doctors.map(d => <option key={d.username} value={d.username}>{d.username}</option>)}
          </select>
        </div>
        <DateTimePicker
          label="Date & Time"
          value={datetime}
          onChange={setDatetime}
          minDate={new Date().toISOString().slice(0, 16)}
        />
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Reason (optional)</label>
          <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe your concern" />
        </div>
      </div>

      {/* Consultation Fee Display */}
      <div className="border border-white/10 rounded p-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Consultation Fee</div>
          <div className="text-xs opacity-60">Charged by Dr. {doctorUsername}</div>
        </div>
        <div className="text-right">
          {feeLoading ? (
            <span className="text-sm opacity-60">Loading...</span>
          ) : (
            <span className="text-lg font-semibold text-green-400">₹{consultationFee}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          type="submit" 
          disabled={submitting || paymentInProgress} 
          className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-60"
        >
          {submitting ? "Booking..." : paymentInProgress ? "Payment in Progress..." : "Book"}
        </button>
        {saved && <span className="text-sm text-green-500">Booked & Paid</span>}
        {paymentInProgress && <span className="text-sm text-blue-500">Complete payment to finish booking</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
      
      {/* Payment Modal */}
      {showPayment && appointmentId && doctorId && patientId && (
        <PaymentModal
          isOpen={showPayment}
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
          appointmentId={appointmentId}
          patientId={patientId}
          doctorId={doctorId}
          amount={consultationFee}
          doctorName={doctorUsername}
          appointmentDate={datetime}
        />
      )}
    </form>
  );
}
