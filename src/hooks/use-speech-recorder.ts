"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * REQ-14 Step 3：把两条浏览器原生 API 封成一个 hook。
 *
 * - Web Speech（SpeechRecognition）→ 实时字幕，逐段回调 onCaption。
 * - MediaRecorder → 全程单文件录音，stop() 后在 onstop 里组装 Blob 交 onWavReady。
 *
 * 业务语言仍叫「WAV」，实际 container 是 webm/ogg（Chrome/Firefox 的 MediaRecorder
 * 不产 WAV）。mime 挂在 blob.type 上，由调用方上传时自己读，服务端转码留部署验证。
 */

/* ── 最小类型声明 ─────────────────────────────────────────────
   TS 5.9 的 lib.dom.d.ts 只有 SpeechRecognitionResult /
   SpeechRecognitionResultList / SpeechRecognitionAlternative，
   没有构造器、事件和 webkit 前缀，必须自己补一份。
   统一 Minimal* 前缀，避免和 lib.dom 的同名全局接口混淆。 */

type MinimalSpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type MinimalSpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: MinimalSpeechRecognitionAlternative;
};

type MinimalSpeechRecognitionResultList = {
  length: number;
  [index: number]: MinimalSpeechRecognitionResult;
};

type MinimalSpeechRecognitionEvent = {
  resultIndex: number;
  results: MinimalSpeechRecognitionResultList;
};

type MinimalSpeechRecognitionErrorEvent = {
  error: string;
  message: string;
};

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: MinimalSpeechRecognitionErrorEvent) => void) | null;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

/** SSR 安全：服务端没有 window，取不到就返回 null。 */
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const scoped = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition ?? null;
}

/** 优先 webm/opus（Chrome），回退 ogg（Firefox）；都不支持交给浏览器默认。 */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

const DEFAULT_WARN_MINUTES = 45;
const TIMER_INTERVAL_MS = 1000;

export type UseSpeechRecorderOptions = {
  /** 实时字幕回调。isFinal 为 false 时 text 是本轮临时结果，会覆盖上一段临时结果。 */
  onCaption: (text: string, isFinal: boolean) => void;
  /** 录音结束回调。blob.type 即实际 mime。 */
  onWavReady: (blob: Blob) => void;
  /** 录音时长提示阈值（分钟），默认 45。 */
  warnMinutes?: number;
};

export type UseSpeechRecorderResult = {
  isRecording: boolean;
  /** 当前录音时长，暂停期间冻结。 */
  durationMs: number;
  /** 权限失败或能力降级的人话说明；正常时为 null。 */
  permissionError: string | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

export function useSpeechRecorder({
  onCaption,
  onWavReady,
  warnMinutes = DEFAULT_WARN_MINUTES,
}: UseSpeechRecorderOptions): UseSpeechRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startedAtRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef(0);
  const warnedRef = useRef(false);

  // onend 里要同步判断「是否还在录」，等 setState 已经太晚；暂停同理。
  const isRecordingRef = useRef(false);
  const pausedRef = useRef(false);

  // 调用方传的是内联箭头函数，进 deps 会让识别反复重建；走 latest-ref。
  const callbacksRef = useRef({ onCaption, onWavReady });
  useEffect(() => {
    callbacksRef.current = { onCaption, onWavReady };
  });

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (isRecordingRef.current) {
      return;
    }

    setPermissionError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setPermissionError("当前浏览器不支持录音（缺少 MediaRecorder / getUserMedia）。");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException)?.name ?? "";
      setPermissionError(
        name === "NotFoundError"
          ? "没有找到可用的麦克风设备。"
          : "未获得麦克风权限，无法录音。请在浏览器地址栏放行后重试。",
      );
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    warnedRef.current = false;
    pausedRef.current = false;
    pausedAccumRef.current = 0;
    pausedAtRef.current = 0;
    startedAtRef.current = Date.now();
    isRecordingRef.current = true;
    setDurationMs(0);

    // ── 录音 ────────────────────────────────────────────────
    const mimeType = pickMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      chunksRef.current = [];
      stopStream();
      callbacksRef.current.onWavReady(blob);
    };

    // 不传 timeslice：单文件连续，暂停用 pause()/resume() 而非切片拼接。
    recorder.start();
    mediaRecorderRef.current = recorder;

    // ── 实时字幕 ────────────────────────────────────────────
    const RecognitionCtor = getSpeechRecognitionCtor();

    if (!RecognitionCtor) {
      setPermissionError(
        "当前浏览器不支持实时字幕（Web Speech），已降级为仅录音。",
      );
      setIsRecording(true);

      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) {
            callbacksRef.current.onCaption(trimmed, true);
          }
        } else {
          interim += text;
        }
      }

      // 空串不回调：否则会把已经定格的临时字幕清掉。
      const trimmedInterim = interim.trim();
      if (trimmedInterim) {
        callbacksRef.current.onCaption(trimmedInterim, false);
      }
    };

    // Chrome 静默约 60s 会自动停，仍在录且未暂停时必须续接。
    recognition.onend = () => {
      if (!isRecordingRef.current || pausedRef.current) {
        return;
      }

      try {
        recognition.start();
      } catch {
        // 已经在运行会抛 InvalidStateError，忽略即可。
      }
    };

    recognition.onerror = (event) => {
      // no-speech / aborted 是良性的（abort() 一定会触发一次），不打扰用户。
      if (event.error === "not-allowed") {
        setPermissionError("实时字幕被拒绝：请允许麦克风与语音识别权限，录音仍在继续。");
      } else if (event.error === "service-not-allowed") {
        setPermissionError("实时字幕服务不可用（可能未联网），已降级为仅录音。");
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // 同上。
    }

    setIsRecording(true);
  }, [stopStream]);

  const stop = useCallback(() => {
    if (!isRecordingRef.current) {
      return;
    }

    isRecordingRef.current = false;
    pausedRef.current = false;
    setIsRecording(false);

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // 未在运行，忽略。
      }
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    if (recorder && recorder.state !== "inactive") {
      // onstop 里组装 Blob → onWavReady，并在那里停掉麦克风轨道。
      recorder.stop();
    } else {
      stopStream();
    }
  }, [stopStream]);

  const pause = useCallback(() => {
    if (!isRecordingRef.current || pausedRef.current) {
      return;
    }

    pausedRef.current = true;
    pausedAtRef.current = Date.now();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      // onend 的续接条件里有 !pausedRef.current，这里不必摘 onend。
      try {
        recognition.abort();
      } catch {
        // 未在运行，忽略。
      }
    }
  }, []);

  const resume = useCallback(() => {
    if (!isRecordingRef.current || !pausedRef.current) {
      return;
    }

    pausedAccumRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = 0;
    pausedRef.current = false;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.start();
      } catch {
        // 已经在运行，忽略。
      }
    }
  }, []);

  // 计时 + 超时提示。暂停期间算出来是常数，React 会 bail out，等于冻结。
  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const warnMs = warnMinutes * 60 * 1000;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const pausedTotal =
        pausedAccumRef.current +
        (pausedAtRef.current > 0 ? now - pausedAtRef.current : 0);
      const elapsed = now - startedAtRef.current - pausedTotal;

      setDurationMs(elapsed);

      if (!warnedRef.current && elapsed >= warnMs) {
        warnedRef.current = true;
        callbacksRef.current.onCaption(
          `[⚠️ 录音已达 ${warnMinutes} 分钟，建议尽快结束]`,
          true,
        );
      }
    }, TIMER_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isRecording, warnMinutes]);

  // 卸载兜底：不释放麦克风的话，浏览器标签页的录音红点会一直亮着。
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      pausedRef.current = false;

      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // 未在运行，忽略。
        }
        recognitionRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder) {
        // 卸载后不再回调 onWavReady，只求把设备和轨道放掉。
        recorder.onstop = null;
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // 已经停了，忽略。
          }
        }
        mediaRecorderRef.current = null;
      }

      stopStream();
    };
  }, [stopStream]);

  return { isRecording, durationMs, permissionError, start, stop, pause, resume };
}
