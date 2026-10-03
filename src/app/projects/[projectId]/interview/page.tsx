import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { InterviewConsole } from "@/components/interview/interview-console";
import {
  getProjectById,
  isProjectOwnedBy,
} from "@/lib/server/project-store";

type InterviewPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { projectId } = await params;
  const userId = (await headers()).get("x-user-id") ?? "";
  const project = await getProjectById(projectId);

  if (!project || !isProjectOwnedBy(project, userId)) {
    notFound();
  }

  // D5=B：无提纲不得进入访谈。目标路由由后续步骤补，本轮先按约定 URL 跳。
  if (!project.outlineDraftMarkdown.trim()) {
    redirect(`/projects/${projectId}/outline`);
  }

  return <InterviewConsole project={project} />;
}
