"use client";

import React, { useEffect, useState } from "react";

type Appointment = {
  id: string;
  scheduledAt: string;
  reason?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  doctor: { username: string };
};

export default function PatientAppointments({ username, onRefresh, onAppointmentClick }: { username: string; onRefresh?: () => void; onAppointmentClick?: (appointmentId: string) => void }) {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments?username=${encodeURIComponent(username)}&role=patient`);
      const data = await res.json();
      setList(data || []);
      if (onRefresh) onRefresh();
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (appointmentId: string) => {
    setDeletingId(appointmentId);
    try {
      const res = await fetch(`/api/appointments?id=${encodeURIComponent(appointmentId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setList(prev => prev.filter(a => a.id !== appointmentId));
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete appointment");
      }
    } catch {
      setError("Failed to delete appointment");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const getStatusStyle = (status: Appointment["status"]) => {
    switch (status) {
      case "ACCEPTED":
        return "border-green-500/30 bg-green-500/10 text-green-400";
      case "PENDING":
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
      case "COMPLETED":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";
      case "CANCELLED":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      case "DECLINED":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      default:
        return "border-white/20";
    }
  };

  useEffect(() => { fetchList(); }, [username]);

  if (loading) return <div className="text-sm opacity-80">Loading...</div>;

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white ml-2 text-xs">✕</button>
        </div>
      )}
      {list.length === 0 && <div className="text-sm opacity-80">No appointments.</div>}
      {list.map(a => (
        <div key={a.id} className="border border-white/10 rounded p-3 hover:bg-white/5 transition-colors relative group">
          <div className="flex items-center justify-between">
            <div
              className="flex-1 cursor-pointer"
              onClick={() => onAppointmentClick?.(a.id)}
            >
              <div className="font-medium">With Dr. {a.doctor.username}</div>
              <div className="text-sm opacity-80">
                {new Date(a.scheduledAt).toLocaleDateString()} at{" "}
                {new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {a.reason ? ` • ${a.reason}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-xs px-2 py-1 rounded border ${getStatusStyle(a.status)}`}>
                {a.status}
              </div>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(a.id);
                }}
                disabled={deletingId === a.id}
                className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Delete appointment"
              >
                {deletingId === a.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirmation dialog inline */}
          {confirmDeleteId === a.id && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm text-red-400">Delete this appointment?</span>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                  className="px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  disabled={deletingId === a.id}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  {deletingId === a.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
