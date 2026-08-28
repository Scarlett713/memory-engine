import { FolderOpen, ShieldCheck, Tags, Workflow } from "lucide-react";

import { ProjectExportPanel } from "@/components/projects/project-export-panel";
import { MarkdownSheet } from "@/components/ui/markdown-sheet";
import {
  getInterviewScenarioDisplayLabel,
  getPrivacyLevelLabel,
  getRedactionRuleLabel,
} from "@/lib/oral-history";
import type { ProjectRecord } from "@/lib/types/project";
import { formatBytes, formatDateTime } from "@/lib/utils";

type ProjectOverviewPanelProps = {
  project: ProjectRecord;
};

export function ProjectOverviewPanel({ project }: ProjectOverviewPanelProps) {
  const completedSteps = project.workflow.filter(
    (item) => item.status === "completed",
  ).length;

  return (
    <section className="paper-panel h-full min-h-0 rounded-[1.85rem] p-4 md:p-5">
      <div>
        <p className="section-eyebrow">项目档案</p>
        <h2 className="font-display mt-2 text-[1.7rem] font-semibold text-accent-strong md:text-[2rem]">
          档案侧栏
        </h2>
      </div>

      <div className="soft-scroll mt-5 h-[calc(100%-4.4rem)] overflow-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="surface-card rounded-[1.3rem] px-4 py-4">
            <span className="section-eyebrow">完成步骤</span>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Workflow className="h-5 w-5 text-accent-strong" />
              {completedSteps} / {project.workflow.length}
            </p>
          </div>
          <div className="surface-card rounded-[1.3rem] px-4 py-4">
            <span className="section-eyebrow">敏感标记</span>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-accent-strong" />
              {project.sensitiveMarks.length}
            </p>
          </div>
          <div className="surface-card rounded-[1.3rem] px-4 py-4">
            <span className="section-eyebrow">主题关键词</span>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Tags className="h-5 w-5 text-accent-strong" />
              {project.keywords.length}
            </p>
          </div>
          <div className="surface-card rounded-[1.3rem] px-4 py-4">
            <span className="section-eyebrow">音频大小</span>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <FolderOpen className="h-5 w-5 text-accent-strong" />
              {formatBytes(project.audioSize)}
            </p>
          </div>
        </div>

        <div className="surface-card mt-4 rounded-[1.5rem] p-5">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-accent-strong" />
            <h3 className="text-base font-semibold text-foreground">基础信息</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm leading-6 text-muted">
            <div>
              <dt className="font-medium text-foreground">整理机构</dt>
              <dd>{project.institutionName || "未填写"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">口述场景</dt>
              <dd>
                {getInterviewScenarioDisplayLabel(
                  project.collectionScenario,
                  project.customScenarioLabel,
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">研究焦点</dt>
              <dd>{project.researchFocus || "未填写"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">脱敏级别</dt>
              <dd>{getPrivacyLevelLabel(project.privacyLevel)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">脱敏规则</dt>
              <dd>
                {project.customRedactionRules.map(getRedactionRuleLabel).join("、") ||
                  "未设置"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">转写 Provider</dt>
              <dd>{project.transcriptionProvider || "待处理"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">整理 Provider</dt>
              <dd>{project.llmProvider || "待处理"}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">最近更新时间</dt>
              <dd>{formatDateTime(project.updatedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">项目说明</dt>
              <dd>{project.notes || "暂无说明"}</dd>
            </div>
          </dl>
        </div>

        <div className="surface-card mt-4 rounded-[1.5rem] p-5">
          <div>
            <p className="section-eyebrow">采集辅助</p>
            <h3 className="mt-1.5 text-base font-semibold text-foreground">
              智能提纲与现场提示
            </h3>
          </div>

          <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
            <div>
              <p className="font-medium text-foreground">访谈提纲</p>
              <div className="mt-2 space-y-2">
                {project.collectionPlan.outline.map((item, index) => (
                  <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-foreground">现场提示</p>
              <div className="mt-2 space-y-2">
                {project.collectionPlan.livePrompts.map((item, index) => (
                  <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-foreground">情绪安全建议</p>
              <div className="mt-2 space-y-2">
                {project.collectionPlan.safetyTips.map((item, index) => (
                  <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {project.outlineDraftMarkdown.trim() ? (
          <div className="surface-card mt-4 rounded-[1.5rem] p-5">
            <div>
              <p className="section-eyebrow">访谈提纲</p>
              <h3 className="mt-1.5 text-base font-semibold text-foreground">
                前置聊天生成草稿
              </h3>
            </div>

            <div className="soft-scroll mt-4 max-h-[320px] overflow-auto rounded-[1.1rem] border border-line/60 bg-white/60 p-4">
              <MarkdownSheet markdown={project.outlineDraftMarkdown} />
            </div>
          </div>
        ) : null}

        {project.status !== "ready_to_export" && (
          <ProjectExportPanel project={project} />
        )}
      </div>
    </section>
  );
}
