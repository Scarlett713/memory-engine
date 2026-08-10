import { writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

import { ensureStorageLayout, getUploadsDirectory } from "@/lib/server/storage";

export type SavedInterviewAudio = {
  fileName: string;
  mimeType: string;
  size: number;
  relativePath: string;
};

const allowedExtensions = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
]);

function normalizeExtension(file: File) {
  const extension = path.extname(file.name).toLowerCase();

  if (extension) {
    return extension;
  }

  if (file.type === "audio/wav") {
    return ".wav";
  }

  if (file.type === "audio/mpeg") {
    return ".mp3";
  }

  if (file.type === "audio/mp4") {
    return ".m4a";
  }

  return "";
}

export async function saveInterviewAudio(file: File): Promise<SavedInterviewAudio> {
  if (file.size <= 0) {
    throw new Error("上传文件为空，请重新选择音频。");
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error("演示版本建议上传 100MB 以内的音频文件。");
  }

  const extension = normalizeExtension(file);
  const isAudioMime = file.type.startsWith("audio/");

  if (!isAudioMime && !allowedExtensions.has(extension)) {
    throw new Error("仅支持常见音频文件格式上传。");
  }

  await ensureStorageLayout();

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeExtension = allowedExtensions.has(extension) ? extension : ".audio";
  const storedFileName = `${Date.now()}-${nanoid(8)}${safeExtension}`;
  const absoluteFilePath = path.join(getUploadsDirectory(), storedFileName);

  await writeFile(absoluteFilePath, bytes);

  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    relativePath: path.posix.join("uploads", storedFileName),
    size: file.size,
  };
}
