import { readFile } from "fs/promises";
import path from "path";

import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "@/lib/providers/transcription/types";
import type { TranscriptSegment } from "@/lib/types/project";

function getAudioFormat(input: TranscriptionInput) {
  const source = input.fileName || input.sourceUrl || input.filePath;
  const extension = path.extname(source).replace(".", "").toLowerCase();
  return extension || "mp3";
}

function getRequiredEnv(name: string, label: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少火山语音配置：${label}（${name}）。`);
  }

  return value;
}

type FlashUtterance = {
  start_time?: number;
  end_time?: number;
  text?: string;
  speaker?: string | number;
  confidence?: number;
};

type FlashResponsePayload = {
  header?: {
    code?: number;
    message?: string;
  };
  result?: {
    text?: string;
    utterances?: FlashUtterance[];
  };
};

function normalizeSegments(utterances: FlashUtterance[] | undefined, text: string) {
  const segments = (utterances ?? []).map<TranscriptSegment | null>((utterance, index) => {
      const segmentText = utterance.text?.trim();

      if (!segmentText) {
        return null;
      }

      return {
        id: `seg-${index + 1}`,
        startMs: Number(utterance.start_time ?? 0),
        endMs: Number(utterance.end_time ?? utterance.start_time ?? 0),
        speaker:
          utterance.speaker === undefined || utterance.speaker === null
            ? "说话人"
            : `说话人 ${utterance.speaker}`,
        text: segmentText,
        confidence:
          typeof utterance.confidence === "number"
            ? utterance.confidence
            : undefined,
      };
    });

  const normalizedSegments = segments.filter(
    (item): item is TranscriptSegment => Boolean(item),
  );

  if (normalizedSegments.length > 0) {
    return normalizedSegments;
  }

  if (!text.trim()) {
    return [];
  }

  return [
    {
      id: "seg-1",
      startMs: 0,
      endMs: 0,
      speaker: "说话人",
      text: text.trim(),
    },
  ];
}

export class VolcengineTranscriptionProvider implements TranscriptionProvider {
  private readonly apiUrl =
    process.env.TRANSCRIPTION_API_URL?.trim() ||
    "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";

  private readonly resourceId =
    process.env.TRANSCRIPTION_API_RESOURCE_ID?.trim() || "volc.bigasr.auc_turbo";

  private readonly appId = getRequiredEnv(
    "TRANSCRIPTION_APP_ID",
    "App ID",
  );

  private readonly accessKey = getRequiredEnv(
    "TRANSCRIPTION_API_KEY",
    "Access Token",
  );

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const requestId = crypto.randomUUID();
    const fileBuffer = await readFile(input.filePath);

    const payload = {
      user: {
        uid: this.appId,
      },
      audio: {
        data: fileBuffer.toString("base64"),
        format: getAudioFormat(input),
      },
      request: {
        model_name: "bigmodel",
        enable_itn: true,
        enable_punc: true,
        enable_ddc: false,
        show_utterances: true,
      },
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Key": this.appId,
        "X-Api-Access-Key": this.accessKey,
        "X-Api-Resource-Id": this.resourceId,
        "X-Api-Request-Id": requestId,
        "X-Api-Sequence": "-1",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const parsed = this.parseResponse(text);
    const statusCode = Number(response.headers.get("X-Api-Status-Code") || "0");
    const apiCode = parsed.header?.code ?? statusCode;
    const apiMessage =
      parsed.header?.message ||
      response.headers.get("X-Api-Message") ||
      "火山语音接口调用失败。";

    if (!response.ok || (apiCode && apiCode !== 20000000)) {
      throw new Error(`火山语音转写失败：${apiMessage}`);
    }

    const transcript = parsed.result?.text?.trim();

    if (!transcript) {
      throw new Error("火山语音未返回可用的转写文本。");
    }

    return {
      provider: "volcengine-flash",
      sourceUrl: input.sourceUrl,
      text: transcript,
      segments: normalizeSegments(parsed.result?.utterances, transcript),
    };
  }

  private parseResponse(text: string): FlashResponsePayload {
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as FlashResponsePayload;
    } catch {
      throw new Error("火山语音返回了无法解析的响应内容。");
    }
  }
}
