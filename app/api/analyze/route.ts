import { NextRequest, NextResponse } from "next/server";

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

    const appAccessKey = process.env.APP_ACCESS_KEY;
    const isLocalDev = process.env.NODE_ENV === "development" ||
      req.headers.get("origin")?.includes("localhost");

    if (!isLocalDev) {
      if (appAccessKey !== undefined && appAccessKey !== "") {
        if (!accessKey || accessKey !== appAccessKey) {
          return NextResponse.json(
            { error: "Invalid access key" },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "App is disabled" },
          { status: 403 }
        );
      }
    }

    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
    const model = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";
    const timeoutMs = parseInt(process.env.API_TIMEOUT_MS || "300000", 10);

    if (!baseUrl || !authToken) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const prompt = `You are an expert podcast and audio editor. Your job is to aggressively trim audio transcripts while keeping the core essence and flow intact.

## Your Task
Analyze the transcript below. Identify sections to CUT. Return a JSON array of cuts.

## Output Format
Return ONLY a valid JSON array, no markdown, no explanation, no thinking. Cuts MUST be in chronological order (sorted by start time). Each cut object:
{
  "timestamp": "0:00 - 0:40",
  "original": "exact text being cut",
  "suggestedCut": "brief description of the cut",
  "reason": "specific reason why this should be cut"
}

## What to Cut — Cut aggressively

**1. Padding & Filler**
- Long intros (setting scenes, describing nervousness, etc.)
- Verbal filler: "you know", "like", "basically", "honestly", "I mean", "right?", "yeah", repeated back-and-forth affirmatives ("Oh, OK", "Exactly", "Totally", "Yeah")
- Speculative/hedging buildup before getting to the point ("I feel like...", "So I kind of want to...", "I don't know if this is the right way to...")

**2. Verbose Explanations**
- Analogies or examples that are repeated or stretched beyond their value
- Walkthroughs that re-explain something already explained in the previous 2 minutes
- Meta-commentary about what you're about to explain vs. the actual explanation

**3. Conversational Overhead**
- Roleplay exchanges that only confirm understanding ("Oh, I see", "That makes sense", "Right?", "Exactly")
- Interviewer asking obvious questions just to lead into content (cut the setup, keep the content)
- Celebrations of having solved something ("Phew, nailed it", "That was great", "You really did")

**4. Tangential or Bonus Content**
- Philosophical musings, "thought for you to mull over" wrap-ups
- Content that goes beyond the core technical/material (e.g., applying concepts to "your morning routine" or "genetics")
- Extended closings that repeat the summary

**5. Edge Case Dumps**
- Long lists of "what if" constraints fired rapidly without adding new insight
- Rapid-fire Q&A that just confirms edge case handling (if the solution was already explained)

## What NOT to Cut
- Technical explanations, even complex ones
- Analogies that are vivid and irreplaceable
- The core solution walkthrough
- Insightful trade-off discussions
- Any section where the "why we do it this way" is genuinely explained

## Process
1. Parse timestamps. Note the total audio duration.
2. Divide the transcript into narrative sections (intro, core explanation, variations, wrap-up).
3. For each section, estimate how much time it takes and judge if that matches its value.
4. Calculate total time saved by applying ALL suggested cuts.
5. Return cuts that collectively save 25-40% of the total length, focusing on the highest-value cuts.

## Example Cut Thinking
- 0:00-0:40 (40s intro): "Picture this, sterile room, sweating palms..." → descriptive scene-setting that takes 40s before problem is named. CUT.
- 5:40-6:37 (57s): Full Big-O breakdown of why sort is O(n log n) → reader/listener doesn't need the CS-101 derivation after the bottleneck is stated. CUT.
- 18:58-19:55 (57s): Philosophical ending applying anagrams to genetics/morning routines → beautiful but adds 57s of non-technical content. CUT.

TRANSCRIPT:
${transcript}`;

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 16000,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API error: ${response.status}`, details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || "";

    // Strip markdown code block markers
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");

    // Strip <think>... tags
    const thinkMatch = text.match(/<\/think>\s*([\s\S]*?)\s*$/);
    if (thinkMatch) {
      text = thinkMatch[1].trim();
    } else if (text.includes("<think>")) {
      text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }

    // Attempt JSON parse, handle incomplete responses
    let cuts;
    try {
      cuts = JSON.parse(text);
      if (!Array.isArray(cuts)) {
        throw new Error("Not an array");
      }
    } catch {
      // Try to extract first complete JSON array from the text
      const jsonMatch = text.match(/\[[\s\S]*?\]\s*/);
      if (jsonMatch) {
        try {
          cuts = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            { error: "Failed to parse AI response", raw: text.substring(0, 1000) },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Failed to parse AI response", raw: text.substring(0, 1000) },
          { status: 500 }
        );
      }
    }

    const normalizedCuts = cuts.map((c: any) => parseCut(c));
    return NextResponse.json({ cuts: normalizedCuts });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}

function parseTimestamp(ts: string): { startTime: number; endTime: number } {
  const match = ts.match(/(\d+):(\d+)(?::(\d+))?\s*[-–]\s*(\d+):(\d+)(?::(\d+))?/);
  if (!match) return { startTime: 0, endTime: 0 };

  const startSecs = match[3]
    ? parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
    : parseInt(match[1]) * 60 + parseInt(match[2]);

  const endSecs = match[6]
    ? parseInt(match[4]) * 3600 + parseInt(match[5]) * 60 + parseInt(match[6])
    : parseInt(match[4]) * 60 + parseInt(match[5]);

  return { startTime: startSecs, endTime: endSecs };
}

function parseCut(cut: any) {
  const { startTime, endTime } = parseTimestamp(cut.timestamp || "0:00 - 0:00");
  return {
    timestamp: cut.timestamp,
    startTime,
    endTime,
    original: cut.original,
    suggestedCut: cut.suggestedCut,
    reason: cut.reason,
  };
}