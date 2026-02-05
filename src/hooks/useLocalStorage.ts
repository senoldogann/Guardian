/** Generic localStorage hook with type safety and optional encryption */

import { useState, useEffect, useCallback } from "react";

interface UseLocalStorageOptions {
  encrypt?: boolean;
  sync?: boolean;
}

function encrypt(value: string): string {
  // Simple base64 encoding for basic obfuscation
  // In production, use proper encryption
  return btoa(value);
}

function decrypt(value: string): string {
  try {
    return atob(value);
  } catch {
    return value;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = {}
): [T, (value: T) => void] {
  const { encrypt: shouldEncrypt = false, sync = true } = options;
  
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      
      const decrypted = shouldEncrypt ? decrypt(item) : item;
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, shouldEncrypt]);
  
  const [storedValue, setStoredValue] = useState<T>(readValue);
  
  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value);
      
      if (typeof window !== "undefined") {
        const serialized = JSON.stringify(value);
        const finalValue = shouldEncrypt ? encrypt(serialized) : serialized;
        window.localStorage.setItem(key, finalValue);
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, shouldEncrypt]);
  
  // Sync with other tabs
  useEffect(() => {
    if (!sync || typeof window === "undefined") return;
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const decrypted = shouldEncrypt ? decrypt(event.newValue) : event.newValue;
          setStoredValue(JSON.parse(decrypted) as T);
        } catch {
          // Ignore parse errors
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, sync, shouldEncrypt]);
  
  return [storedValue, setValue];
}

export default useLocalStorage;
