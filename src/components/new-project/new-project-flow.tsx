"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  BasicInfoForm,
  type BasicInfo,
} from "@/components/new-project/basic-info-form";
import { RouteChooser } from "@/components/new-project/route-chooser";
import { OutlinePlanWorkspace } from "@/components/outline/outline-plan-workspace";
import {
  readOutlineDraftSession,
  saveOutlineDraftToSession,
} from "@/lib/outline-session";

// 步骤 key 同时是 URL 的 step 值与 #new-step-* 锚点后缀（IMPL §3.3）。
const NEW_PROJECT_STEPS = [
  { key: "basic", label: "基本信息" },
  { key: "outline", label: "提纲" },
  { key: "route", label: "选择方式" },
] as const;

type NewProjectStep = (typeof NEW_PROJECT_STEPS)[number]["key"];

// step 白名单：非法值一律回落 basic，避免被任意 query 影响渲染。
function normalizeStep(value: string | undefined): NewProjectStep {
  const matched = NEW_PROJECT_STEPS.find((item) => item.key === value);
  return matched ? matched.key : "basic";
}

const EMPTY_BASIC_INFO: BasicInfo = {
  projectName: "",
  intervieweeName: "",
  overview: "",
};

export function NewProjectFlow({ initialStep }: { initialStep?: string }) {
  const router = useRouter();
  // 初始步只取一次：之后由 state 主导，router.replace 触发的 RSC 重渲染不会把步骤弹回去。
  const [step, setStep] = useState<NewProjectStep>(() =>
    normalizeStep(initialStep),
  );
  // 基本信息只走 React state，不下沉 sessionStorage（IMPL §3.4）。
  // 刷新即丢，草稿回填归 REQ-15。
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(EMPTY_BASIC_INFO);

  const currentIndex = NEW_PROJECT_STEPS.findIndex((item) => item.key === step);

  // 只写 URL、不读 useSearchParams —— 初始步由 server 传下来，
  // 因此本组件不需要 Suspense 包裹（对比 login / upload 两页的写法）。
  // 用 replace 是为了不把每一步都压进历史栈。
  function goToStep(next: NewProjectStep) {
    setStep(next);
    router.replace(`/projects/new?step=${next}`);
  }

  // REQ-21 §5.2：基本信息不是「只活在 React state」，点下一步时写进既有草稿。
  //
  // 必须先读再 merge：saveOutlineDraftToSession 是整体覆盖（outline-session.ts:155-161
  // 从 createEmptyOutlineSession() 起重建，messages 一并清零），直写会把提纲步
  // 已生成的对话与 institutionName / collectionScenario / researchFocus 全部抹掉。
  // 本仓库禁止扩展 src/lib/**（IMPL §7.1.3），所以 merge 只能在这层做。
  function persistBasicInfo(next: BasicInfo) {
    const existing = readOutlineDraftSession();

    // 冷启动直达 /projects/new?step=outline（老书签 → 307 跳板）时 basicInfo 仍是
    // EMPTY_BASIC_INFO，无条件写入会把提纲步刚写下的三个字段清成空字符串。
    // 因此只覆盖用户真填了的字段，其余沿用草稿里的既有值。
    // 先 trim 再判空：'   ' 这种全空白等同于没填，同样不该顶掉旧值。
    const projectName = next.projectName.trim();
    const intervieweeName = next.intervieweeName.trim();
    const notes = next.overview.trim();

    saveOutlineDraftToSession(existing?.outlineMarkdown ?? "", {
      ...existing?.profile,
      ...(projectName ? { projectName } : {}),
      ...(intervieweeName ? { intervieweeName } : {}),
      // IMPL §3.3 裁决：描述信息 → notes；researchFocus 不由基本信息写入。
      ...(notes ? { notes } : {}),
    });
  }

  return (
    <main className="min-h-dvh px-1 py-1 sm:px-1.5 sm:py-1.5 xl:h-dvh xl:overflow-hidden">
      <div className="flex flex-col gap-2 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]">
        <header className="archive-frame paper-panel paper-panel-strong rounded-[1.85rem] px-4 py-4 md:px-5">
          <div className="flex items-start gap-4">
            <div className="archive-mark hidden sm:grid">
              <span />
              <span />
              <span />
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
              >
                <ArrowLeft className="h-4 w-4" />
                返回工作台
              </Link>
              <p className="section-eyebrow mt-3">新建项目</p>
              <h1 className="font-display mt-2 text-[1.6rem] font-semibold leading-tight text-accent-strong sm:text-[1.9rem]">
                新建访谈项目
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                填好基本信息，生成一版访谈提纲，再选择用 AI
                实时访谈还是上传音频。
              </p>

              {/* 步骤条纯展示、不可点：可点会绕过基本信息校验（PRD §9-2
                  「必填未过时不能进入任一分支」）。前进只能走各步自己的按钮。 */}
              <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                {NEW_PROJECT_STEPS.map(({ key, label }, index) => {
                  const isCurrent = step === key;
                  const isDone = index < currentIndex;

                  return (
                    <li key={key} className="min-w-0 sm:flex-1">
                      <div
                        aria-current={isCurrent ? "step" : undefined}
                        className={`flex w-full items-center gap-2 rounded-[1rem] border px-3 py-2 text-sm ${
                          isCurrent
                            ? "border-accent-soft bg-accent-soft/70 text-accent-strong"
                            : isDone
                              ? "border-line/80 bg-white/70 text-foreground"
                              : "border-line/60 bg-white/40 text-muted"
                        }`}
                      >
                        <span className="text-[11px] font-semibold tracking-[0.18em]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate font-semibold">{label}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </header>

        {/* 步骤体只做布局，不加 paper-panel：backdrop-filter 会成为 fixed 后代的包含块，
            而嵌入式提纲工作台底部有一条 fixed 的移动端输入条（outline-plan-workspace.tsx:916）。 */}
        <section className="flex min-w-0 flex-col xl:min-h-0">
          {step === "basic" ? (
            <div id="new-step-basic" className="min-w-0">
              <BasicInfoForm
                value={basicInfo}
                onChange={setBasicInfo}
                onNext={() => {
                  persistBasicInfo(basicInfo);
                  goToStep("outline");
                }}
              />
            </div>
          ) : null}

          {step === "outline" ? (
            <div
              id="new-step-outline"
              className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1"
            >
              {/* embedded：去掉工作台自带的整页外壳与 header，只留表单与提纲本体；
                  onContinue 取代它内部的 router.push，把「下一步」交给本容器。 */}
              <OutlinePlanWorkspace
                embedded
                initialTopic={basicInfo.projectName}
                initialSubject={basicInfo.intervieweeName}
                onContinue={() => {
                  // workspace 的「确认 / 跳过」会用提纲表单的字段整体覆盖草稿
                  // （saveOutlineDraftToSession 是重建而非 merge），这里把基本信息的
                  // 三个字段写回去；markdown 与画像其余字段保持 workspace 刚写下的值。
                  persistBasicInfo(basicInfo);
                  goToStep("route");
                }}
              />
            </div>
          ) : null}

          {step === "route" ? (
            <div id="new-step-route" className="min-w-0">
              <RouteChooser
                basicInfo={basicInfo}
                onBackToOutline={() => goToStep("outline")}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
