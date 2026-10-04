import { NewProjectFlow } from "@/components/new-project/new-project-flow";

// REQ-21 三步流程（基本信息 → 提纲〔可跳过〕 → 分流）的路由入口。
// 保持 server component：searchParams 在 Next 16 是 Promise，须 await；
// step 的白名单校验放在 NewProjectFlow（非法值回落 "basic"）。
// 不做认证判断 —— src/proxy.ts 的 matcher 已覆盖 /projects/new，未登录先被 307 到 /login。
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  return <NewProjectFlow initialStep={step ?? "basic"} />;
}
