"use client";

import React, { useEffect, useState } from "react";

type Profile = {
  name?: string | null;
  age?: number | null;
  phone?: string | null;
  department?: string | null;
  speciality?: string | null;
  signature?: string | null;
  signatureType?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  consultationFee?: number | null;
};

export default function DoctorSettings({ username }: { username: string }) {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"text" | "image">("text");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/doctor/profile?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then((data: Profile | null) => {
        setProfile(data || {});
        if (data?.signatureType) {
          setSignatureMode(data.signatureType as "text" | "image");
        }
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [username]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile(p => ({ ...p, [key]: value }));
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        update("signature", base64);
        update("signatureType", "image");
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "AarogyaAI-Frontend/1.0.0",
        },
        body: JSON.stringify({ 
          username, 
          ...profile,
          signatureType: signatureMode 
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm opacity-80">Loading...</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="border border-white/10 rounded p-4">
        <h2 className="font-medium mb-2">Doctor Settings</h2>
        <p className="text-sm opacity-80">Please complete your profile information.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={profile.name ?? ""} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Age</label>
          <input type="number" className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={profile.age ?? ""} onChange={(e) => update("age", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Phone No</label>
          <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={profile.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Department</label>
          <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={profile.department ?? ""} onChange={(e) => update("department", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Speciality</label>
          <input className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none" value={profile.speciality ?? ""} onChange={(e) => update("speciality", e.target.value)} />
        </div>
      </div>

      <div className="border border-white/10 rounded p-4">
        <h3 className="font-medium mb-4">Digital Signature</h3>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="signatureMode"
                value="text"
                checked={signatureMode === "text"}
                onChange={(e) => {
                  setSignatureMode("text");
                  update("signatureType", "text");
                }}
              />
              <span className="text-sm">Text Signature</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="signatureMode"
                value="image"
                checked={signatureMode === "image"}
                onChange={(e) => {
                  setSignatureMode("image");
                  update("signatureType", "image");
                }}
              />
              <span className="text-sm">Upload Image</span>
            </label>
          </div>

          {signatureMode === "text" ? (
            <div>
              <label className="block text-sm mb-1">Signature Text</label>
              <input
                className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none"
                value={profile.signature ?? ""}
                onChange={(e) => update("signature", e.target.value)}
                placeholder="Dr. John Doe, MBBS"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm mb-1">Signature Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureFileChange}
                className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-600 file:text-white file:text-sm"
              />
              {profile.signature && profile.signatureType === "image" && (
                <div className="mt-2">
                  <img
                    src={profile.signature}
                    alt="Current signature"
                    className="max-w-xs max-h-20 border border-white/20 rounded"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border border-white/10 rounded p-4">
        <h3 className="font-medium mb-4">Clinic Details</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm mb-1">Clinic Name</label>
            <input
              className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none"
              value={profile.clinicName ?? ""}
              onChange={(e) => update("clinicName", e.target.value)}
              placeholder="AarogyaAI Clinic"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Clinic Address</label>
            <input
              className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none"
              value={profile.clinicAddress ?? ""}
              onChange={(e) => update("clinicAddress", e.target.value)}
              placeholder="123 Health Street, City"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Clinic Phone</label>
            <input
              className="w-full px-3 py-2 rounded border border-white/20 bg-transparent outline-none"
              value={profile.clinicPhone ?? ""}
              onChange={(e) => update("clinicPhone", e.target.value)}
              placeholder="+91-00000-00000"
            />
          </div>
        </div>
      </div>

      <div className="border border-white/10 rounded p-4">
        <h3 className="font-medium mb-4">Consultation Charges</h3>
        
        <div className="max-w-xs">
          <label className="block text-sm mb-1">Appointment Fee (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">₹</span>
            <input
              type="number"
              min="0"
              step="50"
              className="w-full pl-7 pr-3 py-2 rounded border border-white/20 bg-transparent outline-none"
              value={profile.consultationFee ?? ""}
              onChange={(e) => update("consultationFee", e.target.value ? Number(e.target.value) : null)}
              placeholder="500"
            />
          </div>
          <p className="text-xs opacity-50 mt-1">This fee will be shown to patients when they book an appointment with you.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-foreground text-background disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        {saved && <span className="text-sm text-green-500">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}


