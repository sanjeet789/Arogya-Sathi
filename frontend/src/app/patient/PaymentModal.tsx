"use client";

import React, { useState, useEffect } from "react";

type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  doctorName: string;
  appointmentDate: string;
};

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentId,
  patientId,
  doctorId,
  amount,
  doctorName,
  appointmentDate,
}: PaymentModalProps) {
  const [upiTransactionId, setUpiTransactionId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setUpiTransactionId("");
      setError(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const savePayment = async () => {
    if (!upiTransactionId.trim()) {
      setError("Please enter the transaction ID");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Save payment directly to database
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentId: appointmentId,
          patientId: patientId,
          doctorId: doctorId,
          amount: amount,
          method: "UPI",
          transactionId: upiTransactionId.trim(),
          status: "COMPLETED"
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Payment saved successfully, complete the booking
        onSuccess();
        onClose();
      } else {
        setError(result.error || "Failed to save payment");
      }
    } catch (err) {
      setError("Failed to save payment. Please try again.");
      console.error("Payment save error:", err);
    } finally {
      setIsProcessing(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border border-white/10 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Payment</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Payment Summary */}
          <div className="bg-white/5 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Payment Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Doctor:</span>
                <span>Dr. {doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Date:</span>
                <span>{new Date(appointmentDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Amount:</span>
                <span>₹{amount}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h3 className="font-medium mb-3">Payment Method</h3>
            <div className="p-3 rounded-lg border border-blue-500 bg-blue-500/10 text-blue-400">
              <div className="text-center">
                <div className="text-lg mb-1">📱</div>
                <div className="text-sm font-medium">UPI Payment</div>
              </div>
            </div>
          </div>

          {/* UPI QR Code Placeholder */}
          <div className="text-center space-y-4">
            <div className="bg-white p-6 rounded-lg inline-block">
              <div className="text-sm text-gray-600 mb-3">QR Code Placeholder</div>
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400">
                <div className="text-gray-500 text-center">
                  <div className="text-4xl mb-2">📱</div>
                  <div className="text-sm font-medium">QR Code</div>
                  <div className="text-xs opacity-70 mt-1">Placeholder</div>
                  <div className="text-xs opacity-70 mt-1">Amount: ₹{amount}</div>
                </div>
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <p className="text-sm font-medium">Pay to:</p>
              <p className="text-lg font-mono text-blue-400">9482907443@upi</p>
              <p className="text-xs opacity-70 mt-1">Use your UPI app to scan and pay</p>
            </div>
          </div>

          {/* Transaction ID Input */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Enter UPI Transaction ID</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none"
                placeholder="e.g., 123456789012"
                value={upiTransactionId}
                onChange={(e) => setUpiTransactionId(e.target.value)}
              />
              <p className="text-xs opacity-70 mt-1">
                Enter the transaction ID from your UPI app after making the payment
              </p>
            </div>
          </div>


          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded border border-white/20 hover:border-white/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={savePayment}
              disabled={isProcessing || !upiTransactionId.trim()}
              className="flex-1 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? "Saving..." : "Done"}
            </button>
          </div>


          {/* Security Notice */}
          <div className="text-xs opacity-50 text-center">
            Your payment information is secure and encrypted
          </div>
        </div>
      </div>
    </div>
  );
}
