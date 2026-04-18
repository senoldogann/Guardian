/** Auth state management with Zustand */

import { create } from "zustand";
import type { AuthState, GithubUser } from "../types";

interface AuthStoreState {
  user: GithubUser | null;
  authState: AuthState;

  setUser: (user: GithubUser | null) => void;
  setAuthState: (state: AuthState) => void;
  login: (user: GithubUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  authState: "signed_out",

  setUser: (user) => set({ user }),
  setAuthState: (authState) => set({ authState }),

  login: (user) =>
    set({ user, authState: "signed_in_verified" }),

  logout: () =>
    set({ user: null, authState: "signed_out" }),
}));

// Selectors
export const selectIsLoggedIn = (state: AuthStoreState) =>
  state.authState === "signed_in_verified" || state.authState === "signed_in_offline";
export const selectUser = (state: AuthStoreState) => state.user;
export const selectAuthState = (state: AuthStoreState) => state.authState;
