# Audio Transcript Trimmer v2 — Design Spec

## Overview

Enhanced app takes audio file + transcript, uses AI to suggest cuts, applies selected cuts in-browser via FFmpeg.wasm, outputs MP3 with removed sections.

## Stack

- **Framework:** Next.js (App Router)
- **AI:** Anthropic Claude via `/v1/chat/completions`
- **Audio Processing:** FFmpeg.wasm (`@ffmpeg/ffmpeg`) — browser-based, audio never leaves device
- **Styling:** Inline CSS (existing pattern)

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Client   │──────▶│  /api/analyze │──────▶│   Claude    │
│  (browser) │◀──────│   (route.ts)  │◀──────│     AI      │
└─────────────┘       └──────────────┘       └─────────────┘
       │
       │ FFmpeg.wasm (local)
       ▼
┌─────────────┐
│   Browser   │ Audio processing, cut application
└─────────────┘
```

## Data Flow

1. User drops/selects audio file (mp3/m4a/wav/ogg)
2. Optional: paste transcript with timestamps
3. Click "Analyze" → sends transcript to AI → returns cut suggestions
4. Cuts displayed with checkboxes (all checked by default)
5. User deselects unwanted cuts
6. Click "Export Audio" → FFmpeg.wasm loads, applies cuts in sequence, outputs MP3
7. Browser downloads result.mp3

## UI Layout

```
┌─────────────────────────────────┐
│  Audio Transcript Trimmer       │
├─────────────────────────────────┤
│  [Drag & drop zone]            │
│  or [Choose File] button        │
│  (mp3, m4a, wav, ogg)          │
│  [Audio filename display]       │
├─────────────────────────────────┤
│  [Access Key input or stored]   │
├─────────────────────────────────┤
│  Transcript textarea             │
│  (optional but recommended)      │
├─────────────────────────────────┤
│  [ Analyze ]                    │
├─────────────────────────────────┤
│  Results panel                  │
│  ☑ Cut 1 (timestamp) [selected] │
│  ☑ Cut 2 (timestamp) [selected] │
│  ☐ Cut 3 (timestamp) [deselected]│
├─────────────────────────────────┤
│  [ Export Audio (MP3) ]         │
└─────────────────────────────────┘
```

## Cut Selection Logic

Each cut has:
- `startTime` — seconds where cut begins
- `endTime` — seconds where cut ends  
- `selected` — boolean, default true

FFmpeg concatDemuxer approach:
1. Load audio into FFmpeg virtual filesystem
2. For each selected cut, seek + extract "keep" segments
3. Concatenate kept segments into single output
4. Encode as MP3

**Timestamp sync:** Transcript timestamps map directly to audio timestamps. Cuts applied in ascending order. Each cut removed reduces subsequent timestamps by cut duration.

## API — `POST /api/analyze`

Unchanged from v1. Request accepts transcript, returns cuts with timestamps.

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # Required. Claude API key.
ANTHROPIC_BASE_URL=...          # Required. AI endpoint.
ANTHROPIC_MODEL=...             # Model name.
APP_ACCESS_KEY=...              # Optional. When set, requires valid bearer token.
```

## Files

```
app/
  page.tsx              # Main UI (enhanced with audio handling)
  api/analyze/route.ts  # Unchanged
lib/
  audioProcessor.ts     # FFmpeg.wasm wrapper — load, cut, export
```

## Dependencies

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

## Key Implementation Notes

- FFmpeg.wasm requires shared array buffer (Vercel headers config)
- Audio file loaded as Uint8Array into FFmpeg virtual FS
- Cuts sorted by startTime before processing
- Output always MP3 (format selected per user requirement)
- Transcript sync: when cuts applied, display message "Transcript may need manual adjustment"
