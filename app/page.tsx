"use client";

import { useState, useEffect } from "react";

interface Cut {
  timestamp: string;
  original: string;
  suggestedCut: string;
  reason: string;
}

interface AnalyzeResponse {
  cuts: Cut[];
  error?: string;
  raw?: string;
}

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [results, setResults] = useState<Cut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("audio-trimmer-key");
    if (saved) {
      setStoredKey(saved);
      setAccessKey(saved);
    }
  }, []);

  const handleAnalyze = async () => {
    setError("");
    setResults([]);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          accessKey: keyToUse,
        }),
      });

      const data: AnalyzeResponse = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      if (data.cuts && Array.isArray(data.cuts)) {
        setResults(data.cuts);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
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
              <button onClick={handleClearKey} style={styles.keyButton}>
                Clear
              </button>
            </div>
          ) : showKeyInput ? (
            <div style={styles.keyInput}>
              <input
                type="password"
                placeholder="Access key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                style={styles.input}
              />
              <button onClick={handleSaveKey} style={styles.keyButton}>
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowKeyInput(true)}
              style={styles.keyButton}
            >
              Set Key
            </button>
          )}
        </div>
      </header>

      <section style={styles.inputSection}>
        <textarea
          placeholder="Paste transcript here... &#10;&#10;Tip: Include timestamps if available, e.g: &#10;0:00 - Introduction&#10;0:15 - Main topic begins&#10;..."
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

      {results.length > 0 && (
        <section style={styles.resultsSection}>
          <h2 style={styles.resultsTitle}>
            Suggested Cuts ({results.length})
          </h2>
          <div style={styles.resultsList}>
            {results.map((cut, i) => (
              <div key={i} style={styles.cutCard}>
                <div style={styles.cutHeader}>
                  <span style={styles.timestamp}>
                    {cut.timestamp || "N/A"}
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
  inputSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  textarea: {
    flex: 1,
    minHeight: "300px",
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
    border: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  cutHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  timestamp: {
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "4px",
    background: "#333",
    color: "#a5b4fc",
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
};
