"""
Custom Payment Service for AarogyaAI
Handles UPI payments with saswatsusmoy@upi integration
"""

import json
import uuid
import hashlib
import hmac
import time
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import asyncio

try:
    import asyncpg
    ASYNCPG_AVAILABLE = True
except ImportError:
    ASYNCPG_AVAILABLE = False
    asyncpg = None

from .config import settings


@dataclass
class PaymentRequest:
    appointment_id: str
    patient_id: str
    doctor_id: str
    amount: float
    method: str = "UPI"
    upi_id: Optional[str] = None


@dataclass
class PaymentResponse:
    success: bool
    transaction_id: Optional[str] = None
    payment_url: Optional[str] = None
    qr_code: Optional[str] = None
    error_message: Optional[str] = None


class PaymentService:
    """Custom payment service for AarogyaAI"""
    
    def __init__(self):
        self.database_url = settings.database_url
        self.merchant_upi_id = "9482907443@upi"
        self.merchant_name = "Aarogya-Sathi"
        self.base_url = "https://aarogyaai.com"  # Replace with actual domain
        
    async def create_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Create a new payment request"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return PaymentResponse(success=False, error_message="Database not available")
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Generate transaction ID
                    transaction_id = f"TXN_{int(time.time())}_{str(uuid.uuid4())[:8].upper()}"
                    
                    # Create payment record
                    payment_id = str(uuid.uuid4())
                    await conn.execute("""
                        INSERT INTO "Payment" (
                            id, "appointmentId", "patientId", "doctorId", 
                            amount, currency, status, method, "transactionId"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """, payment_id, request.appointment_id, request.patient_id, 
                        request.doctor_id, request.amount, "INR", "PENDING", 
                        request.method, transaction_id)
                    
                    # Log payment creation
                    await self._log_payment_action(
                        conn, payment_id, "created", "PENDING", request.amount
                    )
                    
                    # Generate UPI payment URL (for reference)
                    upi_url = self._generate_upi_url(request.amount, transaction_id)
                    
                    # Use placeholder QR code data
                    qr_data = "QR_CODE_PLACEHOLDER"
                    
                    # Update payment with UPI details
                    await conn.execute("""
                        UPDATE "Payment" 
                        SET "upiId" = $1, "gatewayResponse" = $2
                        WHERE id = $3
                    """, request.upi_id or self.merchant_upi_id, json.dumps({"upi_url": upi_url, "qr_code": qr_data}), payment_id)
                    
                    # Log UPI payment initiation
                    await self._log_payment_action(
                        conn, payment_id, "initiated", "PROCESSING", request.amount,
                        metadata=json.dumps({"method": "UPI", "upi_url": upi_url, "qr_code": qr_data})
                    )
                    
                    return PaymentResponse(
                        success=True,
                        transaction_id=transaction_id,
                        payment_url=upi_url,
                        qr_code=qr_data
                    )
                        
        except Exception as e:
            return PaymentResponse(success=False, error_message=f"Payment creation failed: {str(e)}")
    
    def _generate_upi_url(self, amount: float, transaction_id: str) -> str:
        """Generate UPI payment URL"""
        # Format: upi://pay?pa=merchant@upi&pn=MerchantName&am=amount&cu=INR&tn=transaction_note&tr=transaction_id
        params = {
            "pa": self.merchant_upi_id,
            "pn": self.merchant_name,
            "am": str(amount),
            "cu": "INR",
            "tn": f"AarogyaAI Consultation - {transaction_id}",
            "tr": transaction_id
        }
        
        query_string = "&".join([f"{key}={value}" for key, value in params.items()])
        return f"upi://pay?{query_string}"
    
    async def verify_payment(self, transaction_id: str) -> Dict[str, Any]:
        """Verify payment status"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return {"success": False, "error": "Database not available"}
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Get payment details
                    payment = await conn.fetchrow("""
                        SELECT * FROM "Payment" WHERE "transactionId" = $1
                    """, transaction_id)
                    
                    if not payment:
                        return {"success": False, "error": "Payment not found"}
                    
                    # Simulate payment verification (in real implementation, check with payment gateway)
                    # For demo purposes, we'll simulate successful payment after 5 seconds
                    payment_age = datetime.now() - payment["createdAt"]
                    
                    if payment_age.total_seconds() > 5 and payment["status"] == "PROCESSING":
                        # Simulate successful payment
                        await self._complete_payment(conn, payment["id"], transaction_id)
                        return {"success": True, "status": "COMPLETED"}
                    elif payment["status"] == "COMPLETED":
                        return {"success": True, "status": "COMPLETED"}
                    elif payment["status"] == "FAILED":
                        return {"success": False, "status": "FAILED"}
                    else:
                        return {"success": True, "status": "PROCESSING"}
                        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _complete_payment(self, conn, payment_id: str, transaction_id: str):
        """Mark payment as completed and update appointment status"""
        # Update payment status
        await conn.execute("""
            UPDATE "Payment" 
            SET status = $1, "paidAt" = $2
            WHERE id = $3
        """, "COMPLETED", datetime.now(), payment_id)
        
        # Update appointment status to ACCEPTED (paid)
        await conn.execute("""
            UPDATE "Appointment" 
            SET status = $1
            WHERE id = (
                SELECT "appointmentId" FROM "Payment" WHERE id = $2
            )
        """, "ACCEPTED", payment_id)
        
        # Log payment completion
        await self._log_payment_action(
            conn, payment_id, "completed", "COMPLETED", None,
            metadata=json.dumps({"transaction_id": transaction_id, "appointment_status": "ACCEPTED"})
        )
    
    async def _log_payment_action(self, conn, payment_id: str, action: str, status: str, 
                                 amount: Optional[float] = None, metadata: Optional[str] = None):
        """Log payment action"""
        await conn.execute("""
            INSERT INTO "PaymentLog" (
                id, "paymentId", action, status, amount, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """, str(uuid.uuid4()), payment_id, action, status, amount, metadata)
    
    async def get_payment_logs(self, doctor_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get payment logs for doctor"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return []
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Get payments for doctor with logs (exclude declined appointments)
                    payments = await conn.fetch("""
                        SELECT 
                            p.*,
                            u1.username as patient_username,
                            u2.username as doctor_username,
                            a."scheduledAt" as appointment_date,
                            a.reason as appointment_reason,
                            a.status as appointment_status
                        FROM "Payment" p
                        JOIN "User" u1 ON p."patientId" = u1.id
                        JOIN "User" u2 ON p."doctorId" = u2.id
                        JOIN "Appointment" a ON p."appointmentId" = a.id
                        WHERE p."doctorId" = $1 AND a.status != 'DECLINED'
                        ORDER BY p."createdAt" DESC
                        LIMIT $2
                    """, doctor_id, limit)
                    
                    # Get logs for each payment and flatten the structure
                    result = []
                    for payment in payments:
                        logs = await conn.fetch("""
                            SELECT * FROM "PaymentLog" 
                            WHERE "paymentId" = $1 
                            ORDER BY "createdAt" ASC
                        """, payment["id"])
                        
                        # Flatten payment data and add logs
                        payment_dict = dict(payment)
                        payment_dict["logs"] = [dict(log) for log in logs]
                        result.append(payment_dict)
                    
                    return result
                    
        except Exception as e:
            print(f"Error getting payment logs: {e}")
            return []
    
    async def get_payment_statistics(self, doctor_id: str) -> Dict[str, Any]:
        """Get payment statistics for doctor"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return {}
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Get payment statistics (exclude declined appointments)
                    stats = await conn.fetchrow("""
                        SELECT 
                            COUNT(*) as total_payments,
                            SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END) as total_amount,
                            SUM(CASE WHEN p.status = 'COMPLETED' THEN 1 ELSE 0 END) as successful_payments,
                            SUM(CASE WHEN p.status = 'FAILED' THEN 1 ELSE 0 END) as failed_payments,
                            AVG(CASE WHEN p.status = 'COMPLETED' THEN p.amount END) as average_amount
                        FROM "Payment" p
                        JOIN "Appointment" a ON p."appointmentId" = a.id
                        WHERE p."doctorId" = $1 AND a.status != 'DECLINED'
                    """, doctor_id)
                    
                    return dict(stats) if stats else {}
                    
        except Exception as e:
            print(f"Error getting payment statistics: {e}")
            return {}
    
    async def get_appointment_with_payment(self, appointment_id: str) -> Dict[str, Any]:
        """Get appointment details with payment information"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return {}
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Get appointment with payment details
                    appointment = await conn.fetchrow("""
                        SELECT 
                            a.*,
                            p.id as payment_id,
                            p.amount as payment_amount,
                            p.status as payment_status,
                            p.method as payment_method,
                            p."transactionId" as payment_transaction_id,
                            p."upiId" as payment_upi_id,
                            p."paidAt" as payment_paid_at,
                            p."gatewayResponse" as payment_gateway_response,
                            u1.username as patient_username,
                            u2.username as doctor_username
                        FROM "Appointment" a
                        LEFT JOIN "Payment" p ON a.id = p."appointmentId"
                        LEFT JOIN "User" u1 ON a."patientId" = u1.id
                        LEFT JOIN "User" u2 ON a."doctorId" = u2.id
                        WHERE a.id = $1
                    """, appointment_id)
                    
                    if not appointment:
                        return {}
                    
                    # Get payment logs if payment exists
                    payment_logs = []
                    if appointment["payment_id"]:
                        logs = await conn.fetch("""
                            SELECT * FROM "PaymentLog" 
                            WHERE "paymentId" = $1 
                            ORDER BY "createdAt" ASC
                        """, appointment["payment_id"])
                        payment_logs = [dict(log) for log in logs]
                    
                    return {
                        "appointment": dict(appointment),
                        "payment_logs": payment_logs
                    }
                    
        except Exception as e:
            print(f"Error getting appointment with payment: {e}")
            return {}
    
    async def complete_payment_immediately(self, transaction_id: str, upi_transaction_id: str = None) -> Dict[str, Any]:
        """Complete payment immediately for POC testing purposes"""
        if not self.database_url or not ASYNCPG_AVAILABLE:
            return {"success": False, "error": "Database not available"}
        
        try:
            async with asyncpg.create_pool(self.database_url) as pool:
                async with pool.acquire() as conn:
                    # Get payment details
                    payment = await conn.fetchrow("""
                        SELECT * FROM "Payment" WHERE "transactionId" = $1
                    """, transaction_id)
                    
                    if not payment:
                        return {"success": False, "error": "Payment not found"}
                    
                    if payment["status"] == "COMPLETED":
                        return {"success": True, "status": "COMPLETED", "message": "Payment already completed"}
                    
                    # POC: Complete the payment with UPI transaction ID (mock completion)
                    await self._complete_payment_with_upi_id(conn, payment["id"], transaction_id, upi_transaction_id)
                    return {"success": True, "status": "COMPLETED", "message": "Payment completed successfully (POC Demo)"}
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _complete_payment_with_upi_id(self, conn, payment_id: str, transaction_id: str, upi_transaction_id: str = None):
        """Mark payment as completed with UPI transaction ID"""
        # Update payment status with UPI transaction ID
        await conn.execute("""
            UPDATE "Payment" 
            SET status = $1, "paidAt" = $2, "transactionId" = $3
            WHERE id = $4
        """, "COMPLETED", datetime.now(), upi_transaction_id or transaction_id, payment_id)
        
        # Update appointment status to ACCEPTED (paid)
        await conn.execute("""
            UPDATE "Appointment" 
            SET status = $1
            WHERE id = (
                SELECT "appointmentId" FROM "Payment" WHERE id = $2
            )
        """, "ACCEPTED", payment_id)
        
        # Log payment completion
        await self._log_payment_action(
            conn, payment_id, "completed", "COMPLETED", None,
            metadata=json.dumps({
                "transaction_id": transaction_id, 
                "upi_transaction_id": upi_transaction_id,
                "appointment_status": "ACCEPTED"
            })
        )


# Global instance
payment_service = PaymentService()