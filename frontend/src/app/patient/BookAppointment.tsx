"use client";

import React, { useEffect, useState } from "react";
import DateTimePicker from "./DateTimePicker";
import PaymentModal from "./PaymentModal";

type Doctor = { username: string; consultationFee?: number | null; department?: string; speciality?: string };

export default function BookAppointment({ patientUsername }: { patientUsername: string }) {
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [specialities, setSpecialities] = useState<string[]>([]);
  
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSpeciality, setSelectedSpeciality] = useState("");

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

  // Availability states
  const [availableDays, setAvailableDays] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<number | null>(null);

  useEffect(() => {
    // Load all doctors from /api/users (simple map), filter role doctor
    fetch("/api/users").then(r => r.json()).then((map: Record<string, { role: string; department?: string; speciality?: string }>) => {
      const list = Object.values(map)
        .filter(u => u.role === "doctor")
        .map(u => ({ 
          username: (u as any).username,
          department: u.department || "Uncategorized",
          speciality: u.speciality || "General"
        }));
      setAllDoctors(list);
      
      const deps = Array.from(new Set(list.map(d => d.department))).sort() as string[];
      setDepartments(deps);
    }).catch(() => setAllDoctors([]));
    
    // Get patient ID
    fetch("/api/users").then(r => r.json()).then((map: Record<string, { id: string }>) => {
      const patient = Object.values(map).find(u => (u as any).username === patientUsername);
      if (patient) setPatientId(patient.id);
    }).catch(() => {});
  }, [patientUsername]);

  useEffect(() => {
    if (selectedDepartment) {
      const filteredByDept = allDoctors.filter(d => d.department === selectedDepartment);
      const specs = Array.from(new Set(filteredByDept.map(d => d.speciality))).sort() as string[];
      setSpecialities(specs);
      
      if (!specs.includes(selectedSpeciality)) {
        setSelectedSpeciality("");
        setDoctorUsername("");
        setSelectedDoctor(null);
      }
    } else {
      setSpecialities([]);
      setSelectedSpeciality("");
      setDoctorUsername("");
      setSelectedDoctor(null);
    }
  }, [selectedDepartment, allDoctors]);

  useEffect(() => {
    if (selectedDepartment && selectedSpeciality) {
      const matches = allDoctors.filter(d => d.department === selectedDepartment && d.speciality === selectedSpeciality);
      setFilteredDoctors(matches);
      
      if (!matches.find(d => d.username === doctorUsername)) {
        setDoctorUsername("");
        setSelectedDoctor(null);
        setConsultationFee(500);
        setAvailableDays(null);
        setStartTime(null);
        setEndTime(null);
        setSlotDuration(null);
      }
    } else {
      setFilteredDoctors([]);
    }
  }, [selectedDepartment, selectedSpeciality, allDoctors]);

  // Fetch doctor's consultation fee and availability from their profile
  const fetchDoctorFee = async (username: string) => {
    setFeeLoading(true);
    try {
      const res = await fetch(`/api/doctor/profile?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const profile = await res.json();
        if (profile) {
          if (profile.consultationFee != null) {
            setConsultationFee(profile.consultationFee);
          } else {
            setConsultationFee(500); // Default if not set
          }
          setAvailableDays(profile.availableDays ?? null);
          setStartTime(profile.startTime ?? null);
          setEndTime(profile.endTime ?? null);
          setSlotDuration(profile.slotDuration ?? null);
        } else {
          setConsultationFee(500); // Default if not set
          setAvailableDays(null);
          setStartTime(null);
          setEndTime(null);
          setSlotDuration(null);
        }
      }
    } catch {
      setConsultationFee(500); // Default on error
      setAvailableDays(null);
      setStartTime(null);
      setEndTime(null);
      setSlotDuration(null);
    } finally {
      setFeeLoading(false);
    }
  };

  const handleDoctorChange = (username: string) => {
    setDoctorUsername(username);
    const doc = filteredDoctors.find(d => d.username === username);
    setSelectedDoctor(doc || null);
    if (username) {
      fetchDoctorFee(username);
    } else {
      setConsultationFee(500);
      setAvailableDays(null);
      setStartTime(null);
      setEndTime(null);
      setSlotDuration(null);
    }
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
          <label className="block text-sm mb-1">Department</label>
          <select 
            className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" 
            value={selectedDepartment} 
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="">Select Department</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Speciality</label>
          <select 
            className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none disabled:opacity-50" 
            value={selectedSpeciality} 
            onChange={(e) => setSelectedSpeciality(e.target.value)}
            disabled={!selectedDepartment}
          >
            <option value="">Select Speciality</option>
            {specialities.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Doctor</label>
          <select 
            className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none disabled:opacity-50" 
            value={doctorUsername} 
            onChange={(e) => handleDoctorChange(e.target.value)}
            disabled={!selectedSpeciality}
          >
            <option value="">Select Doctor</option>
            {filteredDoctors.map(d => <option key={d.username} value={d.username}>Dr. {d.username}</option>)}
          </select>
          {selectedSpeciality && filteredDoctors.length === 0 && (
            <p className="text-xs text-yellow-500 mt-1">No doctors found for this speciality.</p>
          )}
        </div>
        <DateTimePicker
          label="Date & Time"
          value={datetime}
          onChange={setDatetime}
          minDate={new Date().toISOString().slice(0, 16)}
          availableDays={availableDays}
          startTime={startTime}
          endTime={endTime}
          slotDuration={slotDuration}
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
          disabled={submitting || paymentInProgress || !doctorUsername} 
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
