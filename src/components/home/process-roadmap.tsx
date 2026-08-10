import {
  AudioLines,
  FileOutput,
  FilePenLine,
  ScanText,
  ShieldCheck,
} from "lucide-react";

const steps = [
  {
    title: "上传受访音频",
    description: "录音文件进入本地档案袋，生成口述项目记录。",
    icon: AudioLines,
  },
  {
    title: "自动转写",
    description: "对接语音转文字 provider，输出自动转写稿。",
    icon: ScanText,
  },
  {
    title: "AI 校对与脱敏",
    description: "轻度书面化、基础校对、敏感信息标记与说明。",
    icon: ShieldCheck,
  },
  {
    title: "人工审校",
    description: "研究员修订内容，并调用 AI 进行润色、扩写、续写。",
    icon: FilePenLine,
  },
  {
    title: "导出报告",
    description: "生成可归档、可交付的 docx / txt 报告。",
    icon: FileOutput,
  },
];

export function ProcessRoadmap() {
  return (
    <section className="paper-panel rounded-[2rem] p-7 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-eyebrow">核心链路</p>
          <h2 className="font-display mt-4 text-3xl font-semibold text-accent-strong">
            上传音频之后，整个整理流程一目了然
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-muted">
          页面文案全部贴合口述历史业务术语，便于路演时直接讲清楚“上传、整理、审校、导出”的平台价值。
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="relative rounded-[1.6rem] border border-line/80 bg-white/52 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-display text-2xl text-accent-strong/50">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">
                {step.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
