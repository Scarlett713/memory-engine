import type { TranscriptionResult } from "@/lib/providers/transcription/types";
import type { TranscriptSegment } from "@/lib/types/project";

const MIN_SEGMENT_DURATION_MS = 12_000;
const PREFERRED_SEGMENT_DURATION_MS = 28_000;
const MAX_SEGMENT_DURATION_MS = 42_000;
const MAX_SEGMENT_GAP_MS = 1_800;
const MIN_SEGMENT_TEXT_LENGTH = 26;

function cleanTranscriptText(text: string) {
  let value = text.trim();

  if (!value) {
    return "";
  }

  value = value.replace(/\s+/g, "");

  // Remove common oral fillers while preserving the surrounding sentence.
  value = value.replace(
    /(^|[，。！？；：、,])(?:嗯+|呃+|额+|啊+|欸+|诶+|唉+)(?=([，。！？；：、,]|$))/g,
    "$1",
  );
  value = value.replace(
    /(^|[，。！？；：、,])(?:嗯+|呃+|额+|啊+|欸+|诶+|唉+)[，、,]*/g,
    "$1",
  );
  value = value.replace(
    /(?<=[那这就先想要会又也还并且然后所以因此从把向跟给])(?:嗯+|呃+|额+|啊+)(?=[\u4e00-\u9fa5\[])/g,
    "",
  );
  value = value.replace(
    /(?<=[\u4e00-\u9fa5\]])(?:嗯+|呃+|额+|啊+)(?=[\u4e00-\u9fa5\[])/g,
    "",
  );

  value = value.replace(/[，、,]{2,}/g, "，");
  value = value.replace(/[。]{2,}/g, "。");
  value = value.replace(/[！？]{2,}/g, "。");
  value = value.replace(/^[，。！？；：、,\s]+/g, "");
  value = value.replace(/[，；：、,\s]+$/g, "");

  return value.trim();
}

function mergeTextParts(parts: string[]) {
  return parts.reduce((combined, part) => {
    if (!part) {
      return combined;
    }

    if (!combined) {
      return part;
    }

    return `${combined}${part}`;
  }, "");
}

function getSegmentDuration(segment: TranscriptSegment) {
  return Math.max(0, segment.endMs - segment.startMs);
}

function shouldMergeSegments(current: TranscriptSegment, next: TranscriptSegment) {
  if (current.speaker !== next.speaker) {
    return false;
  }

  const gapMs = Math.max(0, next.startMs - current.endMs);

  if (gapMs > MAX_SEGMENT_GAP_MS) {
    return false;
  }

  const currentDuration = getSegmentDuration(current);
  const nextDuration = getSegmentDuration(next);
  const mergedDuration = Math.max(0, next.endMs - current.startMs);
  const currentEndsSentence = /[。！？!?]$/.test(current.text);
  const currentIsShort =
    currentDuration < MIN_SEGMENT_DURATION_MS ||
    current.text.length < MIN_SEGMENT_TEXT_LENGTH;
  const nextIsShort =
    nextDuration < 6_000 || next.text.length < Math.floor(MIN_SEGMENT_TEXT_LENGTH * 0.6);

  if (mergedDuration <= PREFERRED_SEGMENT_DURATION_MS) {
    return true;
  }

  if (mergedDuration > MAX_SEGMENT_DURATION_MS) {
    return false;
  }

  return currentIsShort || nextIsShort || !currentEndsSentence;
}

function mergeSegments(segments: TranscriptSegment[]) {
  const merged: TranscriptSegment[] = [];

  for (const segment of segments) {
    const cleanedText = cleanTranscriptText(segment.text);

    if (!cleanedText) {
      continue;
    }

    const normalizedSegment: TranscriptSegment = {
      ...segment,
      text: cleanedText,
    };
    const previous = merged.at(-1);

    if (!previous || !shouldMergeSegments(previous, normalizedSegment)) {
      merged.push({
        ...normalizedSegment,
        id: `seg-${merged.length + 1}`,
      });
      continue;
    }

    const previousConfidence =
      typeof previous.confidence === "number" ? previous.confidence : null;
    const nextConfidence =
      typeof normalizedSegment.confidence === "number"
        ? normalizedSegment.confidence
        : null;

    previous.endMs = Math.max(previous.endMs, normalizedSegment.endMs);
    previous.text = mergeTextParts([previous.text, normalizedSegment.text]);

    if (previousConfidence !== null && nextConfidence !== null) {
      previous.confidence = (previousConfidence + nextConfidence) / 2;
    } else if (previousConfidence === null) {
      previous.confidence = nextConfidence ?? undefined;
    }
  }

  return merged;
}

function buildFormattedTranscript(segments: TranscriptSegment[]) {
  const speakers = new Set(
    segments.map((segment) => segment.speaker.trim()).filter(Boolean),
  );
  const showSpeaker = speakers.size > 1;

  return segments
    .map((segment) => {
      const totalSeconds = Math.max(0, Math.floor(segment.startMs / 1000));
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      const heading = showSpeaker
        ? `${minutes}:${seconds} ${segment.speaker}`
        : `${minutes}:${seconds}`;

      return `${heading}\n${segment.text}`;
    })
    .join("\n\n");
}

export function postProcessTranscriptionResult(
  result: TranscriptionResult,
): TranscriptionResult {
  const mergedSegments = mergeSegments(result.segments);
  const cleanedTextFromSegments = buildFormattedTranscript(mergedSegments);
  const fallbackText = cleanTranscriptText(result.text);

  return {
    ...result,
    text: cleanedTextFromSegments || fallbackText,
    segments: mergedSegments,
  };
}
