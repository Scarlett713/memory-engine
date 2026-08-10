import { MockTranscriptionProvider } from "@/lib/providers/transcription/mock-transcription-provider";
import { VolcengineTranscriptionProvider } from "@/lib/providers/transcription/volcengine-transcription-provider";
import type { TranscriptionProvider } from "@/lib/providers/transcription/types";

export function getTranscriptionProvider(): TranscriptionProvider {
  const provider = process.env.TRANSCRIPTION_PROVIDER?.trim() || "mock";

  switch (provider) {
    case "volcengine":
      return new VolcengineTranscriptionProvider();
    case "mock":
    default:
      return new MockTranscriptionProvider();
  }
}
