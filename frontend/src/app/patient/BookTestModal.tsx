"use client";

import React, { useEffect, useState } from "react";
import DateTimePicker from "./DateTimePicker";

type MedicalTest = {
  TestID: string;
  TestName: string;
};

type BookTestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  patientUsername: string;
  preSelectedTestId?: string;
  appointmentId?: string;
  onBookingSuccess?: () => void;
};

export default function BookTestModal({
  isOpen,
  onClose,
  patientUsername,
  preSelectedTestId,
  appointmentId,
  onBookingSuccess
}: BookTestModalProps) {
  const [medicalTests, setMedicalTests] = useState<MedicalTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState(preSelectedTestId || "");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMedicalTests();
      if (preSelectedTestId) {
        setSelectedTestId(preSelectedTestId);
      }
      // Set default datetime to next day at 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setDatetime(tomorrow.toISOString().slice(0, 16));
    }
  }, [isOpen, preSelectedTestId]);

  const fetchMedicalTests = async () => {
    try {
      const res = await fetch('/api/medical-tests?limit=200');
      if (res.ok) {
        const tests = await res.json();
        setMedicalTests(tests);
      }
    } catch (error) {
      console.error('Failed to fetch medical tests:', error);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/test-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({
          testId: selectedTestId,
          appointmentId: appointmentId || null,
          patientUsername,
          scheduledAt: datetime ? new Date(datetime).toISOString() : null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to book test");
      }

      setSaved(true);
      setNotes("");
      setTimeout(() => {
        onBookingSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book test");
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedTestName = () => {
    const test = medicalTests.find(t => t.TestID === selectedTestId);
    return test ? test.TestName : "Select a test";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border border-white/10 rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-medium">Book Medical Test</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Test</label>
            <select
              className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" 
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              required
              disabled={!!preSelectedTestId}
            >
              <option value="">Select a test</option>
              {medicalTests.map(test => (
                <option key={test.TestID} value={test.TestID}>
                  {test.TestName}
                </option>
              ))}
            </select>
          </div>

          <DateTimePicker
            label="Preferred Date & Time"
            value={datetime}
            onChange={setDatetime}
            minDate={new Date().toISOString().slice(0, 16)}
          />

          <div>
            <label className="block text-sm mb-1">Notes (optional)</label>
            <textarea
              className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={submitting || !selectedTestId}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
            >
              {submitting ? "Booking..." : "Book Test"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-white/20 text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>

          {saved && (
            <div className="text-sm text-green-500">
              Test booking created successfully!
            </div>
          )}
          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
