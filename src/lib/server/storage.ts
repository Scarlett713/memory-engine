import { access, mkdir, writeFile } from "fs/promises";
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
    await access(projectsFilePath);
  } catch {
    await writeFile(projectsFilePath, "[]", "utf8");
  }
}
