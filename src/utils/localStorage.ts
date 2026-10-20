// storage throws when the browser blocks it, e.g. in the Safe{Wallet} iframe
export function saveStateToLocalStorage(key: string, state: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn(`Could not save ${key} to localStorage`, e);
  }
}

export function loadStateFromLocalStorage(key: string): unknown | null {
  try {
    const storedState = localStorage.getItem(key);
    return storedState ? JSON.parse(storedState) : null;
  } catch (e) {
    console.warn(`Could not load ${key} from localStorage`, e);
    return null;
  }
}
