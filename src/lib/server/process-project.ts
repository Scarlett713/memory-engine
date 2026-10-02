import path from "path";
import { nanoid } from "nanoid";

import {
  applyRedactionProfile,
  createFallbackStructuredSections,
  createFallbackTimeline,
  hasInlineRedactionPlaceholder,
} from "@/lib/oral-history";
import { getLlmProvider } from "@/lib/providers/llm";
import { getTranscriptionProvider } from "@/lib/providers/transcription";
import { getProjectById, updateProject } from "@/lib/server/project-store";
import { postProcessTranscriptionResult } from "@/lib/server/transcript-postprocess";
import type {
  ProjectRecord,
  SensitiveMark,
  WorkflowStep,
  WorkflowStepKey,
  WorkflowStatus,
} from "@/lib/types/project";

function updateWorkflow(
  workflow: WorkflowStep[],
  patches: Partial<Record<WorkflowStepKey, WorkflowStatus>>,
) {
  return workflow.map((step) => ({
    ...step,
    status: patches[step.key] ?? step.status,
  }));
}

function getSourceUrl(project: ProjectRecord) {
  return project.audioSourceUrl.trim();
}

function getAbsoluteAudioPath(project: ProjectRecord) {
  const storageDir = process.env.LOCAL_STORAGE_DIR?.trim() || "storage";
  return path.join(process.cwd(), storageDir, project.audioStoragePath);
}

export async function processProject(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new Error("未找到对应项目。");
  }

  const sourceUrl = getSourceUrl(project);
  const transcriptionProvider = getTranscriptionProvider();
  const llmProvider = getLlmProvider();
  const absoluteAudioPath = getAbsoluteAudioPath(project);

  await updateProject(projectId, (current) => ({
    lastProcessingError: null,
    status: "transcribing",
    workflow: updateWorkflow(current.workflow, {
      transcription: "in_progress",
      ai_refine: "pending",
      export: "pending",
    }),
  }));

  try {
    const transcriptionResult = await transcriptionProvider.transcribe({
      fileName: project.audioFileName,
      filePath: absoluteAudioPath,
      sourceUrl,
      language: project.language,
    });
    const processedTranscription = postProcessTranscriptionResult(
      transcriptionResult,
    );

    await updateProject(projectId, (current) => ({
      lastProcessingError: null,
      status: "ai_refining",
      transcriptRaw: processedTranscription.text,
      transcriptSegments: processedTranscription.segments,
      transcriptionProvider: processedTranscription.provider,
      workflow: updateWorkflow(current.workflow, {
        transcription: "completed",
        ai_refine: "in_progress",
      }),
    }));

    const llmResult = await llmProvider.refineTranscript({
      transcript: processedTranscription.text,
      scenario: project.collectionScenario,
      researchFocus: project.researchFocus,
      privacyLevel: project.privacyLevel,
      customRedactionRules: project.customRedactionRules,
    });

    // 显式字段放在 ...mark 之后：即便模型越权返回 status/source 也不会覆盖
    const sensitiveMarks: SensitiveMark[] = llmResult.sensitiveMarks.map(
      (mark) => ({
        id: nanoid(6),
        ...mark,
        status: "pending",
        source: "ai",
        needsVerify: mark.needsVerify ?? false,
      }),
    );
    // ① 检测必须在任何 applyRedactionProfile 之前，且只读 llmResult 原始输出。
    // 若改读 redactedAiDraft / redactedSummary，其中已含后端产出的 [已脱敏-xxx]，必然误报。
    const selfRedactedFields = [
      hasInlineRedactionPlaceholder(llmResult.aiDraft) ? "整理稿" : "",
      hasInlineRedactionPlaceholder(llmResult.summary) ? "摘要" : "",
    ].filter(Boolean);

    const redactionNotes =
      selfRedactedFields.length > 0
        ? [
            ...llmResult.redactionNotes,
            `模型在${selfRedactedFields.join("、")}中自行做了脱敏替换，原文可能已丢失，请人工核对并从转写稿补齐。`,
          ]
        : llmResult.redactionNotes;

    const transcriptForRedaction = processedTranscription.text || "";
    const aiDraftForRedaction = llmResult.aiDraft || transcriptForRedaction;
    const redactedTranscript = applyRedactionProfile({
      text: transcriptForRedaction,
      level: project.privacyLevel,
      rules: project.customRedactionRules,
      sensitiveMarks,
    });
    const redactedAiDraft = applyRedactionProfile({
      text: aiDraftForRedaction,
      level: project.privacyLevel,
      rules: project.customRedactionRules,
      sensitiveMarks,
    });

    // ② summary 此前从不脱敏，却原样进 docx/txt 导出与问答 prompt。
    // prompt 已要求模型不自行脱敏，故这里必须补上后端脱敏，否则原始 PII 会写进导出文件。
    const redactedSummary = applyRedactionProfile({
      text: llmResult.summary,
      level: project.privacyLevel,
      rules: project.customRedactionRules,
      sensitiveMarks,
    });

    const processedProject = await updateProject(projectId, (current) => ({
      lastProcessingError: null,
      status: "manual_review",
      summary: redactedSummary,
      keywords: llmResult.keywords,
      aiDraft: llmResult.aiDraft,
      redactedTranscript,
      redactedAiDraft,
      llmProvider: llmResult.provider,
      transcriptSegments: current.transcriptSegments,
      manualDraft: current.manualDraft.trim()
        ? current.manualDraft
        : redactedAiDraft,
      redactionNotes,
      sensitiveMarks,
      emotionalSignals: llmResult.emotionalSignals.map((signal) => ({
        id: nanoid(6),
        ...signal,
      })),
      structuredSections:
        llmResult.structuredSections.length > 0
          ? llmResult.structuredSections.map((section) => ({
              id: nanoid(6),
              ...section,
            }))
          : createFallbackStructuredSections({
              aiDraft: redactedAiDraft,
              notes: current.notes,
              researchFocus: current.researchFocus,
              summary: redactedSummary,
            }),
      timelineEvents:
        llmResult.timelineEvents.length > 0
          ? llmResult.timelineEvents.map((event) => ({
              id: nanoid(6),
              ...event,
            }))
          : createFallbackTimeline(llmResult.summary),
      workflow: updateWorkflow(current.workflow, {
        transcription: "completed",
        ai_refine: "completed",
        manual_review: "in_progress",
        export: "pending",
      }),
    }));

    if (!processedProject) {
      throw new Error("处理结果写入失败。");
    }

    return processedProject;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "项目处理失败，请稍后重试。";

    await updateProject(projectId, (current) => ({
      lastProcessingError: message,
      status: current.aiDraft
        ? "manual_review"
        : current.transcriptRaw
          ? "ai_refining"
          : "uploaded",
      workflow: updateWorkflow(current.workflow, {
        transcription: current.transcriptRaw ? "completed" : "pending",
        ai_refine: current.aiDraft
          ? "completed"
          : current.transcriptRaw
            ? "in_progress"
            : "pending",
      }),
    }));

    throw new Error(message);
  }
}
