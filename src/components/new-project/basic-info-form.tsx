"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// 与服务端 NOTES_MAX_LENGTH 对齐（/api/outline/generate、/api/projects）。
const OVERVIEW_MAX_LENGTH = 1000;

/**
 * 三步流程「基本信息」的载荷（REQ-21 §4.2）。
 * 三项均必填（overview 自任老师反馈批次 1 起改为必填的「详细介绍」）。
 * 本类型定义在表单侧，流程容器与分流步都从这里取，避免三处各写一份。
 */
export type BasicInfo = {
  projectName: string;
  intervieweeName: string;
  overview: string;
};

type BasicInfoFormProps = {
  value: BasicInfo;
  onChange: (next: BasicInfo) => void;
  onNext: () => void;
};

export function BasicInfoForm({ value, onChange, onNext }: BasicInfoFormProps) {
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 前端校验即可，不发网络请求（PRD §9-2：必填未过时不能进入任一分支）。
    event.preventDefault();

    if (
      !value.projectName.trim() ||
      !value.intervieweeName.trim() ||
      !value.overview.trim()
    ) {
      setError("请先填写访谈主题、受访对象与详细介绍。");
      return;
    }

    setError("");
    onNext();
  }

  return (
    <form
      // noValidate：让下面这条中文错误条成为唯一的提示来源，
      // 否则浏览器原生气泡会先拦住 submit，错误条永远不显示。
      noValidate
      onSubmit={handleSubmit}
      className="archive-frame paper-panel paper-panel-strong flex flex-col gap-5 rounded-[1.85rem] p-4 md:p-5"
    >
      <div>
        <h2 className="font-display text-[1.35rem] font-semibold text-accent-strong">
          基本信息
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <label className="field-label" htmlFor="projectName">
            访谈主题
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="projectName"
            className="text-field"
            value={value.projectName}
            required
            onChange={(event) =>
              onChange({ ...value, projectName: event.target.value })
            }
            placeholder="例如：上海老城厢的市井记忆"
          />
        </div>

        <div className="xl:col-span-2">
          <label className="field-label" htmlFor="intervieweeName">
            受访对象
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="intervieweeName"
            className="text-field"
            value={value.intervieweeName}
            required
            onChange={(event) =>
              onChange({ ...value, intervieweeName: event.target.value })
            }
            placeholder="例如：受访者姓名"
          />
        </div>

        <div className="xl:col-span-2">
          <label className="field-label" htmlFor="overview">
            详细介绍
            <span className="ml-1 text-red-500">*</span>
          </label>
          <textarea
            id="overview"
            className="text-area min-h-[7rem]"
            value={value.overview}
            maxLength={OVERVIEW_MAX_LENGTH}
            onChange={(event) =>
              onChange({ ...value, overview: event.target.value })
            }
            placeholder="您可补充说明需要记录的相关事件、人物信息、时间线索等内容，以便我们向您提供个性化访谈提纲"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.4rem] border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-7 text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
        {/* data-* 锚点面向回归脚本，比中文文案耐改（IMPL §3.3）。 */}
        <Button
          type="submit"
          data-step-next="outline"
          className="w-full justify-center sm:w-auto"
        >
          下一步：生成提纲
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
