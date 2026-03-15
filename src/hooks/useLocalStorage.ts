/** Generic localStorage hook with type safety and optional encryption */

import {
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";

interface UseLocalStorageOptions<T> {
  encrypt?: boolean;
  sync?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
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
  options: UseLocalStorageOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const {
    encrypt: shouldEncrypt = false,
    sync = true,
    serialize,
    deserialize,
  } = options;

  const toStorage = useCallback(
    (value: T): string => (serialize ? serialize(value) : JSON.stringify(value)),
    [serialize]
  );

  const fromStorage = useCallback(
    (raw: string): T => {
      if (deserialize) {
        return deserialize(raw);
      }
      return JSON.parse(raw) as T;
    },
    [deserialize]
  );
  
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      
      const decrypted = shouldEncrypt ? decrypt(item) : item;
      return fromStorage(decrypted);
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, shouldEncrypt, fromStorage]);
  
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStoredValue(readValue());
    setHydrated(true);
  }, [readValue]);
  
  const setValue = useCallback((value: SetStateAction<T>) => {
    setStoredValue((prev) =>
      typeof value === "function" ? (value as (prevState: T) => T)(prev) : value
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) return;
    try {
      const serialized = toStorage(storedValue);
      const finalValue = shouldEncrypt ? encrypt(serialized) : serialized;
      window.localStorage.setItem(key, finalValue);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, shouldEncrypt, storedValue, toStorage, hydrated]);
  
  // Sync with other tabs
  useEffect(() => {
    if (!sync || typeof window === "undefined") return;
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const decrypted = shouldEncrypt ? decrypt(event.newValue) : event.newValue;
          setStoredValue(fromStorage(decrypted));
        } catch {
          // Ignore parse errors
        }
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, sync, shouldEncrypt, fromStorage]);
  
  return [storedValue, setValue, hydrated];
}

export default useLocalStorage;
