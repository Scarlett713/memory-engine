import { NextRequest, NextResponse } from "next/server";

import { applyRedactionProfile } from "@/lib/oral-history";
import {
  deleteProject,
  getProjectById,
  isProjectOwnedBy,
  updateProject,
} from "@/lib/server/project-store";
import {
  VALID_TRANSITIONS,
  countPendingSensitiveMarks,
  type ProjectRecord,
  type SensitiveMark,
  type SensitiveMarkStatus,
} from "@/lib/types/project";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

const sensitiveMarkStatuses: readonly SensitiveMarkStatus[] = [
  "pending",
  "confirmed",
  "revoked",
];

type MarkReview = {
  id: string;
  status: SensitiveMarkStatus;
  reviewedAt?: string;
};

// 只接受 { id, status, reviewedAt }，其余字段由服务端已存值保持原样。
// status 非法直接判无效（调用方返回 400），不静默忽略。
function parseMarkReviews(
  value: unknown,
): { ok: true; reviews: MarkReview[] } | { ok: false } {
  if (!Array.isArray(value)) {
    return { ok: false };
  }

  const reviews: MarkReview[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false };
    }

    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const status = entry.status;

    if (!id || !sensitiveMarkStatuses.includes(status as SensitiveMarkStatus)) {
      return { ok: false };
    }

    const reviewedAt =
      typeof entry.reviewedAt === "string" && entry.reviewedAt.trim()
        ? entry.reviewedAt.trim()
        : undefined;

    reviews.push({ id, status: status as SensitiveMarkStatus, reviewedAt });
  }

  return { ok: true, reviews };
}

// 以服务端已存标记为准遍历：id 未命中的入参自然被忽略，未提及的标记保持原值。
function mergeMarkReviews(current: SensitiveMark[], reviews: MarkReview[]) {
  const byId = new Map(reviews.map((review) => [review.id, review]));

  return current.map((mark) => {
    const review = byId.get(mark.id);

    if (!review) {
      return mark;
    }

    return {
      ...mark,
      status: review.status,
      // 未传 reviewedAt 时保留已存值，不清空
      reviewedAt: review.reviewedAt ?? mark.reviewedAt,
    };
  });
}

// 撤销/确认标记后重算两份脱敏文本。
// aiDraft 为空时的兜底必须与 process-project.ts 的
// `llmResult.aiDraft || transcriptForRedaction` 保持一致，否则 aiDraft 为空的项目
// 重算结果会和原始 redactedAiDraft 不一致。
function rebuildRedactedTexts(
  project: ProjectRecord,
  marks: SensitiveMark[],
): Partial<ProjectRecord> {
  // 还没跑过处理的项目没有原文，重算会把已有内容清成空串
  if (!project.transcriptRaw) {
    return {};
  }

  const redactedTranscript = applyRedactionProfile({
    text: project.transcriptRaw,
    level: project.privacyLevel,
    rules: project.customRedactionRules,
    sensitiveMarks: marks,
  });
  const redactedAiDraft = applyRedactionProfile({
    text: project.aiDraft || project.transcriptRaw,
    level: project.privacyLevel,
    rules: project.customRedactionRules,
    sensitiveMarks: marks,
  });

  return {
    redactedTranscript,
    redactedAiDraft,
    // process 时 manualDraft 被自动填成 redactedAiDraft；仍与旧值相同说明用户没手改过，
    // 跟着一起重算。比较用的是重算前的 project 快照。
    manualDraft:
      project.manualDraft === project.redactedAiDraft
        ? redactedAiDraft
        : project.manualDraft,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ message: "未登录。" }, { status: 401 });
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  if (!isProjectOwnedBy(project, userId)) {
    return NextResponse.json(
      { message: "无权访问该项目。" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    project,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ message: "未登录。" }, { status: 401 });
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  if (!isProjectOwnedBy(project, userId)) {
    return NextResponse.json(
      { message: "无权访问该项目。" },
      { status: 403 },
    );
  }

  const deleted = await deleteProject(projectId);

  if (!deleted) {
    return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ message: "未登录。" }, { status: 401 });
    }

    const project = await getProjectById(projectId);

    if (!project) {
      return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
    }

    if (!isProjectOwnedBy(project, userId)) {
      return NextResponse.json(
        { message: "无权访问该项目。" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Partial<ProjectRecord>;
    const {
      userId: _ownerId,
      sensitiveMarks: incomingMarks,
      ...safeBody
    } = body;

    // 状态机白名单：仅允许合法转换（同值幂等放行），非法返回 400
    if (
      safeBody.status &&
      safeBody.status !== project.status &&
      !VALID_TRANSITIONS[project.status]?.includes(safeBody.status)
    ) {
      return NextResponse.json({ message: "状态转换不合法。" }, { status: 400 });
    }

    // sensitiveMarks 不走 safeBody 透传：只合并 id / status / reviewedAt 三个字段
    let nextMarks = project.sensitiveMarks;

    if (incomingMarks !== undefined) {
      const parsed = parseMarkReviews(incomingMarks);

      if (!parsed.ok) {
        return NextResponse.json(
          { message: "敏感标记审校参数不合法。" },
          { status: 400 },
        );
      }

      nextMarks = mergeMarkReviews(project.sensitiveMarks, parsed.reviews);
    }

    // 审校门禁：进入 ready_to_export 前不允许存在待处理标记。
    // 导出路由有同一判定，两条写入路径都拦。
    if (safeBody.status === "ready_to_export") {
      const pendingCount = countPendingSensitiveMarks(nextMarks);

      if (pendingCount > 0) {
        return NextResponse.json(
          {
            message: `还有 ${pendingCount} 条敏感标记待处理，无法完成审校。`,
            pendingCount,
          },
          { status: 400 },
        );
      }
    }

    const marksPatch: Partial<ProjectRecord> =
      incomingMarks !== undefined
        ? {
            sensitiveMarks: nextMarks,
            ...rebuildRedactedTexts(project, nextMarks),
          }
        : {};

    const updated = await updateProject(projectId, {
      ...safeBody,
      ...marksPatch,
    });

    if (!updated) {
      return NextResponse.json({ message: "未找到项目。" }, { status: 404 });
    }

    return NextResponse.json({ project: updated });
  } catch {
    return NextResponse.json({ message: "更新失败，请稍后重试。" }, { status: 500 });
  }
}
