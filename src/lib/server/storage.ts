import { mkdir, writeFile } from "fs/promises";
import path from "path";

function getStorageRoot() {
  const localStorageDir = process.env.LOCAL_STORAGE_DIR?.trim() || "storage";
  return path.join(process.cwd(), localStorageDir);
}

export function getUploadsDirectory() {
  return path.join(getStorageRoot(), "uploads");
}

export function getProjectsFilePath() {
  return path.join(getStorageRoot(), "projects.json");
}

export async function ensureStorageLayout() {
  const storageRoot = getStorageRoot();
  const uploadsDirectory = getUploadsDirectory();
  const projectsFilePath = getProjectsFilePath();

  await mkdir(storageRoot, { recursive: true });
  await mkdir(uploadsDirectory, { recursive: true });

  try {
    // wx = 独占创建：并发首次启动时只有一个能建成，其余 EEXIST。
    // 原来的 access-then-write 存在 TOCTOU —— 两个调用都可能 access 失败，
    // 后一个的 writeFile("[]") 会盖掉前一个刚写入的真实数据。
    await writeFile(projectsFilePath, "[]", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}
