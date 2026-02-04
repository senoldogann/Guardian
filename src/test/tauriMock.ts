type Listener<T> = (event: { payload: T }) => void;

const listeners = new Map<string, Set<Listener<any>>>();

export const emitTauriEvent = <T>(eventName: string, payload: T) => {
  const set = listeners.get(eventName);
  if (!set) return;
  set.forEach((handler) => handler({ payload }));
};

export const clearTauriListeners = () => {
  listeners.clear();
};

export const listen = async <T>(eventName: string, handler: Listener<T>) => {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName)!.add(handler as Listener<any>);
  return () => {
    listeners.get(eventName)?.delete(handler as Listener<any>);
  };
};
