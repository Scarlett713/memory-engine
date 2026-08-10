import type {
  TranscriptionInput,
  TranscriptionProvider,
} from "@/lib/providers/transcription/types";

export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: TranscriptionInput) {
    return {
      provider: "mock",
      sourceUrl: input.sourceUrl,
      text: [
        `访谈音频：${input.fileName}`,
        "",
        "受访者提到，自己年轻时住在老城厢，后来一家人搬到了新式里弄。",
        "她回忆起石库门、菜场、夏天乘凉和邻里往来，这些生活细节构成了城市记忆的重要线索。",
        "谈到搬迁那段时间时，她语速明显变慢，提到母亲在搬家前后情绪波动很大，自己也曾因为告别旧邻居而难过。",
      ].join("\n"),
      segments: [
        {
          id: "seg-1",
          startMs: 0,
          endMs: 14000,
          speaker: "受访者",
          text: "我年轻时候住在老城厢，后来一家人搬到了新式里弄。",
          confidence: 0.98,
        },
        {
          id: "seg-2",
          startMs: 14000,
          endMs: 29000,
          speaker: "受访者",
          text: "我记得石库门、菜场，还有夏天晚上大家在门口乘凉，那时候邻里都很熟。",
          confidence: 0.97,
        },
        {
          id: "seg-3",
          startMs: 29000,
          endMs: 46000,
          speaker: "受访者",
          text: "后来要搬家，我母亲很舍不得，我自己也因为跟老邻居分开，心里一直很难过。",
          confidence: 0.96,
        },
      ],
    };
  }
}
