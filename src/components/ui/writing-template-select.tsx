import type { WritingTemplateKey } from "@/lib/types/project";
import {
  OUTLINE_WRITING_TEMPLATES,
  WRITING_TEMPLATE_KEYS,
} from "@/lib/writing-rules";

/**
 * REQ-33：写作模板选择控件（两个建项入口共用一份，避免选项清单出现第二份）。
 *
 * - 选项来源唯一：OUTLINE_WRITING_TEMPLATES（writing-rules.ts:35-105）/ WRITING_TEMPLATE_KEYS（:257-260）。
 *   顺序 = 常量声明顺序（援藏 → 地方史志 → 企业发展史 → 人物传记 → 家族回忆录 → 通用）。
 * - 空串 = 「系统自动匹配（推荐）」⇒ 调用方**不发送** writingTemplateKey ⇒ 服务端按采集场景
 *   （custom 走关键词 + 兜底 general）派生，与 REQ-33 之前逐字等价
 *   （API 对缺省 / 空串都按缺省处理：route.ts:135-150）。
 * - 章数写进选项文本、章标题进 title：不额外占高度，也不复制模板字面（逐字照抄由 writing-rules 负责）。
 */
export type WritingTemplateSelection = WritingTemplateKey | "";

type WritingTemplateSelectProps = {
  id: string;
  value: WritingTemplateSelection;
  onChange: (next: WritingTemplateSelection) => void;
  /** true：外包一层 surface-card（AI 提纲步，悬在工作台之上）；false：裸字段（上传第 3 步）。
   *  shrink-0：宿主 `#new-step-outline` 是 flex 纵列且工作台 flex-1 —— 不写 shrink 时
   *  视口偏矮会把这一条压扁（select 变 40px 高），AC-11 的 1280×800 档就会抖。 */
  framed?: boolean;
};

export const NO_WRITING_TEMPLATE_LABEL = "系统自动匹配（推荐）";

export function WritingTemplateSelect({
  id,
  value,
  onChange,
  framed = false,
}: WritingTemplateSelectProps) {
  return (
    <div
      className={
        framed
          ? "paper-panel paper-panel-strong mb-2 shrink-0 rounded-[1.55rem] p-4"
          : undefined
      }
    >
      <label className="field-label" htmlFor={id}>
        写作模板
      </label>
      <select
        id={id}
        className="text-field"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as WritingTemplateSelection)
        }
      >
        <option value="">{NO_WRITING_TEMPLATE_LABEL}</option>
        {WRITING_TEMPLATE_KEYS.map((key) => {
          const template = OUTLINE_WRITING_TEMPLATES[key];

          return (
            <option key={key} value={key} title={template.chapters.join(" / ")}>
              {`${template.name}（${template.chapters.length} 章）`}
            </option>
          );
        })}
      </select>
    </div>
  );
}
