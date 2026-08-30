import type { TranscriptSegment } from "@/lib/types/project";

export type TranscriptionInput = {
  filePath: string;
  fileName: string;
  sourceUrl?: string;
  language?: string;
};

export type TranscriptionResult = {
  text: string;
  provider: string;
  sourceUrl?: string;
  segments: TranscriptSegment[];
};

export interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
