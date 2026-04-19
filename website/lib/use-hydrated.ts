"use client";

import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => { };
const getSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function useHydrated(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}