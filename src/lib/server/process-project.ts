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

    // ② summary 此前从不脱敏，却原样进 docx/txt 导出与问答 prompt。
    // prompt 已要求模型不自行脱敏，故这里必须补上后端脱敏，否则原始 PII 会写进导出文件。
    // ③ 四类要素字段（keywords / emotionalSignals / structuredSections / timelineEvents）
    // 同样从不脱敏，却原样进 docx/txt/json 导出与 ask 路由的 prompt。
    // ark-llm-provider 的 prompt 明确要求「不要自行脱敏，脱敏由系统在你返回之后统一执行」，
    // 并逐一点名了这几类字段，这里补上才对得上那句承诺。
    // 收敛成局部闭包：下面要对十几个短字段各调一次，逐处写完整字面量必然漂移。
    const redactText = (text: string) =>
      applyRedactionProfile({
        text,
        level: project.privacyLevel,
        rules: project.customRedactionRules,
        sensitiveMarks,
      });

    const redactedTranscript = redactText(transcriptForRedaction);
    const redactedAiDraft = redactText(aiDraftForRedaction);
    const redactedSummary = redactText(llmResult.summary);

    const processedProject = await updateProject(projectId, (current) => ({
      lastProcessingError: null,
      status: "manual_review",
      summary: redactedSummary,
      // 关键词可能整条就是敏感片段（如人名），必须脱敏。
      // 去重不是可选项：两个不同的人名都会变成 [已脱敏-姓名]，
      // 重复项会撞关键词面板的 key={keyword}。
      keywords: Array.from(
        new Set(llmResult.keywords.map((keyword) => redactText(keyword))),
      ).filter(Boolean),
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
        // 显式字段放 ...signal 之后，脱敏结果不会被模型返回的原文覆盖
        // （同上方 sensitiveMarks 的处理）。level 是枚举、id 是 nanoid，都不脱敏。
        label: redactText(signal.label),
        excerpt: redactText(signal.excerpt),
        guidance: redactText(signal.guidance),
      })),
      structuredSections:
        llmResult.structuredSections.length > 0
          ? llmResult.structuredSections.map((section) => ({
              id: nanoid(6),
              ...section,
              heading: redactText(section.heading),
              content: redactText(section.content),
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
              timeLabel: redactText(event.timeLabel),
              title: redactText(event.title),
              description: redactText(event.description),
            }))
          : // 兜底项的 description 就是 summary，必须传脱敏后的，
            // 否则原始 PII 从这条兜底路径绕回导出文件（结构化档案兜底早已传 redactedSummary）。
            createFallbackTimeline(redactedSummary),
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
