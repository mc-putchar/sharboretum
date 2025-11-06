// src/client/utils/social.ts
// Viral social actions for the Sharboretum client: waterFriend and shareSharbor.

import { ENV } from './sharboretumClient';
import { ensureWebAppReady, getTelegramUser, openShare, resolveFriendDisplay, showPopup, getTelegramWebApp } from './telegram';
import { requireSenderAddress } from './tonAddressStore';

export type WaterFriendResult =
  | {
      ok: true;
      applied: boolean;
      receiver_address: string;
      mutation_score: number;
      timestamp: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

/**
 * Water a friend's Sharbor to boost their mutation_score via the backend viral social API.
 * - Calls POST /api/social-action with { sender_address, receiver_address }
 * - Shows confirmation popup: "Thanks, [YourName]! You helped [FriendName]! +5 Mutation Score earned."
 * - If already watered today: "You've already helped [FriendName] today. Try again tomorrow."
 */
export async function waterFriend(friendTonAddress: string): Promise<WaterFriendResult> {
  ensureWebAppReady();
  const sender = requireSenderAddress();
  const friendDisplay = resolveFriendDisplay(friendTonAddress);
  const tgUser = getTelegramUser();
  const you = tgUser.firstName || tgUser.username || (tgUser.id ? `User ${tgUser.id}` : 'Friend');

  try {
    const res = await fetch(`${ENV.API_BASE}/api/social-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sender_address: sender,
        receiver_address: friendTonAddress,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      showPopup(`Failed to help ${friendDisplay}: ${text || 'Network/Server error'}`, 'Social Action');
      return { ok: false, status: res.status, error: text || 'Social action failed' };
    }

    const data = (await res.json()) as {
      receiver_address: string;
      mutation_score: number;
      applied: boolean;
      timestamp: number;
    };

    const wa = getTelegramWebApp();

    if (data.applied) {
      showPopup(`Thanks, ${you}! You helped ${friendDisplay}! +5 Mutation Score earned.`, 'Watered!');
      wa?.HapticFeedback?.notificationOccurred?.('success');
    } else {
      showPopup(`You've already helped ${friendDisplay} today. Try again tomorrow.`, 'Daily Limit');
      wa?.HapticFeedback?.notificationOccurred?.('warning');
    }

    return {
      ok: true,
      applied: data.applied,
      receiver_address: data.receiver_address,
      mutation_score: data.mutation_score,
      timestamp: data.timestamp,
    };
  } catch (err: any) {
    showPopup(`Failed to help ${friendDisplay}: ${err?.message ?? 'Network error'}`, 'Social Action');
    return { ok: false, status: 0, error: err?.message ?? 'Network error' };
  }
}

export type ShareSharborOptions = {
  // Override link to the Mini App. Defaults to window.__MINI_APP_LINK__ or current location.
  miniAppLink?: string;
};

/**
 * Open Telegram sharing interface with a prefilled message for the user's Sharbor.
 * Message: "My Sharbor [NFT ID] is growing beautifully! Visit my Sharboretum to help me get a Rare Mutation: [Mini App Link]"
 *
 * Uses Telegram WebApp.ready() and openTelegramLink/openLink. If WebApp supports sendData,
 * also forwards a share payload to the bot for optional deep integration.
 */
export function shareSharbor(nftId: string, opts?: ShareSharborOptions): void {
  ensureWebAppReady();
  const link = opts?.miniAppLink || window.__MINI_APP_LINK__ || (typeof location !== 'undefined' ? location.href : '');
  const message = `My Sharbor ${nftId} is growing beautifully! Visit my Sharboretum to help me get a Rare Mutation: ${link}`;

  // Open the standard Telegram share URL
  openShare(message, link);

  // Optionally notify the bot/backend via sendData for deeper share handling (if supported)
  const wa = getTelegramWebApp();
  const payload = {
    type: 'share',
    nftId,
    text: message,
    url: link,
  };

  // Some clients expose sendData to communicate with the bot; use if available
  try {
    wa?.sendData?.(JSON.stringify(payload));
  } catch {
    // ignore
  }
}
