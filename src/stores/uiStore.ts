/** UI state management with Zustand */

import { create } from "zustand";

type ActivePanel = "chat" | "critiques" | "settings" | "files" | "overview";

interface UIStoreState {
  sidebarOpen: boolean;
  modalVisible: boolean;
  activePanel: ActivePanel;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setModalVisible: (visible: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  sidebarOpen: true,
  modalVisible: false,
  activePanel: "overview",

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setModalVisible: (modalVisible) => set({ modalVisible }),
  setActivePanel: (activePanel) => set({ activePanel }),
  openModal: () => set({ modalVisible: true }),
  closeModal: () => set({ modalVisible: false }),
}));

// Selectors
export const selectSidebarOpen = (state: UIStoreState) => state.sidebarOpen;
export const selectModalVisible = (state: UIStoreState) => state.modalVisible;
export const selectActivePanel = (state: UIStoreState) => state.activePanel;
