"use client";

import { useState, useEffect, useRef } from "react";
import { loadFFmpeg, processAudio, type Cut } from "../lib/audioProcessor";

interface AnalyzeResponse {
  cuts: Cut[];
  error?: string;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<Cut[]>([]);
  const [selectedCuts, setSelectedCuts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("audio-trimmer-key");
    if (saved) {
      setStoredKey(saved);
      setAccessKey(saved);
    }

    loadFFmpeg().then(() => setFfmpegLoaded(true)).catch(console.error);
  }, []);

  const handleFileChange = (file: File) => {
    if (!file) return;
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("audio/") || file.name.match(/\.(mp3|m4a|wav|ogg)$/i))) {
      handleFileChange(file);
    }
  };

  const handleAnalyze = async () => {
    setError("");
    setResults([]);
    setSelectedCuts(new Set());

    const keyToUse = accessKey || storedKey || "";

    if (!keyToUse) {
      setError("Access key required");
      return;
    }

    if (!transcript.trim()) {
      setError("Transcript required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, accessKey: keyToUse }),
      });

      const data: AnalyzeResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      if (data.cuts && Array.isArray(data.cuts)) {
        setResults(data.cuts);
        setSelectedCuts(new Set(data.cuts.map((_, i) => i)));
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!audioFile) {
      setError("Audio file required");
      return;
    }

    const cutsToApply = Array.from(selectedCuts).map(i => results[i]);
    if (cutsToApply.length === 0) {
      setError("No cuts selected");
      return;
    }

    setExporting(true);
    setExportProgress(0);
    setError("");

    try {
      const audioData = new Uint8Array(await audioFile.arrayBuffer());

      const blob = await processAudio(audioData, cutsToApply, (progress) => {
        setExportProgress(progress);
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trimmed_${audioFile.name.replace(/\.[^.]+$/, ".mp3")}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  const toggleCut = (index: number) => {
    const newSelected = new Set(selectedCuts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedCuts(newSelected);
  };

  const handleSaveKey = () => {
    if (accessKey) {
      localStorage.setItem("audio-trimmer-key", accessKey);
      setStoredKey(accessKey);
      setShowKeyInput(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem("audio-trimmer-key");
    setStoredKey(null);
    setAccessKey("");
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>Audio Transcript Trimmer</h1>
        <div style={styles.keySection}>
          {storedKey ? (
            <div style={styles.keySaved}>
              <span style={styles.keyLabel}>Key saved</span>
              <button onClick={handleClearKey} style={styles.keyButton}>Clear</button>
            </div>
          ) : showKeyInput ? (
            <div style={styles.keyInput}>
              <input type="password" placeholder="Access key" value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)} style={styles.input} />
              <button onClick={handleSaveKey} style={styles.keyButton}>Save</button>
            </div>
          ) : (
            <button onClick={() => setShowKeyInput(true)} style={styles.keyButton}>Set Key</button>
          )}
        </div>
      </header>

      <section
        ref={dropZoneRef}
        style={styles.dropZone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.ogg,audio/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />
        {audioFile ? (
          <div style={styles.audioInfo}>
            <span style={styles.audioName}>{audioFile.name}</span>
            <span style={styles.audioSize}>
              ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        ) : (
          <div style={styles.dropText}>
            <span>Drag & drop audio file here</span>
            <span style={styles.dropOr}>or</span>
            <span style={styles.chooseFile}>Choose File</span>
          </div>
        )}
        <div style={styles.supportedFormats}>Supported: mp3, m4a, wav, ogg</div>
      </section>

      {audioUrl && (
        <audio controls src={audioUrl} style={styles.audioPlayer} />
      )}

      <section style={styles.inputSection}>
        <textarea
          placeholder="Paste transcript here... (Tip: Include timestamps if available)"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          style={styles.textarea}
        />
      </section>

      <section style={styles.actionSection}>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            ...styles.analyzeButton,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </section>

      {error && <div style={styles.error}>{error}</div>}

      {results.length > 0 && (() => {
            const totalCutTime = results.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);
            const selectedCutTime = results.reduce((sum, c, i) =>
              selectedCuts.has(i) ? sum + (c.endTime - c.startTime) : sum, 0);
            const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            const parseTime = (t: string) => {
              const match = t.match(/(\d+):(\d+)/);
              return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
            };

            return (
        <section style={styles.resultsSection}>
          <h2 style={styles.resultsTitle}>
            Suggested Cuts ({results.length}) — {formatTime(selectedCutTime)} to cut {selectedCutTime !== totalCutTime && `(of ${formatTime(totalCutTime)} total)`}
          </h2>
          <div style={styles.resultsList}>
            {results.map((cut, i) => (
              <div
                key={i}
                style={{
                  ...styles.cutCard,
                  borderColor: selectedCuts.has(i) ? "#3b82f6" : "#333",
                }}
              >
                <div style={styles.cutHeader}>
                  <input
                    type="checkbox"
                    checked={selectedCuts.has(i)}
                    onChange={() => toggleCut(i)}
                    style={styles.checkbox}
                  />
                  <input
                    type="text"
                    defaultValue={cut.timestamp || "0:00 - 0:00"}
                    onChange={(e) => {
                      const newResults = [...results];
                      const times = e.target.value.split(" - ");
                      if (times.length === 2) {
                        newResults[i] = {
                          ...newResults[i],
                          timestamp: e.target.value,
                          startTime: parseTime(times[0]),
                          endTime: parseTime(times[1]),
                        };
                        setResults(newResults);
                      }
                    }}
                    style={styles.timestampInput}
                  />
                  <span style={selectedCuts.has(i) ? styles.selected : styles.deselected}>
                    {selectedCuts.has(i) ? "Selected" : "Deselected"}
                  </span>
                </div>
                <div style={styles.cutOriginal}>
                  <strong>Original:</strong> {cut.original}
                </div>
                <div style={styles.cutSuggestion}>
                  <strong>Cut:</strong> {cut.suggestedCut}
                </div>
                <div style={styles.cutReason}>
                  <strong>Why:</strong> {cut.reason}
                </div>
              </div>
            ))}
          </div>
        </section>
            );
          })()}

      {results.length > 0 && (
        <section style={styles.actionSection}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              ...styles.exportButton,
              opacity: exporting ? 0.6 : 1,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            {exporting
              ? `Exporting... ${Math.round(exportProgress)}%`
              : `Export Audio (MP3) — ${selectedCuts.size} cuts`}
          </button>
        </section>
      )}

      {!ffmpegLoaded && (
        <div style={styles.loadingFFmpeg}>Loading audio processor...</div>
      )}
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "24px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#fff",
  },
  keySection: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  keySaved: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  keyLabel: {
    fontSize: "14px",
    color: "#4ade80",
  },
  keyInput: {
    display: "flex",
    gap: "8px",
  },
  input: {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#e5e5e5",
    width: "180px",
  },
  keyButton: {
    padding: "8px 16px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "none",
    background: "#333",
    color: "#e5e5e5",
    cursor: "pointer",
  },
  dropZone: {
    padding: "32px",
    border: "2px dashed #333",
    borderRadius: "12px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  dropText: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#888",
    fontSize: "16px",
  },
  dropOr: {
    color: "#555",
    fontSize: "14px",
  },
  chooseFile: {
    color: "#3b82f6",
    fontSize: "14px",
  },
  supportedFormats: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#555",
  },
  audioInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  audioName: {
    color: "#4ade80",
    fontSize: "16px",
    fontWeight: "500",
  },
  audioSize: {
    color: "#888",
    fontSize: "14px",
  },
  audioPlayer: {
    width: "100%",
    height: "40px",
  },
  inputSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  textarea: {
    flex: 1,
    minHeight: "200px",
    padding: "16px",
    fontSize: "14px",
    lineHeight: "1.6",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#e5e5e5",
    resize: "vertical",
  },
  actionSection: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
  },
  analyzeButton: {
    padding: "12px 48px",
    fontSize: "16px",
    fontWeight: "600",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    transition: "opacity 0.2s",
  },
  exportButton: {
    padding: "12px 48px",
    fontSize: "16px",
    fontWeight: "600",
    borderRadius: "8px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    transition: "opacity 0.2s",
  },
  error: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#7f1d1d",
    color: "#fca5a5",
    fontSize: "14px",
  },
  resultsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  resultsTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#fff",
  },
  resultsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cutCard: {
    padding: "16px",
    borderRadius: "8px",
    background: "#1a1a1a",
    border: "2px solid #333",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    transition: "border-color 0.2s",
  },
  cutHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  timestamp: {
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "4px",
    background: "#333",
    color: "#a5b4fc",
  },
  timestampInput: {
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "4px",
    background: "#222",
    color: "#a5b4fc",
    border: "1px solid #444",
    width: "120px",
    fontFamily: "monospace",
  },
  selected: {
    fontSize: "12px",
    color: "#4ade80",
    marginLeft: "auto",
  },
  deselected: {
    fontSize: "12px",
    color: "#888",
    marginLeft: "auto",
  },
  cutOriginal: {
    fontSize: "14px",
    color: "#d4d4d4",
    lineHeight: "1.5",
  },
  cutSuggestion: {
    fontSize: "14px",
    color: "#f87171",
    lineHeight: "1.5",
  },
  cutReason: {
    fontSize: "13px",
    color: "#a3a3a3",
    lineHeight: "1.5",
    fontStyle: "italic",
  },
  loadingFFmpeg: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#1a1a1a",
    color: "#888",
    fontSize: "14px",
    textAlign: "center",
  },
};
