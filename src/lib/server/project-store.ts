import { readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

import { buildCollectionPlan } from "@/lib/oral-history";
import { ensureStorageLayout, getProjectsFilePath } from "@/lib/server/storage";
import {
  createInitialWorkflow,
  type CollectionPath,
  type ConfidentialityLevel,
  type InterviewScenario,
  type PrivacyLevel,
  type ProjectRecord,
  type RedactionRule,
  type SensitiveMark,
  type UserType,
} from "@/lib/types/project";

type CreateProjectInput = {
  projectName: string;
  institutionName: string;
  intervieweeName: string;
  customScenarioLabel: string;
  notes: string;
  outlineDraftMarkdown: string;
  audioFileName: string;
  audioStoragePath: string;
  audioSourceUrl: string;
  audioMimeType: string;
  audioSize: number;
  collectionScenario: InterviewScenario;
  researchFocus: string;
  privacyLevel: PrivacyLevel;
  customRedactionRules: RedactionRule[];
  userId: string;
  userType: UserType;
  language?: string;
  confidentialityLevel?: ConfidentialityLevel;
  collectionPath?: CollectionPath;
};

function normalizeWorkflowCopy(
  stored: ProjectRecord["workflow"] | undefined,
): ProjectRecord["workflow"] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return createInitialWorkflow();
  }

  const presets = new Map(
    createInitialWorkflow().map((step) => [step.key, step]),
  );

  return stored.map((step) => {
    const preset = presets.get(step.key);
    return preset
      ? { ...step, label: preset.label, description: preset.description }
      : step;
  });
}

function normalizeProjectRecord(project: Partial<ProjectRecord>): ProjectRecord {
  const collectionScenario = project.collectionScenario || "urban_memory";
  const researchFocus = project.researchFocus || "";

  return {
    id: project.id || nanoid(10),
    projectName: project.projectName || "未命名口述项目",
    institutionName: project.institutionName || "",
    intervieweeName: project.intervieweeName || "",
    customScenarioLabel: project.customScenarioLabel || "",
    notes: project.notes || "",
    outlineDraftMarkdown: project.outlineDraftMarkdown || "",
    audioFileName: project.audioFileName || "",
    audioStoragePath: project.audioStoragePath || "",
    audioSourceUrl: project.audioSourceUrl || "",
    audioMimeType: project.audioMimeType || "application/octet-stream",
    audioSize: project.audioSize || 0,
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString(),
    userId: project.userId,
    status: project.status || "uploaded",
    workflow: normalizeWorkflowCopy(project.workflow),
    collectionScenario,
    researchFocus,
    language: project.language || "",
    privacyLevel: project.privacyLevel || "standard",
    confidentialityLevel: project.confidentialityLevel || "internal",
    collectionPath: project.collectionPath || "upload",
    customRedactionRules: Array.isArray(project.customRedactionRules)
      ? project.customRedactionRules
      : ["phone", "id_card", "address", "contact_account"],
    collectionPlan: project.collectionPlan
      ? project.collectionPlan
      : project.projectName
        ? buildCollectionPlan({
            scenario: collectionScenario,
            intervieweeName: project.intervieweeName || "",
            projectName: project.projectName || "",
            researchFocus,
          })
        : { outline: [], livePrompts: [], safetyTips: [] },
    summary: project.summary || "",
    keywords: Array.isArray(project.keywords) ? project.keywords : [],
    transcriptRaw: project.transcriptRaw || "",
    transcriptSegments: Array.isArray(project.transcriptSegments)
      ? project.transcriptSegments
      : [],
    transcriptionProvider: project.transcriptionProvider || "",
    aiDraft: project.aiDraft || "",
    redactedTranscript: project.redactedTranscript || "",
    redactedAiDraft: project.redactedAiDraft || "",
    llmProvider: project.llmProvider || "",
    structuredSections: Array.isArray(project.structuredSections)
      ? project.structuredSections
      : [],
    timelineEvents: Array.isArray(project.timelineEvents)
      ? project.timelineEvents
      : [],
    emotionalSignals: Array.isArray(project.emotionalSignals)
      ? project.emotionalSignals
      : [],
    manualDraft: project.manualDraft || "",
    redactionNotes: Array.isArray(project.redactionNotes)
      ? project.redactionNotes
      : [],
    // 存量标记没有 status/source/needsVerify 字段，读时逐条补齐默认值。
    // 门禁（countPendingSensitiveMarks）依赖这里的补齐：缺 status 的旧数据按 pending 处理，
    // 否则 undefined 不匹配 "pending"，未审校的旧项目会被直接放行到 ready_to_export。
    sensitiveMarks: Array.isArray(project.sensitiveMarks)
      ? (project.sensitiveMarks as Array<Partial<SensitiveMark>>).map((mark) => ({
          ...mark,
          status: mark.status ?? "pending",
          source: mark.source ?? "ai",
          needsVerify: mark.needsVerify ?? false,
        })) as SensitiveMark[]
      : [],
    lastProcessingError:
      typeof project.lastProcessingError === "string"
        ? project.lastProcessingError
        : null,
    versionHistory: Array.isArray(project.versionHistory)
      ? project.versionHistory
      : [],
    userType: project.userType || "institution",
    consentFormPath: project.consentFormPath || "",
  };
}

async function readProjects(): Promise<ProjectRecord[]> {
  await ensureStorageLayout();

  const fileContent = await readFile(getProjectsFilePath(), "utf8");

  try {
    const parsed = JSON.parse(fileContent) as Partial<ProjectRecord>[];
    return Array.isArray(parsed) ? parsed.map(normalizeProjectRecord) : [];
  } catch {
    return [];
  }
}

async function writeProjects(projects: ProjectRecord[]) {
  await ensureStorageLayout();
  await writeFile(
    getProjectsFilePath(),
    JSON.stringify(projects, null, 2),
    "utf8",
  );
}

function sortProjects(projects: ProjectRecord[]) {
  return projects.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

/**
 * 项目所有权判定：无 userId 的存量项目视为公共项目，
 * 新项目仅归创建它的用户所有。
 */
export function isProjectOwnedBy(
  project: Pick<ProjectRecord, "userId">,
  userId: string | null | undefined,
): boolean {
  return !project.userId || project.userId === userId;
}

export async function listProjects() {
  const projects = await readProjects();
  return sortProjects(projects);
}

export async function getProjectById(projectId: string) {
  const projects = await readProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  const now = new Date().toISOString();
  const newProject: ProjectRecord = {
    id: nanoid(10),
    userId: input.userId,
    projectName: input.projectName,
    institutionName: input.institutionName,
    intervieweeName: input.intervieweeName,
    customScenarioLabel: input.customScenarioLabel,
    notes: input.notes,
    outlineDraftMarkdown: input.outlineDraftMarkdown,
    audioFileName: input.audioFileName,
    audioStoragePath: input.audioStoragePath,
    audioSourceUrl: input.audioSourceUrl,
    audioMimeType: input.audioMimeType,
    audioSize: input.audioSize,
    createdAt: now,
    updatedAt: now,
    status: "uploaded",
    workflow: createInitialWorkflow(),
    collectionScenario: input.collectionScenario,
    researchFocus: input.researchFocus,
    language: input.language,
    privacyLevel: input.privacyLevel,
    confidentialityLevel: input.confidentialityLevel || "internal",
    collectionPath: input.collectionPath || "upload",
    customRedactionRules: input.customRedactionRules,
    collectionPlan: buildCollectionPlan({
      scenario: input.collectionScenario,
      projectName: input.projectName,
      intervieweeName: input.intervieweeName,
      researchFocus: input.researchFocus,
    }),
    summary: "",
    keywords: [],
    transcriptRaw: "",
    transcriptSegments: [],
    transcriptionProvider: "",
    aiDraft: "",
    redactedTranscript: "",
    redactedAiDraft: "",
    llmProvider: "",
    structuredSections: [],
    timelineEvents: [],
    emotionalSignals: [],
    manualDraft: "",
    redactionNotes: [],
    sensitiveMarks: [],
    lastProcessingError: null,
    versionHistory: [],
    userType: input.userType,
    consentFormPath: "",
  };

  const projects = await readProjects();
  const nextProjects = sortProjects([newProject, ...projects]);

  await writeProjects(nextProjects);

  return newProject;
}

export async function updateProject(
  projectId: string,
  updater:
    | Partial<ProjectRecord>
    | ((project: ProjectRecord) => ProjectRecord | Partial<ProjectRecord>),
) {
  const projects = await readProjects();
  const currentProject = projects.find((project) => project.id === projectId);

  if (!currentProject) {
    return null;
  }

  const updatePatch =
    typeof updater === "function" ? updater(currentProject) : updater;

  const nextProject: ProjectRecord = {
    ...currentProject,
    ...updatePatch,
    updatedAt: updatePatch.updatedAt ?? new Date().toISOString(),
  };

  const nextProjects = projects.map((project) =>
    project.id === projectId ? nextProject : project,
  );

  await writeProjects(sortProjects(nextProjects));

  return nextProject;
}

export async function deleteProject(projectId: string) {
  const projects = await readProjects();
  const currentProject = projects.find((project) => project.id === projectId);

  if (!currentProject) {
    return false;
  }

  const nextProjects = projects.filter((project) => project.id !== projectId);
  await writeProjects(sortProjects(nextProjects));

  if (currentProject.audioStoragePath) {
    const storageDir = process.env.LOCAL_STORAGE_DIR?.trim() || "storage";
    const absoluteAudioPath = path.join(
      process.cwd(),
      storageDir,
      currentProject.audioStoragePath,
    );

    try {
      await rm(absoluteAudioPath, { force: true });
    } catch {
      // ignore cleanup failure for deleted project artifacts
    }
  }

  return true;
}
