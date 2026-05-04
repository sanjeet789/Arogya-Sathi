"use client";

import React, { useState, useEffect } from "react";

type PaymentLog = {
  id: string;
  paymentId: string;
  action: string;
  status: string;
  amount?: number;
  metadata?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

type Payment = {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  transactionId?: string;
  upiId?: string;
  cardLast4?: string;
  cardType?: string;
  gatewayResponse?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  patient_username: string;
  doctor_username: string;
  appointment_date: string;
  appointment_reason?: string;
  logs: PaymentLog[];
};

type PaymentStats = {
  total_payments: number;
  total_amount: number;
  successful_payments: number;
  failed_payments: number;
  average_amount: number;
};

type DoctorPaymentsProps = {
  username: string;
};

export default function DoctorPayments({ username }: DoctorPaymentsProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (username) {
      fetchPayments();
      fetchStats();
    }
  }, [username]);

  const fetchPayments = async () => {
    try {
      // Fetch appointments for this doctor
      const response = await fetch(`/api/appointments?username=${encodeURIComponent(username)}&role=doctor`);
      
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const appointments = await response.json();
      
      // Convert appointments to payment format with fixed consultation fee
      const paymentData = appointments.map((appointment: any) => ({
        id: appointment.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        amount: 500, // Fixed consultation fee
        currency: "INR",
        status: appointment.status === "ACCEPTED" ? "COMPLETED" : 
                appointment.status === "PENDING" ? "PENDING" : "FAILED",
        method: "UPI",
        transactionId: `TXN_${appointment.id.slice(-8)}`,
        upiId: "9482907443@upi",
        paidAt: appointment.status === "ACCEPTED" ? appointment.updatedAt : null,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        patient_username: appointment.patient.username,
        doctor_username: appointment.doctor.username,
        appointment_date: appointment.scheduledAt,
        appointment_reason: appointment.reason || "Consultation",
        logs: [] // No logs for simplified version
      }));
      
      setPayments(paymentData);
    } catch (err) {
      setError("Failed to load payments");
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch appointments for this doctor
      const response = await fetch(`/api/appointments?username=${encodeURIComponent(username)}&role=doctor`);
      
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const appointments = await response.json();
      
      // Calculate statistics from appointments
      const totalAppointments = appointments.length;
      const acceptedAppointments = appointments.filter((apt: any) => apt.status === "ACCEPTED");
      const totalAmount = acceptedAppointments.length * 500; // 500 per consultation
      const averageAmount = totalAppointments > 0 ? totalAmount / totalAppointments : 0;
      
      const statsData = {
        total_payments: totalAppointments,
        total_amount: totalAmount,
        successful_payments: acceptedAppointments.length,
        failed_payments: appointments.filter((apt: any) => apt.status === "DECLINED").length,
        average_amount: averageAmount
      };
      
      setStats(statsData);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "PROCESSING":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "FAILED":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "PENDING":
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "UPI":
        return "📱";
      case "CARD":
        return "💳";
      case "NET_BANKING":
        return "🏦";
      case "WALLET":
        return "💰";
      default:
        return "💳";
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="border border-white/10 rounded p-4">
        <div className="text-sm opacity-80">Loading payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-white/10 rounded p-4">
        <div className="text-sm text-red-500">{error}</div>
        <button
          onClick={fetchPayments}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {formatAmount(stats.total_amount || 0)}
            </div>
            <div className="text-sm opacity-70">Total Earnings</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">
              {stats.total_payments || 0}
            </div>
            <div className="text-sm opacity-70">Total Payments</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">
              {stats.successful_payments || 0}
            </div>
            <div className="text-sm opacity-70">Successful</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {formatAmount(stats.average_amount || 0)}
            </div>
            <div className="text-sm opacity-70">Average Amount</div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-medium">Payment History</h3>
        </div>
        
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm opacity-70">
            No payments found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr className="text-left">
                  <th className="p-4 text-sm font-medium opacity-70">Patient</th>
                  <th className="p-4 text-sm font-medium opacity-70">Amount</th>
                  <th className="p-4 text-sm font-medium opacity-70">Method</th>
                  <th className="p-4 text-sm font-medium opacity-70">Status</th>
                  <th className="p-4 text-sm font-medium opacity-70">Date</th>
                  <th className="p-4 text-sm font-medium opacity-70">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{payment.patient_username}</div>
                        <div className="text-xs opacity-70">
                          {payment.appointment_reason || "Consultation"}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{formatAmount(payment.amount)}</div>
                      {payment.transactionId && (
                        <div className="text-xs opacity-50 font-mono">
                          {payment.transactionId}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span>{getMethodIcon(payment.method)}</span>
                        <span className="text-sm">{payment.method}</span>
                      </div>
                      {payment.upiId && (
                        <div className="text-xs opacity-70">{payment.upiId}</div>
                      )}
                      {payment.cardLast4 && (
                        <div className="text-xs opacity-70">
                          **** **** **** {payment.cardLast4}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                      {payment.paidAt && (
                        <div className="text-xs opacity-70 mt-1">
                          Paid: {formatDate(payment.paidAt)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{formatDate(payment.createdAt)}</div>
                      <div className="text-xs opacity-70">
                        {formatDate(payment.appointment_date)}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowLogs(true);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm underline"
                      >
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Logs Modal */}
      {showLogs && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Payment Logs</h3>
              <button
                onClick={() => setShowLogs(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {/* Payment Details */}
              <div className="bg-white/5 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Payment Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="opacity-70">Patient:</span> {selectedPayment.patient_username}
                  </div>
                  <div>
                    <span className="opacity-70">Amount:</span> {formatAmount(selectedPayment.amount)}
                  </div>
                  <div>
                    <span className="opacity-70">Method:</span> {selectedPayment.method}
                  </div>
                  <div>
                    <span className="opacity-70">Status:</span> {selectedPayment.status}
                  </div>
                  <div>
                    <span className="opacity-70">Transaction ID:</span> {selectedPayment.transactionId}
                  </div>
                  <div>
                    <span className="opacity-70">Created:</span> {formatDate(selectedPayment.createdAt)}
                  </div>
                </div>
              </div>

              {/* Logs */}
              <div>
                <h4 className="font-medium mb-2">Activity Logs</h4>
                <div className="space-y-2">
                  {selectedPayment.logs.map((log, index) => (
                    <div key={log.id} className="bg-white/5 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{log.action}</span>
                        <span className="text-xs opacity-70">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="text-xs opacity-70">
                        Status: {log.status}
                        {log.amount && ` • Amount: ${formatAmount(log.amount)}`}
                      </div>
                      {log.metadata && (
                        <div className="text-xs opacity-50 mt-1 font-mono">
                          {log.metadata}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
