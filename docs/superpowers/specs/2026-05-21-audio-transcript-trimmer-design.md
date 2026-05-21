# Audio Transcript Trimmer — Design Spec

## Overview

Single-page app that takes an audio transcript, sends to Claude AI for review, and returns suggested cuts with timestamps and reasoning to reduce audio length while preserving essence.

## Stack

- **Framework:** Next.js (App Router)
- **AI:** Anthropic Claude via `@ai-sdk/anthropic`
- **Deployment:** Vercel
- **Styling:** Inline CSS (minimal, no framework)

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Client   │──────▶│  /api/analyze │──────▶│   Claude    │
│  (browser) │◀──────│   (route.ts)  │◀──────│     AI      │
└─────────────┘       └──────────────┘       └─────────────┘
```

## Security — Access Control

- `APP_ACCESS_KEY` env var (Vercel). When unset/empty, app returns 403 to all requests.
- Client sends `Authorization: Bearer <key>` header.
- `ANTHROPIC_API_KEY` never leaves server.

## Data Flow

1. User pastes transcript into textarea
2. User clicks "Analyze" (requires localStorage key or inline input)
3. Client sends POST `/api/analyze` with `{ transcript, accessKey }`
4. Server validates accessKey → 401/403 if invalid
5. Server calls Claude with prompt to identify cuts
6. Server returns structured suggestions
7. Client displays results

## API — `POST /api/analyze`

**Request:**
```json
{
  "transcript": "string",
  "accessKey": "string"
}
```

**Response (200):**
```json
{
  "cuts": [
    {
      "timestamp": "0:15 - 0:22",
      "original": "string",
      "suggestedCut": "string",
      "reason": "string"
    }
  ]
}
```

**Errors:**
- 400: missing transcript
- 401: invalid access key
- 403: APP_ACCESS_KEY not configured
- 500: Claude API error

## Claude Prompt

System: You are an expert audio editor. Analyze transcripts to suggest cuts.

User: Given this transcript, identify sections to cut. For each cut provide:
- Timestamp range (if available in transcript, otherwise mark as "N/A")
- Original text
- What to cut
- Reason for cutting

Rules for cuts:
- Redundant explanations already covered
- Filler words and verbal tics
- Tangents that don't add value
- Repeated points
- False starts / self-corrections

Return as JSON array with fields: timestamp, original, suggestedCut, reason.

## UI Layout

```
┌─────────────────────────────────┐
│  Audio Transcript Trimmer       │
├─────────────────────────────────┤
│  [Access Key input or stored]   │
├─────────────────────────────────┤
│                                 │
│  Transcript textarea             │
│  (80% height)                   │
│                                 │
├─────────────────────────────────┤
│  [ Analyze ]                    │
├─────────────────────────────────┤
│  Results panel                  │
│  - Cut 1                        │
│  - Cut 2                        │
└─────────────────────────────────┘
```

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # Required. Claude API key.
APP_ACCESS_KEY=my-secret        # Optional. When empty/removed, app disabled.
```

## Files

```
app/
  page.tsx           # Main UI
  api/
    analyze/
      route.ts       # Server-side AI call + auth
.env.local.example   # Template for env vars
```
