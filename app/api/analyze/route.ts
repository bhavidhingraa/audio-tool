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

    const prompt = `You are an expert audio editor. Analyze the following transcript and identify ONLY significant sections to cut that would meaningfully reduce audio length while preserving the essence and flow.

For each cut provide:
- timestamp: timestamp range from the transcript (e.g., "0:15 - 0:22") or "N/A" if no timestamp
- original: the exact text to cut
- suggestedCut: brief description of what to cut or remove
- reason: why this should be cut (be specific)

ONLY suggest cuts that meet ALL of these criteria:
- Redundant explanations already covered elsewhere
- Extended filler sequences (multiple "um", "uh", "like" in a row)
- Tangents that don't add value to the main topic
- Repeated points stated identically or nearly identically
- False starts / self-corrections that are substantial
- Wordy phrases that could be meaningfully shortened

DO NOT suggest cuts for:
- Individual filler words or single occurrences
- Minor verbal habits
- Conversational transitions that maintain flow
- Technical explanations that add value

Be conservative - only flag truly significant cuts. Prefer fewer, more impactful suggestions over many small ones.

Return ONLY a valid JSON array with no additional text, thinking, or markup. Example format:
[
  {
    "timestamp": "1:23 - 1:30",
    "original": "I think maybe possibly we should...",
    "suggestedCut": "Remove speculative filler",
    "reason": "Repeated hedge words add no value"
  }
]

TRANSCRIPT:
${transcript}`;

    console.log("[Analyze] Calling API:", `${baseUrl}/v1/chat/completions`);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8192,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    console.log("[Analyze] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Analyze] API error:", response.status, errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}`, details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log("[Analyze] Data keys:", Object.keys(data));
    
    let text = data.choices?.[0]?.message?.content || "";
    console.log("[Analyze] Raw text length:", text.length);

    // Strip <think>... tags
    const thinkMatch = text.match(/<\/think>\s*([\s\S]*?)\s*$/);
    if (thinkMatch) {
      text = thinkMatch[1].trim();
    } else if (text.includes("<think>")) {
      text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }

    console.log("[Analyze] Parsed text preview:", text.substring(0, 500));

    let cuts;
    try {
      cuts = JSON.parse(text);
      if (!Array.isArray(cuts)) {
        console.error("[Analyze] Not an array, type:", typeof cuts);
        throw new Error("Not an array");
      }
      console.log("[Analyze] Success, cuts:", cuts.length);
    } catch (parseError) {
      console.error("[Analyze] JSON parse error:", parseError);
      console.error("[Analyze] Raw text:", text);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ cuts });
  } catch (err) {
    console.error("[Analyze] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
