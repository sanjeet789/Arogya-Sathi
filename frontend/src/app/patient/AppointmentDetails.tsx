"use client";

import React, { useEffect, useState } from "react";
import BookTestModal from "./BookTestModal";

type AppointmentTranscription = {
  id: string;
  text: string;
  createdAt: string;
};

type MedicalTest = {
  TestID: string;
  TestName: string;
};

type PaymentInfo = {
  payment_id?: string;
  payment_amount?: number;
  payment_status?: string;
  payment_method?: string;
  payment_transaction_id?: string;
  payment_upi_id?: string;
  payment_paid_at?: string;
  payment_gateway_response?: string;
};

type AppointmentDetails = {
  id: string;
  scheduledAt: string;
  reason?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  aiNotes?: string | null;
  prescription?: string | null;
  prescriptionPdf?: string | null;
  recommendedTests?: string | null;
  doctor: { username: string };
  patient: { username: string };
  transcriptions: AppointmentTranscription[];
  payment?: PaymentInfo;
};

type AppointmentDetailsModalProps = {
  appointmentId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
};

export default function AppointmentDetailsModal({ appointmentId, onClose, onDeleted }: AppointmentDetailsModalProps) {
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicalTests, setMedicalTests] = useState<MedicalTest[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId) {
      fetchAppointmentDetails();
      fetchMedicalTests();
    }
  }, [appointmentId]);

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

  const fetchAppointmentDetails = async () => {
    if (!appointmentId) return;

    setLoading(true);
    setError(null);
    try {
      // First get appointment details
      const res = await fetch(`/api/appointments?id=${encodeURIComponent(appointmentId)}`);
      const data = await res.json();
      if (res.ok) {
        // Then get payment information
        const BACKEND_BASE = process.env.NEXT_PUBLIC_STT_BACKEND_URL || "http://localhost:8080";
        try {
          const paymentResponse = await fetch(`${BACKEND_BASE}/appointment/${appointmentId}/payment`);

          if (paymentResponse.ok) {
            const paymentData = await paymentResponse.json();
            if (paymentData.appointment) {
              // Merge payment information into appointment data
              data.payment = {
                payment_id: paymentData.appointment.payment_id,
                payment_amount: paymentData.appointment.payment_amount,
                payment_status: paymentData.appointment.payment_status,
                payment_method: paymentData.appointment.payment_method,
                payment_transaction_id: paymentData.appointment.payment_transaction_id,
                payment_upi_id: paymentData.appointment.payment_upi_id,
                payment_paid_at: paymentData.appointment.payment_paid_at,
                payment_gateway_response: paymentData.appointment.payment_gateway_response,
              };
            }
          }
        } catch (paymentErr) {
          console.log("Payment information not available:", paymentErr);
        }

        setAppointment(data);
      } else {
        setError(data.error || "Failed to load appointment details");
      }
    } catch (err) {
      setError("Failed to load appointment details");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const parsePrescription = (prescriptionJson?: string | null) => {
    if (!prescriptionJson) return null;
    try {
      return JSON.parse(prescriptionJson);
    } catch {
      return null;
    }
  };

  const parseRecommendedTests = (testsJson?: string | null) => {
    if (!testsJson) return [];
    try {
      return JSON.parse(testsJson);
    } catch {
      return [];
    }
  };

  const getTestName = (testId: string) => {
    const test = medicalTests.find(t => t.TestID === testId);
    return test ? test.TestName : `Test ID: ${testId}`;
  };

  const handleBookTest = (testId: string) => {
    setSelectedTestId(testId);
    setShowBookingModal(true);
  };

  const handleBookingSuccess = () => {
    setShowBookingModal(false);
    setSelectedTestId(undefined);
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/appointments?id=${encodeURIComponent(appointmentId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (onDeleted) onDeleted();
        onClose();
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete appointment");
      }
    } catch {
      setDeleteError("Failed to delete appointment");
    } finally {
      setDeleting(false);
    }
  };

  if (!appointmentId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border border-white/10 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Appointment Details</h2>
          <div className="flex items-center gap-2">
            {/* Delete button */}
            {appointment && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete appointment"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Delete confirmation banner */}
        {showDeleteConfirm && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-red-400">Delete this appointment?</div>
              <div className="text-xs text-red-400/70 mt-0.5">This action cannot be undone. All related data will be removed.</div>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                className="px-3 py-1.5 text-xs border border-white/20 rounded hover:bg-white/5 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAppointment}
                disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        )}
        {deleteError && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 flex items-center justify-between">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="text-red-300 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="text-center py-8">
              <div className="text-sm opacity-80">Loading appointment details...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-sm text-red-500">{error}</div>
              <button
                onClick={fetchAppointmentDetails}
                className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Try again
              </button>
            </div>
          )}

          {appointment && (
            <>
              {/* Basic Information */}
              <div className="border border-white/10 rounded p-4">
                <h3 className="font-medium mb-3">Basic Information</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm opacity-70">Doctor</div>
                    <div className="font-medium">Dr. {appointment.doctor.username}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70">Status</div>
                    <div className="text-xs px-2 py-1 rounded border border-white/20 inline-block">
                      {appointment.status}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70">Date</div>
                    <div className="font-medium">{formatDateTime(appointment.scheduledAt).date}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70">Time</div>
                    <div className="font-medium">{formatDateTime(appointment.scheduledAt).time}</div>
                  </div>
                  {appointment.reason && (
                    <div className="md:col-span-2">
                      <div className="text-sm opacity-70">Reason for Visit</div>
                      <div className="font-medium">{appointment.reason}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Meeting Link */}
              {appointment.status === "ACCEPTED" && (
                <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h3 className="font-medium text-green-400">Video Consultation</h3>
                  </div>

                  {/* Google Meet Join Section */}
                  <div className="bg-white/5 p-4 rounded border border-white/10">
                    <div className="text-sm mb-3">Join your video consultation with Dr. {appointment.doctor.username}:</div>

                    {/* Join Button */}
                    <div className="flex items-center justify-center mb-3">
                      <a
                        href="https://meet.google.com/xqr-xwhj-uwr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Join Video Call
                      </a>
                    </div>

                    {/* Meeting Info */}
                    <div className="bg-white/10 p-3 rounded border border-white/20">
                      <div className="text-xs opacity-70 mb-1">Meeting Link:</div>
                      <div className="text-sm font-mono break-all text-green-400">
                        https://meet.google.com/xqr-xwhj-uwr
                      </div>
                      <div className="text-xs opacity-70 mt-2">
                        Click "Join Video Call" to open Google Meet in a new tab
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Information */}
              {appointment.payment && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">Payment Information</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-sm opacity-70">Payment Status</div>
                      <div className={`text-xs px-2 py-1 rounded border inline-block ${appointment.payment.payment_status === 'COMPLETED'
                          ? 'border-green-500/30 bg-green-500/10 text-green-400'
                          : appointment.payment.payment_status === 'PENDING'
                            ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                            : 'border-red-500/30 bg-red-500/10 text-red-400'
                        }`}>
                        {appointment.payment.payment_status}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm opacity-70">Payment Method</div>
                      <div className="font-medium">{appointment.payment.payment_method}</div>
                    </div>
                    {appointment.payment.payment_amount && (
                      <div>
                        <div className="text-sm opacity-70">Amount</div>
                        <div className="font-medium">₹{appointment.payment.payment_amount}</div>
                      </div>
                    )}
                    {appointment.payment.payment_transaction_id && (
                      <div>
                        <div className="text-sm opacity-70">Transaction ID</div>
                        <div className="font-mono text-xs">{appointment.payment.payment_transaction_id}</div>
                      </div>
                    )}
                    {appointment.payment.payment_upi_id && (
                      <div>
                        <div className="text-sm opacity-70">UPI ID</div>
                        <div className="font-mono text-xs">{appointment.payment.payment_upi_id}</div>
                      </div>
                    )}
                    {appointment.payment.payment_paid_at && (
                      <div className="md:col-span-2">
                        <div className="text-sm opacity-70">Payment Date</div>
                        <div className="font-medium">{formatDateTime(appointment.payment.payment_paid_at).date} at {formatDateTime(appointment.payment.payment_paid_at).time}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Doctor's Notes */}
              {appointment.notes && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">Doctor's Notes</h3>
                  <div className="text-sm whitespace-pre-wrap bg-white/5 p-3 rounded">
                    {appointment.notes}
                  </div>
                </div>
              )}

              {/* AI Notes */}
              {appointment.aiNotes && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">AI Notes</h3>
                  <div className="text-sm whitespace-pre-wrap bg-white/5 p-3 rounded">
                    {appointment.aiNotes}
                  </div>
                </div>
              )}

              {/* Prescription */}
              {appointment.prescription && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">Prescription</h3>
                  {(() => {
                    const prescriptionData = parsePrescription(appointment.prescription);
                    if (!prescriptionData) {
                      return (
                        <div className="text-sm whitespace-pre-wrap bg-white/5 p-3 rounded">
                          {appointment.prescription}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 bg-white/5 p-4 rounded">
                        {/* Clinic Details */}
                        {(prescriptionData.clinicName || prescriptionData.clinicAddress || prescriptionData.clinicPhone) && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Clinic Details</h4>
                            <div className="text-sm space-y-1">
                              {prescriptionData.clinicName && <div><strong>Name:</strong> {prescriptionData.clinicName}</div>}
                              {prescriptionData.clinicAddress && <div><strong>Address:</strong> {prescriptionData.clinicAddress}</div>}
                              {prescriptionData.clinicPhone && <div><strong>Phone:</strong> {prescriptionData.clinicPhone}</div>}
                            </div>
                          </div>
                        )}

                        {/* Diagnosis */}
                        {prescriptionData.diagnosis && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Diagnosis</h4>
                            <div className="text-sm bg-white/10 p-3 rounded">
                              {prescriptionData.diagnosis}
                            </div>
                          </div>
                        )}

                        {/* Medications */}
                        {prescriptionData.medications && prescriptionData.medications.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Medications</h4>
                            <div className="space-y-2">
                              {prescriptionData.medications.map((med: any, index: number) => (
                                <div key={index} className="bg-white/10 p-3 rounded border border-white/10">
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                    <div>
                                      <span className="opacity-70">Name:</span>
                                      <div className="font-medium">{med.name || '-'}</div>
                                    </div>
                                    <div>
                                      <span className="opacity-70">Dosage:</span>
                                      <div className="font-medium">{med.dosage || '-'}</div>
                                    </div>
                                    <div>
                                      <span className="opacity-70">Frequency:</span>
                                      <div className="font-medium">{med.frequency || '-'}</div>
                                    </div>
                                    <div>
                                      <span className="opacity-70">Duration:</span>
                                      <div className="font-medium">{med.duration || '-'}</div>
                                    </div>
                                    <div className="md:col-span-1 col-span-2">
                                      <span className="opacity-70">Notes:</span>
                                      <div className="font-medium">{med.notes || '-'}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommended Tests */}
                        {prescriptionData.recommendedTests && prescriptionData.recommendedTests.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Recommended Tests</h4>
                            <div className="text-sm bg-white/10 p-3 rounded">
                              <ul className="list-disc list-inside space-y-1">
                                {prescriptionData.recommendedTests.map((test: string, index: number) => (
                                  <li key={index}>{test}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Advice */}
                        {prescriptionData.advice && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Advice</h4>
                            <div className="text-sm bg-white/10 p-3 rounded">
                              {prescriptionData.advice}
                            </div>
                          </div>
                        )}

                        {/* Follow-up */}
                        {prescriptionData.followUp && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Follow-up</h4>
                            <div className="text-sm bg-white/10 p-3 rounded">
                              {prescriptionData.followUp}
                            </div>
                          </div>
                        )}

                        {/* Signature */}
                        {prescriptionData.signature && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">Doctor Signature</h4>
                            <div className="text-sm bg-white/10 p-3 rounded text-right">
                              {prescriptionData.signature.startsWith('data:image') ? (
                                <img
                                  src={prescriptionData.signature}
                                  alt="Doctor Signature"
                                  className="max-h-12 max-w-48 inline-block"
                                />
                              ) : (
                                prescriptionData.signature
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Prescription PDF */}
              {appointment.prescriptionPdf && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">Prescription Document</h3>
                  <div className="text-sm">
                    <a
                      href={`data:application/pdf;base64,${appointment.prescriptionPdf}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      View Prescription PDF
                    </a>
                  </div>
                </div>
              )}

              {/* Recommended Tests */}
              {appointment.recommendedTests && parseRecommendedTests(appointment.recommendedTests).length > 0 && (
                <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-medium text-blue-400">Recommended Tests</h3>
                  </div>
                  <div className="space-y-3">
                    {parseRecommendedTests(appointment.recommendedTests).map((testId: string, index: number) => {
                      const testName = getTestName(testId);
                      return (
                        <div key={testId} className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{testName}</div>
                            <div className="text-xs opacity-70 mt-1">Recommended by Dr. {appointment.doctor.username}</div>
                          </div>
                          <button
                            onClick={() => handleBookTest(testId)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            Book Test
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs opacity-70">
                    Click "Book Test" to schedule your recommended medical tests with preferred date and time.
                  </div>
                </div>
              )}

              {/* Transcriptions */}
              {appointment.transcriptions && appointment.transcriptions.length > 0 && (
                <div className="border border-white/10 rounded p-4">
                  <h3 className="font-medium mb-3">Consultation Transcript</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {appointment.transcriptions.map((transcription, index) => (
                      <div key={transcription.id} className="bg-white/5 p-3 rounded">
                        <div className="text-xs opacity-60 mb-1">
                          {formatDateTime(transcription.createdAt).date} at {formatDateTime(transcription.createdAt).time}
                        </div>
                        <div className="text-sm">{transcription.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for appointments with no additional data */}
              {!appointment.notes && !appointment.aiNotes && !appointment.prescription &&
                !appointment.prescriptionPdf && !appointment.recommendedTests &&
                (!appointment.transcriptions || appointment.transcriptions.length === 0) && (
                  <div className="text-center py-8 text-sm opacity-70">
                    No additional details available for this appointment.
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* Book Test Modal */}
      <BookTestModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        patientUsername={appointment?.patient?.username || ''}
        preSelectedTestId={selectedTestId}
        appointmentId={appointment?.id}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
