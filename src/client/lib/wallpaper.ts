import { writable, get } from 'svelte/store';

export interface Wallpaper {
  /** Data URL (data:image/...;base64,...) or empty for none. */
  dataUrl: string;
  /** 0..1 — overlay darkness on top of the image. */
  dim: number;
  /** Pixels of blur applied to the image. */
  blur: number;
}

const STORAGE_KEY = 'mob:wallpaper';

const DEFAULT: Wallpaper = { dataUrl: '', dim: 0.35, blur: 0 };

function load(): Wallpaper {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      dataUrl: typeof parsed.dataUrl === 'string' ? parsed.dataUrl : '',
      dim: typeof parsed.dim === 'number' ? parsed.dim : DEFAULT.dim,
      blur: typeof parsed.blur === 'number' ? parsed.blur : DEFAULT.blur,
    };
  } catch {
    return DEFAULT;
  }
}

export const wallpaper = writable<Wallpaper>(load());

wallpaper.subscribe((w) => {
  try {
    if (!w.dataUrl) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch { /* quota etc — ignore */ }
  applyToDom(w);
});

function applyToDom(w: Wallpaper): void {
  const root = document.documentElement;
  if (w.dataUrl) {
    root.style.setProperty('--wallpaper-image', `url("${w.dataUrl}")`);
    root.style.setProperty('--wallpaper-dim', String(w.dim));
    root.style.setProperty('--wallpaper-blur', `${w.blur}px`);
    root.classList.add('has-wallpaper');
  } else {
    root.style.removeProperty('--wallpaper-image');
    root.style.removeProperty('--wallpaper-dim');
    root.style.removeProperty('--wallpaper-blur');
    root.classList.remove('has-wallpaper');
  }
}

/** Read a File as a data URL. Caller is expected to validate type/size. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const MAX_WALLPAPER_BYTES = 8 * 1024 * 1024; // 8 MB

export async function setWallpaperFromFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > MAX_WALLPAPER_BYTES) throw new Error('Image is too large (max 8 MB)');
  const dataUrl = await fileToDataUrl(file);
  wallpaper.update((w) => ({ ...w, dataUrl }));
}

export function clearWallpaper(): void {
  wallpaper.update((w) => ({ ...w, dataUrl: '' }));
}

export function updateWallpaper(patch: Partial<Wallpaper>): void {
  wallpaper.update((w) => ({ ...w, ...patch }));
}

// Apply once at import time so reload restores the wallpaper before any paint.
applyToDom(get(wallpaper));
