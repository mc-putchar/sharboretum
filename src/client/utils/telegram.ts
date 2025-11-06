// src/client/utils/telegram.ts
// Minimal Telegram WebApp integration helpers and typings for the Sharboretum Mini App.

export type TelegramUser = {
  id: number | null;
  firstName?: string;
  lastName?: string;
  username?: string;
};

export interface TelegramWebApp {
  ready: () => void;
  // UI helpers
  showPopup?: (params: { title?: string; message: string; buttons?: Array<{ id: string; type?: 'default' | 'ok' | 'close'; text: string }> }, callback?: (buttonId: string) => void) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  showConfirm?: (message: string, callback?: (ok: boolean) => void) => void;
  // Link openers
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  // Data share to bot
  sendData?: (data: string) => void;
  // Initialization data (unsafe variant used client-side)
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    // other fields (chat, hash, etc.) can be added if needed
  };
  // Optional haptic feedback
  HapticFeedback?: {
    impactOccurred?: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type?: 'error' | 'success' | 'warning') => void;
    selectionChanged?: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
    // Optional app-level configuration overrides
    __MINI_APP_LINK__?: string;
    __SharborNames__?: Record<string, string>; // Map TON address -> Friend display name
  }
}

/**
 * Get the Telegram WebApp instance if available.
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  return window?.Telegram?.WebApp ?? null;
}

/**
 * Ensure Telegram WebApp is marked ready (safe no-op if not present).
 */
export function ensureWebAppReady(): void {
  const wa = getTelegramWebApp();
  try {
    wa?.ready?.();
  } catch {
    // ignore
  }
}

/**
 * Read current Telegram user info from initDataUnsafe (if available).
 */
export function getTelegramUser(): TelegramUser {
  const wa = getTelegramWebApp();
  const user = wa?.initDataUnsafe?.user;
  return {
    id: user?.id ?? null,
    firstName: user?.first_name,
    lastName: user?.last_name,
    username: user?.username,
  };
}

/**
 * Show a popup/alert message using Telegram WebApp UI, with graceful fallback.
 */
export function showPopup(message: string, title?: string): void {
  const wa = getTelegramWebApp();
  if (wa?.showPopup) {
    wa.showPopup({ title, message, buttons: [{ id: 'ok', text: 'OK', type: 'ok' }] });
    return;
  }
  if (wa?.showAlert) {
    wa.showAlert(message);
    return;
  }
  // Fallback for non-Telegram environments
  // eslint-disable-next-line no-alert
  alert(message);
}

/**
 * Open Telegram sharing interface with a prefilled message.
 * Uses openTelegramLink/openLink if available, else falls back to window.open.
 *
 * The message should be URL-encoded safely; this function will encode it.
 */
export function openShare(prefilledMessage: string, link?: string): void {
  ensureWebAppReady();
  const wa = getTelegramWebApp();

  const text = encodeURIComponent(prefilledMessage);
  const urlParam = link ? `&url=${encodeURIComponent(link)}` : '';
  // Official share URL handler supported by Telegram clients
  const shareUrl = `https://t.me/share/url?text=${text}${urlParam}`;

  if (wa?.openTelegramLink) {
    wa.openTelegramLink(shareUrl);
    return;
  }
  if (wa?.openLink) {
    wa.openLink(shareUrl);
    return;
  }
  window.open(shareUrl, '_blank');
}

/**
 * Helper to lookup a friend's display name by TON address from a global registry, or fallback to truncated address.
 */
export function resolveFriendDisplay(friendTonAddress: string): string {
  const map = window.__SharborNames__;
  if (map && map[friendTonAddress]) return map[friendTonAddress];
  return truncateAddress(friendTonAddress);
}

/**
 * Truncate long addresses for UI display.
 */
export function truncateAddress(addr: string, start = 6, end = 4): string {
  const s = String(addr);
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}...${s.slice(-end)}`;
}
