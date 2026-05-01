"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import PatientSettings from "./PatientSettings";
import PatientAppointments from "./PatientAppointments";
import PatientTestBookings from "./PatientTestBookings";
import BookAppointment from "./BookAppointment";
import AppointmentDetailsModal from "./AppointmentDetails";
import ChatbotInterface from "./ChatbotInterface";

type Appointment = {
  id: string;
  scheduledAt: string;
  reason?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  doctor: { username: string };
};

export default function PatientDashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState<"home" | "appointments" | "book" | "chatbot" | "settings" | "tests">("home");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (user.role !== "patient") router.replace("/doctor");
    }
  }, [loading, user, router]);

  // Fetch appointments when user is available
  useEffect(() => {
    if (user && user.role === "patient") {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    if (!user) return;
    setAppointmentsLoading(true);
    try {
      const res = await fetch(`/api/appointments?username=${encodeURIComponent(user.username)}&role=patient`);
      const data = await res.json();
      setAppointments(data || []);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Categorize appointments
  const { upcomingAppointments, previousAppointments } = useMemo(() => {
    const upcoming: Appointment[] = [];
    const previous: Appointment[] = [];

    appointments.forEach(appointment => {
      const isCompleted = appointment.status === "COMPLETED";
      
      // Previous appointments: ONLY completed appointments
      if (isCompleted) {
        previous.push(appointment);
      } else {
        // Upcoming appointments: all non-completed appointments (regardless of date)
        upcoming.push(appointment);
      }
    });

    // Sort upcoming by date (earliest first)
    upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    // Sort previous by date (most recent first)
    previous.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    return { upcomingAppointments: upcoming, previousAppointments: previous };
  }, [appointments]);

  const navItems = useMemo(
    () => [
      { key: "home" as const, label: "Home" },
      { key: "appointments" as const, label: "Appointments" },
      { key: "tests" as const, label: "Test Bookings" },
      { key: "book" as const, label: "Book Appointment" },
      { key: "chatbot" as const, label: "Chatbot (Beta)" },
      { key: "settings" as const, label: "Settings" },
    ],
    []
  );
  const isReady = !loading && !!user && user.role === "patient";

  const renderContent = () => {
    if (!user) return null;
    switch (active) {
      case "home":
        return (
          <div className="space-y-6">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Welcome</h2>
              <p className="text-sm opacity-80">Overview of your health, quick links, and updates.</p>
            </div>
            
            {/* Upcoming Appointments */}
            <div className="border border-white/10 rounded p-4">
              <h3 className="font-medium mb-3">Upcoming Appointments</h3>
              {appointmentsLoading ? (
                <p className="text-sm opacity-80">Loading...</p>
              ) : upcomingAppointments.length === 0 ? (
                <p className="text-sm opacity-80">No upcoming appointments scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 3).map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className="border border-white/5 rounded p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setSelectedAppointmentId(appointment.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Dr. {appointment.doctor.username}</div>
                          <div className="text-sm opacity-80">
                            {new Date(appointment.scheduledAt).toLocaleDateString()} at {new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {appointment.reason && (
                            <div className="text-sm opacity-70 mt-1">{appointment.reason}</div>
                          )}
                        </div>
                        <div className="text-xs px-2 py-1 rounded border border-white/20">
                          {appointment.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingAppointments.length > 3 && (
                    <button 
                      onClick={() => setActive("appointments")}
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      View all upcoming appointments ({upcomingAppointments.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Previous Appointments */}
            <div className="border border-white/10 rounded p-4">
              <h3 className="font-medium mb-3">Previous Appointments</h3>
              {appointmentsLoading ? (
                <p className="text-sm opacity-80">Loading...</p>
              ) : previousAppointments.length === 0 ? (
                <p className="text-sm opacity-80">No previous appointments.</p>
              ) : (
                <div className="space-y-3">
                  {previousAppointments.slice(0, 3).map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className="border border-white/5 rounded p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setSelectedAppointmentId(appointment.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Dr. {appointment.doctor.username}</div>
                          <div className="text-sm opacity-80">
                            {new Date(appointment.scheduledAt).toLocaleDateString()} at {new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {appointment.reason && (
                            <div className="text-sm opacity-70 mt-1">{appointment.reason}</div>
                          )}
                        </div>
                        <div className="text-xs px-2 py-1 rounded border border-white/20">
                          {appointment.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {previousAppointments.length > 3 && (
                    <button 
                      onClick={() => setActive("appointments")}
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      View all previous appointments ({previousAppointments.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="border border-white/10 rounded p-4">
              <h3 className="font-medium mb-3">Quick Actions</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <button 
                  onClick={() => setActive("book")}
                  className="flex items-center gap-3 p-3 border border-white/10 rounded hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center">
                    <span className="text-blue-400 text-sm">📅</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Book Appointment</div>
                    <div className="text-xs opacity-70">Schedule with a doctor</div>
                  </div>
                </button>
                
                <button 
                  onClick={() => setActive("tests")}
                  className="flex items-center gap-3 p-3 border border-white/10 rounded hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-600/20 rounded flex items-center justify-center">
                    <span className="text-green-400 text-sm">🧪</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Book Test</div>
                    <div className="text-xs opacity-70">Schedule medical tests</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      case "appointments":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Appointments</h2>
              <p className="text-sm opacity-80">Your appointments list.</p>
            </div>
            <PatientAppointments username={user.username} onRefresh={fetchAppointments} onAppointmentClick={setSelectedAppointmentId} />
          </div>
        );
      case "book":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Book Appointment</h2>
              <p className="text-sm opacity-80">Select a doctor and schedule a time.</p>
            </div>
            <BookAppointment patientUsername={user.username} />
          </div>
        );
      case "chatbot":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Chatbot (Beta)</h2>
              <p className="text-sm opacity-80">Get health information and assistance from our AI assistant.</p>
            </div>
            <div className="border border-white/10 rounded-lg">
              <ChatbotInterface />
            </div>
          </div>
        );
      case "tests":
        return (
          <div className="space-y-4">
            <div className="border border-white/10 rounded p-4">
              <h2 className="font-medium mb-2">Test Bookings</h2>
              <p className="text-sm opacity-80">View and manage your recommended medical tests.</p>
            </div>
            <PatientTestBookings username={user.username} />
          </div>
        );
      case "settings":
        return <PatientSettings username={user.username} />;
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
            <span className="font-semibold">Patient</span>
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
            <h1 className="text-xl font-semibold hidden sm:block">Patient Dashboard</h1>
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

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        onDeleted={fetchAppointments}
      />
    </div>
  );
}


