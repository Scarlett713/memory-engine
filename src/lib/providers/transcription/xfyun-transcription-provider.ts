import { readFile } from "fs/promises";
import path from "path";

import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "@/lib/providers/transcription/types";
import type { TranscriptSegment } from "@/lib/types/project";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少讯飞转写配置：${name}`);
  }
  return value;
}

function getAudioFormat(input: TranscriptionInput) {
  const source = input.fileName || input.filePath;
  const extension = path.extname(source).replace(".", "").toLowerCase();
  return extension || "mp3";
}

// 引入 md5 需要用 crypto 的 createHash
import { createHash, createHmac } from "crypto";

function buildSigna(secretKey: string, appId: string, ts: string) {
  const baseString = createHash("md5")
    .update(appId + ts)
    .digest("hex");

  return createHmac("sha1", secretKey)
    .update(baseString)
    .digest("base64");
}

type XfyunSentence = {
  bg?: number;
  ed?: number;
  spk?: number;
  onebest?: string;
  rl?: number;
};

function normalizeSegments(
  sentences: XfyunSentence[] | undefined,
  fallbackText: string,
): TranscriptSegment[] {
  if (!sentences || sentences.length === 0) {
    if (!fallbackText.trim()) return [];
    return [
      {
        id: "seg-1",
        startMs: 0,
        endMs: 0,
        speaker: "说话人",
        text: fallbackText.trim(),
      },
    ];
  }

  const result: TranscriptSegment[] = [];

  sentences.forEach((sentence, index) => {
    const text = sentence.onebest?.trim();
    if (!text) return;

    const segment: TranscriptSegment = {
      id: `seg-${index + 1}`,
      startMs: sentence.bg ?? 0,
      endMs: sentence.ed ?? sentence.bg ?? 0,
      speaker:
        sentence.spk !== undefined
          ? `说话人 ${sentence.spk}`
          : "说话人",
      text,
    };

    if (typeof sentence.rl === "number") {
      segment.confidence = sentence.rl / 100;
    }

    result.push(segment);
  });

  return result;
}

export class XfyunTranscriptionProvider implements TranscriptionProvider {
  private readonly uploadUrl = "https://raasr.xfyun.cn/v2/api/upload";
  private readonly resultUrl = "https://raasr.xfyun.cn/v2/api/getResult";
  private readonly appId = getRequiredEnv("XFYUN_APP_ID");
  private readonly secretKey = getRequiredEnv("XFYUN_SECRET_KEY");

    private buildAuthParams() {
        const ts = Math.floor(Date.now() / 1000).toString();
        const signa = buildSigna(this.secretKey, this.appId, ts);
        return { ts, signa };
    }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const orderId = await this.uploadFile(input);
    return this.pollResult(orderId);
  }

  private async uploadFile(input: TranscriptionInput): Promise<string> {
    const { ts, signa } = this.buildAuthParams();
    const fileBuffer = await readFile(input.filePath);


    const params = new URLSearchParams({
        appId: this.appId,
        ts,
        signa,
        fileSize: fileBuffer.length.toString(),
        fileName: input.fileName,
        duration: "0",
    });

    const response = await fetch(`${this.uploadUrl}?${params}`, {
        method: "POST",
        headers: {
        "Content-Type": "application/octet-stream",
        },
        body: fileBuffer,
    });

    const payload = (await response.json()) as {
        code?: string | number;
        descInfo?: string;
        content?: { orderId?: string };
    };


    if (String(payload.code) !== "000000" || !payload.content?.orderId) {
        throw new Error(
        `讯飞上传失败：${payload.descInfo ?? "未知错误"}（code: ${payload.code}）`,
        );
    }

    return payload.content.orderId;
  }

  private async pollResult(orderId: string): Promise<TranscriptionResult> {
    const maxAttempts = 60; // 最多等 5 分钟
    const intervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 第一次等 3 秒，后续每 5 秒轮询一次
      await new Promise((resolve) =>
        setTimeout(resolve, attempt === 0 ? 3000 : intervalMs),
      );

      const { ts, signa } = this.buildAuthParams();
      const params = new URLSearchParams({
        appId: this.appId,
        ts,
        signa,
        orderId,
      });

      const response = await fetch(`${this.resultUrl}?${params}`, {
        method: "POST",
      });

      const payload = (await response.json()) as {
        code?: string | number;
        descInfo?: string;
        content?: {
          orderInfo?: { status?: number };
          orderResult?: string;
        };
      };


      if (String(payload.code) !== "000000") {
        throw new Error(
          `讯飞查询失败：${payload.descInfo ?? "未知错误"}（code: ${payload.code}）`,
        );
      }

      const status = payload.content?.orderInfo?.status;

      // status: 0=排队中 1=处理中 2=完成 3=失败
    if (status === -1) {
        throw new Error("讯飞转写任务失败，请检查音频文件格式是否支持。");
    }

    if (status === 4) {
        const orderResult = payload.content?.orderResult;
        if (!orderResult) {
          throw new Error("讯飞转写完成但未返回结果内容。");
        }
        return this.parseResult(orderResult);
      }

      // status 0/1：继续等待
    }

    throw new Error("讯飞转写超时（5分钟），请稍后重试。");
  }

  private parseResult(orderResult: string): TranscriptionResult {
    let parsed: Record<string, unknown>;

    try {
        parsed = JSON.parse(orderResult) as Record<string, unknown>;
    } catch {
        return {
        provider: "xfyun",
        text: orderResult.trim(),
        segments: [
            {
            id: "seg-1",
            startMs: 0,
            endMs: 0,
            speaker: "说话人",
            text: orderResult.trim(),
            },
        ],
        };
    }

    // 优先用 lattice2（包含说话人信息），否则用 lattice
    const lattice2 = Array.isArray(parsed.lattice2) ? parsed.lattice2 : [];
    const lattice = Array.isArray(parsed.lattice) ? parsed.lattice : [];
    const source = lattice2.length > 0 ? lattice2 : lattice;

    const segments: TranscriptSegment[] = [];
    const textParts: string[] = [];

    source.forEach((item: Record<string, unknown>, index: number) => {
        // 解析 json_1best（可能是字符串或对象）
        let stData: Record<string, unknown> | null = null;

        if (typeof item.json_1best === "string") {
        try {
            const parsed1best = JSON.parse(item.json_1best) as Record<string, unknown>;
            stData = parsed1best.st as Record<string, unknown>;
        } catch {
            // ignore
        }
        } else if (
        item.json_1best &&
        typeof item.json_1best === "object" &&
        (item.json_1best as Record<string, unknown>).st
        ) {
        stData = (item.json_1best as Record<string, unknown>).st as Record<string, unknown>;
        }

        if (!stData) return;

        // 提取文字
        const rtArray = Array.isArray(stData.rt) ? stData.rt : [];
        let segmentText = "";

        for (const rt of rtArray) {
        const rtObj = rt as Record<string, unknown>;
        const wsArray = Array.isArray(rtObj.ws) ? rtObj.ws : [];

        for (const ws of wsArray) {
            const wsObj = ws as Record<string, unknown>;
            const cwArray = Array.isArray(wsObj.cw) ? wsObj.cw : [];

            for (const cw of cwArray) {
            const cwObj = cw as Record<string, unknown>;
            const word = typeof cwObj.w === "string" ? cwObj.w : "";
            segmentText += word;
            }
        }
        }

        segmentText = segmentText.trim();
        if (!segmentText) return;

        textParts.push(segmentText);

        // 提取时间（单位：毫秒）
        const bg = Number(stData.bg ?? item.begin ?? 0);
        const ed = Number(stData.ed ?? item.end ?? 0);

        // 提取说话人
        const spk = typeof item.spk === "string" ? item.spk : `说话人`;

        // 提取置信度
        const sc = typeof stData.sc === "string" ? parseFloat(stData.sc) : undefined;

        const segment: TranscriptSegment = {
        id: `seg-${index + 1}`,
        startMs: bg,
        endMs: ed,
        speaker: spk,
        text: segmentText,
        };

        if (typeof sc === "number" && !isNaN(sc)) {
        segment.confidence = sc;
        }

        segments.push(segment);
    });

    const fullText = textParts.join("");

    return {
        provider: "xfyun",
        text: fullText || orderResult,
        segments: segments.length > 0 ? segments : [
        {
            id: "seg-1",
            startMs: 0,
            endMs: 0,
            speaker: "说话人",
            text: fullText || orderResult,
        },
        ],
    };
  };
};
