from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uuid

from .config import validate_settings, settings
from .stt_manager import stt_manager
from .ai_notes import generate_notes_and_prescription
from .patient_chatbot import generate_chatbot_response
from .chat_history import chat_history_service
from .payment_service import payment_service, PaymentRequest
from .meet_transcriber import meet_transcriber_manager, MeetTranscriptionRequest


class StartResponse(BaseModel):
    session_id: str


class StopRequest(BaseModel):
    session_id: str


class StopResponse(BaseModel):
    ok: bool


app = FastAPI(title="AarogyaAI STT Service", version="0.1.0")

# Allow frontend origin to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Consider restricting in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/stt/session/start", response_model=StartResponse)
async def start_session() -> StartResponse:
    # If Cartesia is not configured, return a dummy session id so UI can proceed
    if not settings.cartesia_api_key:
        return StartResponse(session_id=str(uuid.uuid4()))
    try:
        validate_settings()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    session_id = await stt_manager.start_session()
    return StartResponse(session_id=session_id)


@app.post("/stt/session/stop", response_model=StopResponse)
async def stop_session(payload: StopRequest) -> StopResponse:
    # If there was no real session (e.g., dummy id), just return ok
    if not settings.cartesia_api_key:
        return StopResponse(ok=True)
    ok = await stt_manager.stop_session(payload.session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return StopResponse(ok=True)


class TranscriptPayload(BaseModel):
    transcript: str


class NotesResponse(BaseModel):
    notes: str
    prescription: dict


class ChatbotPayload(BaseModel):
    patient_id: str
    message: str


class ChatbotResponse(BaseModel):
    response: str


class ChatHistoryResponse(BaseModel):
    messages: list




class PaymentLogsResponse(BaseModel):
    payments: list


class PaymentStatsResponse(BaseModel):
    statistics: dict


@app.post("/ai/notes", response_model=NotesResponse)
async def generate_ai_notes(payload: TranscriptPayload) -> NotesResponse:
    try:
        # Validate Cerebras env too; if not present, return 500
        validate_settings()
    except RuntimeError as e:
        # Still allow when only CARTESIA missing for STT by checking directly
        if "CARTESIA_API_KEY" in str(e) and settings.cerebras_api_key:
            pass
        else:
            raise HTTPException(status_code=500, detail=str(e))

    if not payload.transcript or not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required")

    try:
        notes, prescription = await generate_notes_and_prescription(payload.transcript.strip())
        return NotesResponse(notes=notes, prescription=prescription)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")


@app.post("/ai/chatbot", response_model=ChatbotResponse)
async def intelligent_chatbot(payload: ChatbotPayload) -> ChatbotResponse:
    """Intelligent chatbot endpoint that uses patient data and Cerebras AI."""
    try:
        # Validate Cerebras configuration
        if not settings.cerebras_api_key:
            raise HTTPException(status_code=500, detail="Cerebras AI not configured")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not payload.patient_id or not payload.patient_id.strip():
        raise HTTPException(status_code=400, detail="Patient ID is required")
    
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    patient_id = payload.patient_id.strip()
    user_message = payload.message.strip()

    try:
        # Save user message to chat history
        await chat_history_service.save_message(patient_id, user_message, is_user=True)
        
        # Generate chatbot response
        response = await generate_chatbot_response(patient_id, user_message)
        
        # Save bot response to chat history
        await chat_history_service.save_message(patient_id, response, is_user=False)
        
        return ChatbotResponse(response=response)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chatbot generation failed: {e}")


@app.get("/ai/chatbot/history/{patient_id}", response_model=ChatHistoryResponse)
async def get_chat_history(patient_id: str, limit: int = 50) -> ChatHistoryResponse:
    """Get chat history for a patient."""
    if not patient_id or not patient_id.strip():
        raise HTTPException(status_code=400, detail="Patient ID is required")
    
    try:
        messages = await chat_history_service.get_chat_history(patient_id.strip(), limit)
        return ChatHistoryResponse(messages=messages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat history: {e}")


@app.delete("/ai/chatbot/history/{patient_id}")
async def clear_chat_history(patient_id: str):
    """Clear chat history for a patient."""
    if not patient_id or not patient_id.strip():
        raise HTTPException(status_code=400, detail="Patient ID is required")
    
    try:
        success = await chat_history_service.clear_chat_history(patient_id.strip())
        if success:
            return {"message": "Chat history cleared successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear chat history")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear chat history: {e}")




@app.get("/payment/logs/{doctor_id}", response_model=PaymentLogsResponse)
async def get_payment_logs(doctor_id: str, limit: int = 50) -> PaymentLogsResponse:
    """Get payment logs for a doctor."""
    try:
        payments = await payment_service.get_payment_logs(doctor_id, limit)
        return PaymentLogsResponse(payments=payments)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve payment logs: {e}")


@app.get("/payment/stats/{doctor_id}", response_model=PaymentStatsResponse)
async def get_payment_statistics(doctor_id: str) -> PaymentStatsResponse:
    """Get payment statistics for a doctor."""
    try:
        statistics = await payment_service.get_payment_statistics(doctor_id)
        return PaymentStatsResponse(statistics=statistics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve payment statistics: {e}")






@app.get("/appointment/{appointment_id}/payment")
async def get_appointment_with_payment(appointment_id: str):
    """Get appointment details with payment information."""
    try:
        result = await payment_service.get_appointment_with_payment(appointment_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve appointment with payment: {e}")


class StopAndProcessRequest(BaseModel):
    session_id: str
    transcript: str


@app.post("/stt/session/stop_and_process", response_model=NotesResponse)
async def stop_and_process(payload: StopAndProcessRequest) -> NotesResponse:
    # Stop STT session if it exists (best-effort)
    try:
        await stt_manager.stop_session(payload.session_id)
    except Exception:
        pass

    if not payload.transcript or not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required")

    try:
        notes, prescription = await generate_notes_and_prescription(payload.transcript.strip())
        return NotesResponse(notes=notes, prescription=prescription)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")


# Meet Transcription Bot Endpoints

class MeetTranscriptionResponse(BaseModel):
    session_id: str
    status: str


class MeetTranscriptionStatus(BaseModel):
    session_id: str
    is_running: bool
    meet_url: str
    appointment_id: Optional[str] = None


class MeetTranscriptionData(BaseModel):
    session_id: str
    transcriptions: list


@app.post("/meet/transcription/start", response_model=MeetTranscriptionResponse)
async def start_meet_transcription(payload: MeetTranscriptionRequest) -> MeetTranscriptionResponse:
    """Start Google Meet transcription"""
    try:
        session_id = await meet_transcriber_manager.create_session(
            payload.meet_url, payload.appointment_id
        )
        return MeetTranscriptionResponse(session_id=session_id, status="started")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Meet transcription: {e}")


@app.post("/meet/transcription/stop", response_model=MeetTranscriptionResponse)
async def stop_meet_transcription(payload: StopRequest) -> MeetTranscriptionResponse:
    """Stop Google Meet transcription"""
    try:
        success = await meet_transcriber_manager.stop_session(payload.session_id)
        if success:
            return MeetTranscriptionResponse(session_id=payload.session_id, status="stopped")
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop Meet transcription: {e}")


@app.get("/meet/transcription/status/{session_id}", response_model=MeetTranscriptionStatus)
async def get_meet_transcription_status(session_id: str) -> MeetTranscriptionStatus:
    """Get Meet transcription status"""
    session = meet_transcriber_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return MeetTranscriptionStatus(
        session_id=session_id,
        is_running=session.is_running,
        meet_url=session.meet_url,
        appointment_id=session.appointment_id
    )


@app.get("/meet/transcription/data/{session_id}", response_model=MeetTranscriptionData)
async def get_meet_transcription_data(session_id: str) -> MeetTranscriptionData:
    """Get Meet transcription data"""
    session = meet_transcriber_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get transcriptions from the session
    transcriptions = session.get_transcriptions()
    
    return MeetTranscriptionData(
        session_id=session_id,
        transcriptions=transcriptions
    )


class AudioChunk(BaseModel):
    audio: str  # Base64 encoded audio


class TranscriptionText(BaseModel):
    text: str


@app.post("/meet/transcription/{session_id}")
async def receive_meet_transcription(session_id: str, payload: TranscriptionText):
    """Receive transcription text from frontend"""
    import time
    
    session = meet_transcriber_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Store the transcription
        current_time = time.time()
        transcription = {
            "text": payload.text,
            "timestamp": current_time
        }
        session.transcriptions.append(transcription)
        
        # Call callback if set
        if session.transcription_callback:
            session.transcription_callback(payload.text)
        
        return {"status": "ok", "text": payload.text, "timestamp": current_time}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store transcription: {e}")


@app.post("/meet/audio/{session_id}")
async def receive_meet_audio(session_id: str, payload: AudioChunk):
    """Receive audio chunks from frontend and process them"""
    import base64
    import asyncio
    
    session = meet_transcriber_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(payload.audio)
        
        # Process audio chunk
        await session.process_audio_chunk(audio_data)
        
        return {"status": "ok", "bytes_received": len(audio_data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {e}")
