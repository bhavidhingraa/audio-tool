import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

export interface Cut {
  timestamp?: string;
  startTime: number;
  endTime: number;
  original: string;
  suggestedCut: string;
  reason: string;
}

let ffmpeg: FFmpeg | null = null;

export async function loadFFmpeg(
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(progress * 100);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export async function processAudio(
  audioData: Uint8Array,
  cuts: Cut[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress);

  const inputName = "input.mp3";
  const outputName = "output.mp3";

  await ff.writeFile(inputName, audioData);

  const sortedCuts = [...cuts].sort((a, b) => a.startTime - b.startTime);

  const keepSegments: string[] = [];
  let cursor = 0;

  for (const cut of sortedCuts) {
    if (cursor < cut.startTime) {
      const segName = `keep_${keepSegments.length}.mp3`;
      await ff.exec([
        "-i", inputName,
        "-ss", cursor.toString(),
        "-to", cut.startTime.toString(),
        "-c", "copy",
        segName
      ]);
      keepSegments.push(segName);
    }
    cursor = cut.endTime;
  }

  if (cursor > 0) {
    const segName = `keep_${keepSegments.length}.mp3`;
    await ff.exec([
      "-i", inputName,
      "-ss", cursor.toString(),
      "-c", "copy",
      segName
    ]);
    keepSegments.push(segName);
  }

  if (keepSegments.length === 0) {
    const data = await ff.readFile(inputName);
    const uint8 = new Uint8Array(data as Uint8Array);
    return new Blob([uint8.buffer as ArrayBuffer], { type: "audio/mpeg" });
  }

  const concatList = keepSegments.map((_, i) => `file 'keep_${i}.mp3'`).join("\n");
  await ff.writeFile("concat.txt", concatList);

  await ff.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "concat.txt",
    "-c", "copy",
    outputName
  ]);

  const data = await ff.readFile(outputName);
  const uint8Out = new Uint8Array(data as Uint8Array);

  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  for (const seg of keepSegments) {
    await ff.deleteFile(seg);
  }
  await ff.deleteFile("concat.txt");

  return new Blob([uint8Out.buffer as ArrayBuffer], { type: "audio/mpeg" });
}

export function timestampToSeconds(timestamp: string): number {
  const match = timestamp.match(/(\d+):(\d+)(?::(\d+))?/);
  if (!match) return 0;

  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}