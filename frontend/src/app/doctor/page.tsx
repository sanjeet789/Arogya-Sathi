"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import DoctorSettings from "./DoctorSettings";
import DoctorAppointments from "./DoctorAppointments";
import DoctorPatients from "./DoctorPatients";
import DoctorPayments from "./DoctorPayments";

export default function DoctorDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState<"appointments" | "patients" | "payments" | "settings">("appointments");

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (user.role !== "doctor") router.replace("/patient");
    }
  }, [loading, user, router]);

  const navItems = useMemo(
    () => [
      { key: "appointments" as const, label: "Appointments" },
      { key: "patients" as const, label: "Patients" },
      { key: "payments" as const, label: "Payments" },
      { key: "settings" as const, label: "Settings" },
    ],
    []
  );
  const isReady = !loading && !!user && user.role === "doctor";

  const renderContent = () => {
    switch (active) {
      case "appointments":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Appointments</h2>
              <p className="text-sm opacity-80">Manage your appointments.</p>
            </div>
            <DoctorAppointments username={user?.username || ""} />
          </div>
        );
      case "patients":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Patients</h2>
              <p className="text-sm opacity-80">Patients who have booked with you.</p>
            </div>
            <DoctorPatients username={user?.username || ""} />
          </div>
        );
      case "payments":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Payments</h2>
              <p className="text-sm opacity-80">View payment history and statistics.</p>
            </div>
            <DoctorPayments username={user?.username || ""} />
          </div>
        );
      case "settings":
        return <DoctorSettings username={user?.username || ""} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/10 bg-background/70 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
            <span className="font-semibold">Doctor</span>
            <button className="md:hidden text-sm underline" onClick={() => setSidebarOpen(false)}>Close</button>
          </div>
          <nav className="flex-1 p-2">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => { setActive(item.key); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${active === item.key ? "bg-foreground text-background" : "hover:bg-white/5"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button className="underline" onClick={() => { logout(); router.replace("/login"); }}>Logout</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:ml-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 bg-background/70 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button className="md:hidden rounded border border-white/20 px-3 py-1 text-sm" onClick={() => setSidebarOpen(true)}>Menu</button>
            <h1 className="text-xl font-semibold hidden sm:block">Doctor Dashboard</h1>
          </div>
          <div className="text-sm opacity-80 truncate">{isReady ? user!.username : ""}</div>
        </header>

        <main className="p-4 md:p-8 space-y-6">
          {!isReady ? (
            <div className="text-sm opacity-80">Loading...</div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>
  );
}


