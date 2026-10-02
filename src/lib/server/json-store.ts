import { copyFile, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * 单文件 JSON 存储的读写原语。
 *
 * 目标：读方拿到的永远是「完整的旧版本」或「完整的新版本」，
 * 且并发写不会互相覆盖（丢更新）。
 */

export type JsonReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "missing" }
  | { status: "corrupt"; error: unknown };

function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code ?? "";
}

// Windows 上 rename 覆盖已存在文件时，杀软/索引器/编辑器可能短暂持有目标句柄，
// 表现为 EPERM / EBUSY / EACCES。退避重试即可，不是真的失败。
const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_MAX_ATTEMPTS = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (
        !RENAME_RETRY_CODES.has(errorCode(error)) ||
        attempt >= RENAME_MAX_ATTEMPTS - 1
      ) {
        throw error;
      }

      await delay(10 * 2 ** attempt);
    }
  }
}

// 递增计数保证同一毫秒内的多次调用也拿到不同的临时文件名：
// 只靠 Date.now() 的话，并发调用会算出同一路径，先 rename 走的那个
// 会让后一个 rename 撞 ENOENT。
let temporaryCounter = 0;

/**
 * 原子写：先写同目录临时文件，再 rename 覆盖目标。
 * 临时文件必须与目标同目录 —— 跨设备 rename 会退化成复制，不再原子。
 *
 * 注意：原子写只保证「读方不会读到半个文件」，不保证并发写不丢更新 ——
 * 后者必须靠 runExclusive 包住整个 read-modify-write。
 */
export async function writeJsonAtomic(filePath: string, data: unknown) {
  const payload = JSON.stringify(data, null, 2);
  temporaryCounter += 1;
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${temporaryCounter}.tmp`,
  );

  try {
    await writeFile(temporaryPath, payload, "utf8");
    await renameWithRetry(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

/**
 * 读 JSON 并区分「文件缺失」与「文件损坏」。
 * 二者后果完全不同，不能合并成一个 catch 处理。
 */
export async function readJsonFile<T>(
  filePath: string,
): Promise<JsonReadResult<T>> {
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return { status: "missing" };
    }

    return { status: "corrupt", error };
  }

  try {
    return { status: "ok", data: JSON.parse(raw) as T };
  } catch (error) {
    return { status: "corrupt", error };
  }
}

/**
 * 为损坏文件留一份隔离副本：只复制，不移动、不删除。
 * 目的是让「读宽容」不至于演变成「写覆盖后无据可查」。
 */
export async function quarantineFile(filePath: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = `${filePath}.corrupt-${stamp}`;

  try {
    await copyFile(filePath, target);
    return target;
  } catch {
    return null;
  }
}

const queues = new Map<string, Promise<unknown>>();

/**
 * 进程内按 key 串行化。
 *
 * 必须包住整个 read-modify-write —— 只包 write 的话，两个请求仍会先后
 * 用同一份旧快照互相覆盖，丢更新照旧发生。
 */
export function runExclusive<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  // 前一个任务 reject 也不能卡死队列：onFulfilled / onRejected 都传 task。
  const result = previous.then(task, task);

  queues.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );

  return result;
}
