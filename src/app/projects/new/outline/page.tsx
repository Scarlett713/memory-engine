import { redirect } from "next/navigation";

// REQ-16 §5.2 裁决（2026-10-05）：提纲已成为新建流程内的一步（可跳过），
// 本路由仅用于兼容旧书签与旧链接，不做独立渲染。
// 必须保持 server component：redirect() 在 RSC 渲染期返回 307，属服务端重定向。
export default function LegacyOutlinePage() {
  redirect("/projects/new?step=outline");
}
