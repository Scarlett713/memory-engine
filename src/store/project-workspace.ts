"use client";

import { create } from "zustand";

import type {
  InterviewScenario,
  PrivacyLevel,
  ProjectRecord,
  RedactionRule,
} from "@/lib/types/project";

type CreateProjectPayload = {
  projectName: string;
  institutionName: string;
  intervieweeName: string;
  customScenarioLabel: string;
  notes: string;
  outlineDraftMarkdown: string;
  audioFile: File;
  collectionScenario: InterviewScenario;
  researchFocus: string;
  privacyLevel: PrivacyLevel;
  customRedactionRules: RedactionRule[];
};

type ProjectWorkspaceState = {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (payload: CreateProjectPayload) => Promise<ProjectRecord>;
  deleteProject: (projectId: string) => Promise<void>;
  setActiveProjectId: (projectId: string | null) => void;
};

export const useProjectWorkspaceStore = create<ProjectWorkspaceState>(
  (set) => ({
    projects: [],
    activeProjectId: null,
    isLoading: false,
    isSubmitting: false,
    error: null,
    async fetchProjects() {
      set({ error: null, isLoading: true });

      try {
        const response = await fetch("/api/projects", {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await response.json()) as {
          message?: string;
          projects?: ProjectRecord[];
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "读取项目列表失败。");
        }

        set({
          error: null,
          isLoading: false,
          projects: payload.projects ?? [],
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "读取项目列表失败。",
          isLoading: false,
        });
      }
    },
    async createProject(payload) {
      set({ error: null, isSubmitting: true });

      const formData = new FormData();
      formData.set("projectName", payload.projectName);
      formData.set("institutionName", payload.institutionName);
      formData.set("intervieweeName", payload.intervieweeName);
      formData.set("customScenarioLabel", payload.customScenarioLabel);
      formData.set("notes", payload.notes);
      formData.set("outlineDraftMarkdown", payload.outlineDraftMarkdown);
      formData.set("collectionScenario", payload.collectionScenario);
      formData.set("researchFocus", payload.researchFocus);
      formData.set("privacyLevel", payload.privacyLevel);
      formData.set(
        "customRedactionRules",
        JSON.stringify(payload.customRedactionRules),
      );
      formData.set("audio", payload.audioFile);

      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const result = (await response.json()) as {
          message?: string;
          project?: ProjectRecord;
        };

        if (!response.ok || !result.project) {
          throw new Error(result.message ?? "上传失败。");
        }

        set((state) => ({
          activeProjectId: result.project?.id ?? null,
          error: null,
          isSubmitting: false,
          projects: [result.project!, ...state.projects],
        }));

        return result.project;
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "上传失败。",
          isSubmitting: false,
        });

        throw error;
      }
    },
    async deleteProject(projectId) {
      set({ error: null });

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "删除项目失败。");
      }

      set((state) => ({
        activeProjectId:
          state.activeProjectId === projectId ? null : state.activeProjectId,
        projects: state.projects.filter((project) => project.id !== projectId),
      }));
    },
    setActiveProjectId(projectId) {
      set({
        activeProjectId: projectId,
      });
    },
  }),
);
