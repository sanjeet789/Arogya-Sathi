"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";

export default function SpeechToText({ onStart, onFinal, onPartial, onStop, onMeetTranscription }: { onStart?: () => void; onFinal: (text: string) => void; onPartial?: (text: string) => void; onStop?: () => void; onMeetTranscription?: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [recognizer, setRecognizer] = useState<SpeechRecognition | null>(null as any);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showVideoSection, setShowVideoSection] = useState(false);
  const [meetTranscriptionActive, setMeetTranscriptionActive] = useState(false);
  const [meetSessionId, setMeetSessionId] = useState<string | null>(null);
  const [meetTranscriptions, setMeetTranscriptions] = useState<{ text: string; timestamp: number }[]>([]);
  const lastTranscriptionCountRef = useRef(0);
  const [audioCapturing, setAudioCapturing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const meetRecognizerRef = useRef<SpeechRecognition | null>(null);

  const BACKEND_BASE = process.env.NEXT_PUBLIC_STT_BACKEND_URL || "http://localhost:8080";

  const speechSupported = useMemo(() => {
    const w: any = typeof window !== "undefined" ? window : {};
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  // Fetch Meet transcription data periodically when active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (meetTranscriptionActive && meetSessionId) {
      const fetchTranscriptions = async () => {
        try {
          console.log(`[Meet Transcription] Fetching data for session: ${meetSessionId}`);
          const response = await fetch(`${BACKEND_BASE}/meet/transcription/data/${meetSessionId}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`[Meet Transcription] Received ${data.transcriptions?.length || 0} transcriptions, last count: ${lastTranscriptionCountRef.current}`);

            if (data.transcriptions && data.transcriptions.length > 0) {
              setMeetTranscriptions(data.transcriptions);

              // Send only new transcriptions to parent component
              if (data.transcriptions.length > lastTranscriptionCountRef.current) {
                const newTranscriptions = data.transcriptions.slice(lastTranscriptionCountRef.current);
                console.log(`[Meet Transcription] Sending ${newTranscriptions.length} new transcriptions to parent`);
                console.log(`[Meet Transcription] New transcriptions:`, newTranscriptions);

                newTranscriptions.forEach((transcription: any) => {
                  if (onMeetTranscription) {
                    console.log(`[Meet Transcription] Calling onMeetTranscription with:`, transcription.text);
                    onMeetTranscription(transcription.text);
                  } else {
                    console.warn(`[Meet Transcription] onMeetTranscription callback not available!`);
                  }
                });

                lastTranscriptionCountRef.current = data.transcriptions.length;
              } else {
                console.log(`[Meet Transcription] No new transcriptions (current: ${data.transcriptions.length}, last: ${lastTranscriptionCountRef.current})`);
              }
            }
          } else {
            console.error(`[Meet Transcription] API error: ${response.status}`);
          }
        } catch (err) {
          console.error("[Meet Transcription] Failed to fetch:", err);
        }
      };

      // Fetch immediately
      fetchTranscriptions();

      // Then fetch every 2 seconds
      interval = setInterval(fetchTranscriptions, 2000);
    } else {
      // Reset counter when stopping
      lastTranscriptionCountRef.current = 0;
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [meetTranscriptionActive, meetSessionId, onMeetTranscription, BACKEND_BASE]);

  const startAudioCapture = async (sessionId: string) => {
    try {
      console.log("[Audio Capture] Starting browser speech recognition with session:", sessionId);

      const w: any = window as any;
      const SR: any = w.SpeechRecognition || w.webkitSpeechRecognition;

      if (!SR) {
        setError("Speech recognition not supported. Please use Chrome or Edge.");
        return;
      }

      // Create speech recognizer for Meet audio
      const rec: SpeechRecognition = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = async (e: any) => {
        let finalText = "";

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += transcript + " ";
          }
        }

        if (finalText.trim()) {
          console.log("[Audio Capture] Final transcription:", finalText);

          // Send transcription directly to backend
          try {
            const response = await fetch(`${BACKEND_BASE}/meet/transcription/${sessionId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "AarogyaAI-Frontend/1.0.0"
              },
              body: JSON.stringify({ text: finalText.trim() })
            });

            if (response.ok) {
              console.log("[Audio Capture] Transcription sent to backend");
            } else {
              console.error("[Audio Capture] Failed to send transcription:", response.status);
            }
          } catch (err) {
            console.error("[Audio Capture] Failed to send transcription:", err);
          }
        }
      };

      rec.onerror = (err: any) => {
        console.error("[Audio Capture] Speech recognition error:", err);
        setError("Speech recognition error. Please try again.");
      };

      rec.onend = () => {
        console.log("[Audio Capture] Speech recognition ended");
        // Check if we should restart (only if still capturing)
        if (audioCapturing && meetTranscriptionActive) {
          // Restart if still active
          console.log("[Audio Capture] Restarting speech recognition...");
          try {
            rec.start();
          } catch (err) {
            console.error("[Audio Capture] Failed to restart:", err);
          }
        }
      };

      rec.start();
      meetRecognizerRef.current = rec;
      setAudioCapturing(true);
      console.log("[Audio Capture] Speech recognition started");

    } catch (err) {
      console.error("[Audio Capture] Failed to start:", err);
      setError("Failed to start speech recognition. Please try again.");
    }
  };

  const stopAudioCapture = () => {
    console.log("[Audio Capture] Stopping...");

    // Set capturing to false first to prevent restart
    setAudioCapturing(false);

    if (meetRecognizerRef.current) {
      try {
        meetRecognizerRef.current.stop();
      } catch (err) {
        console.error("[Audio Capture] Error stopping recognizer:", err);
      }
      meetRecognizerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    console.log("[Audio Capture] Stopped");
  };

  const toggleMeetTranscription = async () => {
    if (!meetTranscriptionActive) {
      // Start Meet transcription
      try {
        console.log("[Meet Transcription] Starting transcription...");
        const response = await fetch(`${BACKEND_BASE}/meet/transcription/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "AarogyaAI-Frontend/1.0.0"
          },
          body: JSON.stringify({
            meet_url: "https://meet.google.com/xqr-xwhj-uwr",
            appointment_id: "current-appointment"
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("[Meet Transcription] Started with session ID:", data.session_id);
          setMeetSessionId(data.session_id);
          setMeetTranscriptionActive(true);

          // Start audio capture with the session ID
          await startAudioCapture(data.session_id);
        } else {
          console.error("[Meet Transcription] Start failed:", response.status);
          setError("Failed to start Meet transcription");
        }
      } catch (err) {
        console.error("[Meet Transcription] Start error:", err);
        setError("Failed to start Meet transcription");
      }
    } else {
      // Stop Meet transcription
      try {
        // Stop audio capture first
        stopAudioCapture();

        if (meetSessionId) {
          const response = await fetch(`${BACKEND_BASE}/meet/transcription/stop`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "AarogyaAI-Frontend/1.0.0"
            },
            body: JSON.stringify({ session_id: meetSessionId }),
          });

          if (response.ok) {
            setMeetTranscriptionActive(false);
            setMeetSessionId(null);
          } else {
            setError("Failed to stop Meet transcription");
          }
        }
      } catch (err) {
        setError("Failed to stop Meet transcription");
      }
    }
  };

  const toggleMic = async () => {
    const w: any = window as any;
    const SR: any = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("This browser does not support live speech recognition. Please use Chrome or Edge.");
      return;
    }
    if (!listening) {
      try {
        const res = await fetch(`${BACKEND_BASE}/stt/session/start`, {
          method: "POST",
          headers: { "User-Agent": "AarogyaAI-Frontend/1.0.0" }
        });
        if (!res.ok) throw new Error("failed to start stt session");
        const data = await res.json();
        setSessionId(data.session_id);
        if (onStart) onStart();
      } catch {
        setError("Failed to start backend STT session");
      }

      const rec: SpeechRecognition = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        let finalChunk = "";
        let partialChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalChunk += transcript + " ";
          else partialChunk += transcript;
        }
        if (partialChunk && onPartial) onPartial(partialChunk);
        if (finalChunk) {
          const text = finalChunk.trim();
          if (onPartial) onPartial("");
          onFinal(text);
        }
      };
      rec.onerror = () => setError("Speech recognition error");
      rec.start();
      setRecognizer(rec);
      setListening(true);
    } else {
      recognizer?.stop();
      setListening(false);
      if (sessionId) {
        fetch(`${BACKEND_BASE}/stt/session/stop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "AarogyaAI-Frontend/1.0.0"
          },
          body: JSON.stringify({ session_id: sessionId }),
        }).catch(() => { });
        setSessionId(null);
      }
      if (onPartial) onPartial("");
      if (onStop) onStop();
    }
  };

  return (
    <div className="border border-white/10 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Start Conversation (STT)</h2>
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded border border-white/20 text-sm ${listening ? "bg-white/10" : ""}`}
            onClick={toggleMic}
            disabled={!speechSupported}
            title={!speechSupported ? "Use Chrome or Edge for live speech recognition" : undefined}
          >
            {listening ? "Stop" : "Start Audio"}
          </button>
          <button
            className="px-3 py-1 rounded border border-white/20 text-sm hover:bg-white/5"
            onClick={() => setShowVideoSection(!showVideoSection)}
          >
            Start Video
          </button>
        </div>
      </div>
      {!speechSupported && (
        <div className="text-sm opacity-80">Live transcription requires a browser with the Speech API (try Chrome or Edge).</div>
      )}
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="text-xs opacity-70">Speaks will be transcribed and shown below in real-time.</div>

      {showVideoSection && (
        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Video Meeting</h3>
            <button
              className={`px-3 py-1 rounded border border-white/20 text-sm ${meetTranscriptionActive ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                }`}
              onClick={toggleMeetTranscription}
            >
              {meetTranscriptionActive ? "Stop Transcription" : "Start Transcription"}
            </button>
          </div>

          {/* Google Meet Join Section */}
          <div className="bg-white/5 p-4 rounded border border-white/10 mb-3">
            <div className="text-sm mb-3">Video Consultation:</div>

            {/* Join Button */}
            <div className="flex items-center justify-center mb-3">
              <a
                href="https://meet.google.com/xqr-xwhj-uwr"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
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
              <div className="text-sm font-mono break-all text-blue-400">
                https://meet.google.com/xqr-xwhj-uwr
              </div>
              <div className="text-xs opacity-70 mt-2">
                Click "Join Video Call" to open Google Meet in a new tab
              </div>
            </div>
          </div>

          {/* Transcription Status */}
          {meetTranscriptionActive && (
            <div className="bg-green-500/10 border border-green-500/30 p-3 rounded">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-400">Meet transcription is active</span>
              </div>
              <div className="text-xs opacity-70 mt-1">
                Session ID: {meetSessionId}
              </div>

              {/* Show Meet transcriptions or waiting message */}
              <div className="mt-3 pt-3 border-t border-green-500/20">
                {meetTranscriptions.length > 0 ? (
                  <>
                    <div className="text-xs opacity-70 mb-2">Recent transcriptions:</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {meetTranscriptions.slice(-5).map((transcription, index) => (
                        <div key={index} className="text-xs bg-white/10 p-2 rounded">
                          <div className="opacity-70">
                            {new Date(transcription.timestamp * 1000).toLocaleTimeString()}
                          </div>
                          <div className="mt-1">{transcription.text}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs opacity-70 text-center py-3">
                    {audioCapturing ? (
                      <>
                        <div className="mb-1">🎤 Capturing audio...</div>
                        <div className="text-xs opacity-60">
                          Speak into your microphone. Transcriptions will appear shortly.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-1">⏳ Waiting for audio...</div>
                        <div className="text-xs opacity-60">
                          Microphone access required for transcription
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


