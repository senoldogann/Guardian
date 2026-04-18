/** Workspace state management with Zustand */

import { create } from "zustand";

interface WorkspaceStoreState {
  workspacePath: string | null;
  isMonitoring: boolean;
  activeProject: string | null;

  setWorkspacePath: (path: string | null) => void;
  setMonitoring: (monitoring: boolean) => void;
  setActiveProject: (project: string | null) => void;
  openWorkspace: (path: string) => void;
  closeWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspacePath: null,
  isMonitoring: false,
  activeProject: null,

  setWorkspacePath: (workspacePath) => set({ workspacePath }),
  setMonitoring: (isMonitoring) => set({ isMonitoring }),
  setActiveProject: (activeProject) => set({ activeProject }),

  openWorkspace: (path) =>
    set({ workspacePath: path, isMonitoring: false, activeProject: null }),

  closeWorkspace: () =>
    set({ workspacePath: null, isMonitoring: false, activeProject: null }),
}));

// Selectors
export const selectWorkspacePath = (state: WorkspaceStoreState) => state.workspacePath;
export const selectIsMonitoring = (state: WorkspaceStoreState) => state.isMonitoring;
export const selectActiveProject = (state: WorkspaceStoreState) => state.activeProject;
export const selectHasWorkspace = (state: WorkspaceStoreState) => state.workspacePath !== null;
