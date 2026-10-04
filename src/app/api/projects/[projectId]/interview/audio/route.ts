import { NextResponse } from "next/server";

import {
  getProjectById,
  isProjectOwnedBy,
  updateProject,
} from "@/lib/server/project-store";
import {
  saveInterviewAudio,
  type SavedInterviewAudio,
} from "@/lib/server/upload-store";
import type { WorkflowStep } from "@/lib/types/project";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

/**
 * AI 访谈录音归档。
 *
 * 本路由只做三件事：把 Blob 落盘、回填音频字段、把 workflow 的 upload 步翻成
 * completed。**不跑 processProject**——转写要几十秒，放在这里会让前端的
 * 「正在上传录音…」一直挂着，超时也无法重试。归档完成后前端跳
 * `/projects/{id}?autostart=1`，由既有的 /process 路由 + 处理台自带的 busy/失败
 * 提示接手，那条路已经有重试入口。
 *
 * 与 process-project.ts 的 updateWorkflow 同形，但不能复用它（模块私有），
 * route 之间也不互相 import。只翻 status、不写 description：normalizeWorkflowCopy
 * 每次读取都会把 label/description 归一化回 createInitialWorkflow 的原文，写了也是死写。
 */
function markUploadCompleted(workflow: WorkflowStep[]) {
  return workflow.map((step) =>
    step.key === "upload" ? { ...step, status: "completed" as const } : step,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  try {
    // 鉴权由 src/proxy.ts 完成：它校验 cookie 并注入 x-user-id。
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

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { message: "请求格式不正确。" },
        { status: 400 },
      );
    }

    const audio = formData.get("audio");

    // formData.get 缺失时返回 null；同名字段出现多次时返回数组，一并挡掉。
    if (!(audio instanceof File)) {
      return NextResponse.json(
        { message: "未收到录音文件。" },
        { status: 400 },
      );
    }

    let saved: SavedInterviewAudio;

    try {
      // 复用既有实现：它已含空文件 / >100MB / 音频格式三道校验，
      // 并按 LOCAL_STORAGE_DIR 建目录（ensureStorageLayout）。
      saved = await saveInterviewAudio(audio);
    } catch (error) {
      // 这里的 throw 全是入参校验（空文件 / 超限 / 非音频格式），回 400 让前端
      // 能把原话显示给用户。已知取舍：writeFile 失败（磁盘满 / 无权限）也会落到
      // 这里被当成 400，区分它需要改 upload-store.ts，而那是本批不动的文件。
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "录音文件校验未通过。",
        },
        { status: 400 },
      );
    }

    // 保持 status: "uploaded"：处理台 autostart 的硬前提是
    // status === "uploaded" 且 transcriptRaw 为空，这里两个都不碰。
    // collectionPath 在 ai-interview 建项目时已是 "ai_interview"，不回写。
    const updated = await updateProject(projectId, (current) => ({
      audioFileName: saved.fileName,
      audioStoragePath: saved.relativePath,
      audioMimeType: saved.mimeType,
      audioSize: saved.size,
      workflow: markUploadCompleted(current.workflow),
    }));

    if (!updated) {
      return NextResponse.json(
        { message: "录音归档失败，请稍后重试。" },
        { status: 500 },
      );
    }

    return NextResponse.json({ project: updated });
  } catch {
    // 不回显内部 error.message，避免泄漏路径与堆栈。
    return NextResponse.json(
      { message: "录音上传失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
