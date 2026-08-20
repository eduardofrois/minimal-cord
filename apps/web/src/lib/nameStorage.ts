const DISPLAY_NAME_KEY = 'minimal-cord.displayName';

export function readDisplayName(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
}

export function saveDisplayName(displayName: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DISPLAY_NAME_KEY, displayName.trim());
}
