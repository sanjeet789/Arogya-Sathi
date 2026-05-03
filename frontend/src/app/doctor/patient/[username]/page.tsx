"use client";

import React, { useEffect, useMemo, useState } from "react";
import DoctorScribe from "./DoctorScribe";
import SpeechToText from "./SpeechToText";
import Transcripts from "./Transcripts";
import AINotes from "./AINotes";
import Prescription from "./Prescription";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Profile = {
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  phone?: string | null;
  allergies?: string | null;
  ailments?: string | null;
  scribeNotes?: string | null;
};

export default function DoctorPatientProfile() {
  const params = useParams();
  const usernameRaw = Array.isArray((params as any).username) ? (params as any).username[0] : (params as any).username as string;
  const username = (() => {
    try {
      // Normalize in case param is still percent-encoded
      return decodeURIComponent(usernameRaw);
    } catch {
      return usernameRaw;
    }
  })();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  // Editable (except name): keep local state mirrors
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string>("");
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [phone, setPhone] = useState<string>("");
  const [allergies, setAllergies] = useState<string>("");
  const [ailments, setAilments] = useState<string>("");
  const [editMode, setEditMode] = useState(false);

  const [transcripts, setTranscripts] = useState<{ text: string; createdAt?: string }[]>([]);
  const [partial, setPartial] = useState<string>("");
  const [aiPrescriptionData, setAiPrescriptionData] = useState<any>(null);

  const [sessionBuffer, setSessionBuffer] = useState<string>("");

  // Load existing transcripts for this appointment
  useEffect(() => {
    async function loadTranscripts() {
      if (!appointmentId) return;
      
      try {
        const res = await fetch(`/api/patient/transcriptions?appointmentId=${encodeURIComponent(appointmentId)}`);
        if (res.ok) {
          const transcriptData = await res.json();
          if (Array.isArray(transcriptData)) {
            const formattedTranscripts = transcriptData.map((t: any) => ({
              text: t.text,
              createdAt: t.createdAt
            }));
            setTranscripts(formattedTranscripts);
          }
        }
      } catch (error) {
        console.error("Failed to load transcripts:", error);
      }
    }
    
    loadTranscripts();
  }, [appointmentId]);

  const currentWeight = editMode ? weight : (typeof profile?.weight === "number" ? profile!.weight : null);
  const currentHeight = editMode ? height : (typeof profile?.height === "number" ? profile!.height : null);
  const bmi = useMemo(() => {
    if (currentWeight == null || currentHeight == null || currentHeight === 0) return null;
    const hM = currentHeight / 100;
    const val = currentWeight / (hM * hM);
    return Math.round(val * 10) / 10;
  }, [currentWeight, currentHeight]);
  const bmiLabel = useMemo(() => {
    if (bmi == null) return "-";
    if (bmi < 18.5) return `${bmi} (Underweight)`;
    if (bmi < 24.9) return `${bmi} (Normal)`;
    if (bmi < 29.9) return `${bmi} (Overweight)`;
    return `${bmi} (Obese)`;
  }, [bmi]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "doctor")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    async function load() {
      if (!username) return;
      try {
        const res = await fetch(`/api/patient/profile?username=${encodeURIComponent(username)}`);
        let data: any = null;
        if (res.ok) {
          data = await res.json();
        }
        if (!data) {
          // Ensure an empty profile exists, then use empty defaults
          await fetch("/api/patient/profile", {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "User-Agent": "AarogyaAI-Frontend/1.0.0",
            },
            body: JSON.stringify({ username }),
          });
          setProfile({});
          setNotes("");
        } else {
          setProfile(data);
          setNotes(data?.scribeNotes || "");
          setAge(typeof data?.age === "number" ? data.age : null);
          setGender(data?.gender || "");
          setWeight(typeof data?.weight === "number" ? data.weight : null);
          setHeight(typeof data?.height === "number" ? data.height : null);
          setPhone(data?.phone || "");
          setAllergies(data?.allergies || "");
          setAilments(data?.ailments || "");
          setEditMode(false);
        }
      } catch {
        setProfile({});
      }
    }
    load();
  }, [username]);

  useEffect(() => {
    async function loadTranscripts() {
      if (!appointmentId) return;
      try {
        const res = await fetch(`/api/patient/transcriptions?appointmentId=${encodeURIComponent(appointmentId)}`);
        if (res.ok) {
          const data = await res.json();
          setTranscripts(data || []);
        }
      } catch {}
    }
    loadTranscripts();
  }, [appointmentId]);

  const saveNotes = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patient/profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({ username, scribeNotes: notes }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setError("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        username,
        age: age ?? null,
        gender: gender || null,
        weight: weight ?? null,
        height: height ?? null,
        phone: phone || null,
        allergies: allergies || null,
        ailments: ailments || null,
      };
      const res = await fetch("/api/patient/profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setError("Failed to save details");
    } finally {
      setSaving(false);
    }
  };

  const completeAppointment = async () => {
    if (!appointmentId) return;
    setCompleting(true);
    setError(null);
    try {
      // Save current scribe notes into this appointment and mark completed
      const res = await fetch("/api/appointments", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({ id: appointmentId, status: "COMPLETED", notes }),
      });
      if (!res.ok) throw new Error("complete failed");
      
      // Redirect to homepage after successful completion
      router.push("/");
    } catch {
      setError("Failed to complete appointment");
    } finally {
      setCompleting(false);
    }
  };

  async function persistSessionTranscript(text: string) {
    if (!appointmentId || !text.trim()) return;
    try {
      await fetch("/api/patient/transcriptions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({ appointmentId, text }),
      });
    } catch {}
  }

  if (!profile) return <div className="p-4 text-sm opacity-80">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patient: {profile.name || username}</h1>
        <button className="text-sm underline" onClick={() => router.back()}>Back</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-white/10 rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Details</h2>
            {!editMode ? (
              <button className="text-sm underline" onClick={() => setEditMode(true)}>Edit</button>
            ) : (
              <div className="flex items-center gap-2">
                <button className="text-sm underline" onClick={() => {
                  // reset to current profile values
                  setAge(typeof profile?.age === "number" ? profile!.age : null);
                  setGender(profile?.gender || "");
                  setWeight(typeof profile?.weight === "number" ? profile!.weight : null);
                  setHeight(typeof profile?.height === "number" ? profile!.height : null);
                  setPhone(profile?.phone || "");
                  setAllergies(profile?.allergies || "");
                  setAilments(profile?.ailments || "");
                  setEditMode(false);
                }}>Cancel</button>
                <button className="px-3 py-1 rounded bg-foreground text-background disabled:opacity-60" disabled={saving} onClick={async () => { await saveProfile(); setEditMode(false); }}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>
          <div className="text-xs opacity-70">Name is not editable by doctors.</div>

          {!editMode ? (
            <div className="space-y-2 text-sm opacity-90">
              <div>Age: {profile?.age ?? "-"}</div>
              <div>Gender: {profile?.gender ?? "-"}</div>
              <div>Phone: {profile?.phone ?? "-"}</div>
              <div>Weight/Height: {profile?.weight ?? "-"} / {profile?.height ?? "-"}</div>
              <div>BMI: {bmiLabel}</div>
              <div>Allergies: {profile?.allergies ?? "-"}</div>
              <div>Major Ailments: {profile?.ailments ?? "-"}</div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm mb-1">Age</label>
                <input type="number" className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={age ?? ""} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Gender</label>
                <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={gender} onChange={(e) => setGender(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Weight (kg)</label>
                  <input type="number" className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={weight ?? ""} onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Height (cm)</label>
                  <input type="number" className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={height ?? ""} onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
              <div className="text-sm opacity-90">BMI: {bmiLabel}</div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Allergies</label>
                <textarea className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Major Ailments</label>
                <textarea className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={ailments} onChange={(e) => setAilments(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DoctorScribe notes={notes} setNotes={setNotes} onSave={saveNotes} saving={saving} error={error} />
      </div>

      <div className="flex items-center justify-end">
        <button
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
          disabled={!appointmentId || completing}
          title={!appointmentId ? "Open with an appointment to enable completion" : undefined}
          onClick={completeAppointment}
        >
          {completing ? "Completing..." : "Complete Appointment"}
        </button>
      </div>

      <SpeechToText
        onStart={() => { setSessionBuffer(""); setPartial(""); }}
        onFinal={(text) => setSessionBuffer((prev) => (prev ? prev + " " : "") + text)}
        onPartial={(txt) => setPartial(txt)}
        onStop={async () => {
          const combined = sessionBuffer.trim();
          if (combined) {
            await persistSessionTranscript(combined);
            setTranscripts((prev) => [...prev, { text: combined }]);
          }
          setSessionBuffer("");
          setPartial("");
        }}
        onMeetTranscription={async (text) => {
          // Handle Meet transcriptions - add them directly to transcripts
          console.log("[Doctor Page] ===== Received Meet transcription =====");
          console.log("[Doctor Page] Text:", text);
          console.log("[Doctor Page] Current transcripts count:", transcripts.length);
          
          await persistSessionTranscript(text);
          
          setTranscripts((prev) => {
            const updated = [...prev, { text }];
            console.log("[Doctor Page] Updated transcripts count:", updated.length);
            return updated;
          });
        }}
      />
      <Transcripts items={transcripts} partial={partial} onManualAdd={async (text) => {
          await persistSessionTranscript(text);
          setTranscripts((prev) => [...prev, { text }]);
        }} />
      <AINotes 
        transcripts={transcripts} 
        appointmentId={appointmentId} 
        onPrescriptionDataGenerated={setAiPrescriptionData}
      />
      <Prescription 
        patient={profile} 
        patientUsername={username} 
        doctorName={user?.username} 
        appointmentId={appointmentId}
        aiPrescriptionData={aiPrescriptionData}
      />
    </div>
  );
}


