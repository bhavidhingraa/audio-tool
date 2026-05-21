# Audio Transcript Trimmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-page app that takes transcript text, calls Claude AI to suggest cuts with timestamps/reasoning, displays results.

**Architecture:** Next.js App Router with `/api/analyze` server route. AI SDK calls Claude server-side. Client stores access key in localStorage.

**Tech Stack:** Next.js, @ai-sdk/anthropic, inline CSS

---

## File Structure

```
audio-tool/
├── app/
│   ├── page.tsx              # Main UI
│   └── api/
│       └── analyze/
│           └── route.ts      # Server: auth + Claude call
├── .env.local.example        # Template
├── package.json
└── tsconfig.json
```

---

## Tasks

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "audio-transcript-trimmer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "ai": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio Transcript Trimmer",
  description: "AI-powered transcript cutter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create app/globals.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a0a;
  color: #e5e5e5;
  min-height: 100vh;
}

textarea {
  font-family: inherit;
}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

---

### Task 2: Create API Route

**Files:**
- Create: `app/api/analyze/route.ts`

- [ ] **Step 1: Create app/api/analyze/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";

interface AnalyzeRequest {
  transcript: string;
  accessKey: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { transcript, accessKey } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Check if APP_ACCESS_KEY is configured
    const appAccessKey = process.env.APP_ACCESS_KEY;
    if (appAccessKey !== undefined && appAccessKey !== "") {
      if (!accessKey || accessKey !== appAccessKey) {
        return NextResponse.json(
          { error: "Invalid access key" },
          { status: 401 }
        );
      }
    } else {
      // App disabled - no key configured
      return NextResponse.json(
        { error: "App is disabled" },
        { status: 403 }
      );
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const model = anthropic("claude-sonnet-4-20250514");
    const prompt = `You are an expert audio editor. Analyze the following transcript and identify sections to cut.

For each cut provide:
- timestamp: timestamp range from the transcript (e.g., "0:15 - 0:22") or "N/A" if no timestamp
- original: the exact text to cut
- suggestedCut: brief description of what to cut or remove
- reason: why this should be cut (be specific)

Rules for cuts:
- Redundant explanations already covered elsewhere
- Filler words ("um", "uh", "you know", "like", "I mean")
- Tangents that don't add value to the main topic
- Repeated points made multiple times
- False starts and self-corrections
- Wordy phrases that could be more concise

Return ONLY a JSON array of cuts. No preamble, no explanation. Example format:
[
  {
    "timestamp": "1:23 - 1:30",
    "original": "I think maybe possibly we should...",
    "suggestedCut": "Remove speculative filler",
    "reason": "Repeated hedge words 'I think' and 'maybe' and 'possibly' add no value"
  }
]

TRANSCRIPT:
${transcript}`;

    const response = await model.generate({
      prompt,
      maxTokens: 2048,
    });

    let cuts;
    try {
      cuts = JSON.parse(response.text);
      if (!Array.isArray(cuts)) {
        throw new Error("Not an array");
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: response.text },
        { status: 500 }
      );
    }

    return NextResponse.json({ cuts });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

Run: `git add -A && git commit -m "feat: add analyze API route with auth and Claude integration"`

---

### Task 3: Create Main Page UI

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Create app/page.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

Run: `git add -A && git commit -m "feat: add main page UI with transcript analyzer"`

---

### Task 4: Create Env Template

**Files:**
- Create: `.env.local.example`

- [ ] **Step 1: Create .env.local.example**

```
# Required: Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Required: Access key for app access
# When empty or removed, app is disabled
APP_ACCESS_KEY=your-secret-access-key
```

- [ ] **Step 2: Commit**

Run: `git add -A && git commit -m "docs: add env template"`

---

## Spec Coverage Check

- [x] Single-page app with textarea — Task 3
- [x] Server-side API route — Task 2
- [x] APP_ACCESS_KEY auth — Task 2
- [x] Claude AI integration — Task 2
- [x] Results with timestamps/reasoning — Task 3
- [x] localStorage for key — Task 3
- [x] Dark mode UI — Task 3
- [x] Env template — Task 4

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-21-audio-transcript-trimmer-plan.md`. Two options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session using executing-plans

Which approach?
