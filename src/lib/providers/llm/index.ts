import { ArkLlmProvider } from "@/lib/providers/llm/ark-llm-provider";
import { MockLlmProvider } from "@/lib/providers/llm/mock-llm-provider";
import type { LlmProvider } from "@/lib/providers/llm/types";

export function getLlmProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER?.trim() || "mock";

  switch (provider) {
    case "ark":
      if (process.env.LLM_API_KEY?.trim()) {
        return new ArkLlmProvider();
      }
      return new MockLlmProvider();
    case "mock":
    default:
      return new MockLlmProvider();
  }
}