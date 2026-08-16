'use client';

/**
 * Hive Frontend Universe - lazy avatar loading.
 *
 * Real profile photos for post authors, dApp landmarks and communities,
 * fetched through the app's OWN avatar proxy route (`getUserAvatarUrl`, the
 * same pipeline the whole site uses) at the SMALL size, because this runs on
 * modest hardware.
 *
 * Contract:
 *   - `requestAvatar(handle)` is cheap and idempotent; callers fire it when
 *     the player gets near. Nothing ever blocks on it.
 *   - at most MAX_CONCURRENT images load at once; the rest queue.
 *   - `avatarImage(handle)` returns the decoded image or null. A failed load
 *     stays null forever (the drawn placeholder simply remains).
 */

import { getUserAvatarUrl } from '@ui/lib/avatar-utils';

const MAX_CONCURRENT = 4;

type AvatarStatus = 'queued' | 'loading' | 'ready' | 'failed';

interface Entry {
  status: AvatarStatus;
  img: HTMLImageElement | null;
}

const entries = new Map<string, Entry>();
const queue: string[] = [];
let inFlight = 0;

function pump(): void {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const handle = queue.shift() as string;
    const entry = entries.get(handle);
    if (!entry || entry.status !== 'queued') continue;
    entry.status = 'loading';
    inFlight++;
    const img = new Image();
    // Same-origin proxy in the app (no-op there); keeps the canvas untainted
    // if an avatar is ever served from a CORS-enabled CDN instead.
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      entry.status = 'ready';
      entry.img = img;
      inFlight--;
      pump();
    };
    img.onerror = () => {
      entry.status = 'failed';
      inFlight--;
      pump();
    };
    img.src = getUserAvatarUrl(handle, 'small');
  }
}

/** Queue a handle's avatar; safe to call every frame. */
export function requestAvatar(handle: string): void {
  if (!handle || entries.has(handle)) return;
  entries.set(handle, { status: 'queued', img: null });
  queue.push(handle);
  pump();
}

/** The decoded avatar, or null (not requested / still loading / failed). */
export function avatarImage(handle: string): HTMLImageElement | null {
  const e = entries.get(handle);
  return e && e.status === 'ready' ? e.img : null;
}

/** Loader stats for the debug handle; measured, not guessed. */
export function avatarStats(): { ready: number; failed: number; pending: number } {
  let ready = 0;
  let failed = 0;
  let pending = 0;
  for (const e of entries.values()) {
    if (e.status === 'ready') ready++;
    else if (e.status === 'failed') failed++;
    else pending++;
  }
  return { ready, failed, pending };
}
