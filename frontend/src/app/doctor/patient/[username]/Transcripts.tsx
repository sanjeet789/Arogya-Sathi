"use client";

import React from "react";

export default function Transcripts({ items, partial, onManualAdd }: { items: { text: string; createdAt?: string }[]; partial?: string; onManualAdd?: (text: string) => void }) {
  const hasItems = items?.length > 0;
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const [manualText, setManualText] = React.useState("");

  const totalCount = items?.length || 0;
  const headerNote = !expanded
    ? `${totalCount} saved${partial ? ", + live" : ""}`
    : undefined;

  const handleManualAdd = () => {
    const trimmed = manualText.trim();
    if (!trimmed || !onManualAdd) return;
    onManualAdd(trimmed);
    setManualText("");
  };

  return (
    <div className="border border-white/10 rounded p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Transcripts</h2>
        <div className="flex items-center gap-3">
          {headerNote && (
            <span className="text-xs opacity-70">{headerNote}</span>
          )}
          <button
            className="text-sm underline"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="transcripts-content"
          >
            {expanded ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {/* Manual transcript input for testing */}
      {onManualAdd && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded border border-white/20 bg-transparent outline-none text-sm"
            placeholder="Type transcript text manually..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleManualAdd(); }}
          />
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            disabled={!manualText.trim()}
            onClick={handleManualAdd}
          >
            Add
          </button>
        </div>
      )}
      {!hasItems && !partial && (
        <div className="text-sm opacity-70">No transcripts yet.</div>
      )}
      {expanded && (
        <div id="transcripts-content" className="space-y-2 text-sm opacity-90">
          {items.map((t, idx) => (
            <div key={idx} className="p-2 rounded border border-white/10">
              <div>{t.text}</div>
              {t.createdAt && (
                <div className="text-xs opacity-60 mt-1">{new Date(t.createdAt).toLocaleString()}</div>
              )}
            </div>
          ))}
          {partial ? (
            <div className="p-2 rounded border border-dashed border-white/10 opacity-80">
              {partial}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
