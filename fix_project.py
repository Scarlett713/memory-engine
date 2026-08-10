import re

file_path = "src/lib/types/project.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_function = 'export function createInitialWorkflow(): WorkflowStep[] {\n  return [\n    {\n      key: "upload",\n      label: "\u4e0a\u4f20\u53d7\u8bbf\u97f3\u9891",\n      description: "\u53d7\u8bbf\u97f3\u9891\u5df2\u4e0a\u4f20\u5f52\u6863\uff0c\u7cfb\u7edf\u51c6\u5907\u8fdb\u5165\u81ea\u52a8\u6574\u7406\u6d41\u7a0b\u3002",\n      status: "completed",\n    },\n    {\n      key: "transcription",\n      label: "\u9ad8\u7cbe\u5ea6\u8bed\u97f3\u8f6c\u5199",\n      description: "\u8c03\u7528\u8bed\u97f3\u8bc6\u522b\u670d\u52a1\uff0c\u8f93\u51fa\u53ef\u56de\u6eaf\u7684\u5206\u6bb5\u8f6c\u5199\u7ed3\u679c\u3002",\n      status: "pending",\n    },\n    {\n      key: "ai_refine",\n      label: "\u7ed3\u6784\u5316\u6574\u7406\u4e0e\u8131\u654f",\n      description: "\u5b8c\u6210\u6458\u8981\u3001\u7ed3\u6784\u5316\u6574\u7406\u3001\u60c5\u7eea\u8bc6\u522b\u4e0e\u9690\u79c1\u8131\u654f\u3002",\n      status: "pending",\n    },\n    {\n      key: "manual_review",\n      label: "\u4eba\u5de5\u5ba1\u6821",\n      description: "\u7814\u7a76\u5458\u8fdb\u884c\u590d\u6838\uff0c\u5e76\u51b3\u5b9a\u662f\u5426\u8fdb\u5165\u6210\u679c\u5bfc\u51fa\u3002",\n      status: "pending",\n    },\n    {\n      key: "export",\n      label: "\u6863\u6848\u7ea7\u6210\u679c\u5bfc\u51fa",\n      description: "\u751f\u6210\u53ef\u5f52\u6863\u7684 docx\u3001txt \u548c\u7ed3\u6784\u5316 JSON \u6210\u679c\u3002",\n      status: "pending",\n    },\n  ];\n}'

old_pattern = r'export function createInitialWorkflow\(\): WorkflowStep\[\] \{.*?\n\}'
result = re.sub(old_pattern, new_function, content, flags=re.DOTALL)

if result == content:
    print("WARNING: pattern not matched")
else:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(result)
    print("OK: fixed")