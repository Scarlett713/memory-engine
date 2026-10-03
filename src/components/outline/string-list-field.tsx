"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type StringListFieldProps = {
  id: string;
  label: string;
  values: string[];
  placeholder: string;
  addLabel: string;
  onChange: (next: string[]) => void;
};

// 可增删的字符串行编辑器。仓库里原本没有这类控件，事件/时间节点是第一个用到的场景。
export function StringListField({
  id,
  label,
  values,
  placeholder,
  addLabel,
  onChange,
}: StringListFieldProps) {
  return (
    <div>
      <span className="field-label">{label}</span>

      <div className="flex flex-col gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              id={`${id}-${index}`}
              className="text-field"
              value={value}
              placeholder={placeholder}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={`删除第 ${index + 1} 条${label}`}
              className="min-h-[3.4rem] shrink-0 px-3"
              onClick={() =>
                onChange(
                  values.length === 1
                    ? [""]
                    : values.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => onChange([...values, ""])}
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
