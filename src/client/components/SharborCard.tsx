// src/client/components/SharborCard.tsx
// React component to visualize Mutation & Rarity and show the Lineage Chain for a Sharbor.
// - Interprets mutation_score into a human-readable "Mutation Chance" label.
// - Displays "Generation N, Parent: [Parent NFT Address, truncated]".
// - Optional social actions (Share, Water) via shareSharbor and waterFriend.

import React, { useCallback, useMemo, useState } from 'react';
import { shareSharbor } from '../utils/social';
import { truncateAddress } from '../utils/telegram';
import { waterFriend } from '../utils/social';

export type Sharbor = {
  ton_address: string;
  shard_balance: number;
  mutation_score: number;
  health?: number;
  growth_percent?: number;
  last_heartbeat?: number;
  // Optional extended lineage/display fields if backend provides them:
  nft_id?: string; // e.g., collection-index or token id string
  generation?: number; // e.g., 1..N
  parent_nft_address?: string; // full address; will be truncated for display
};

export type SharborCardProps = {
  sharbor: Sharbor;
  className?: string;

  // Optional UI toggles
  showRarity?: boolean; // default true
  showLineage?: boolean; // default true
  showStats?: boolean; // health/growth stats
  showActions?: boolean; // show "Share" and "Water" buttons

  // Optional custom thresholds for mutation chance
  thresholds?: {
    veryHigh: number; // >= veryHigh => VERY HIGH
    high: number;     // >= high => HIGH
    medium: number;   // >= medium => MEDIUM else LOW
  };
};

type Thresholds = {
  veryHigh: number;
  high: number;
  medium: number;
};

function getMutationLabel(score: number, thr: Thresholds) {
  if (score >= thr.veryHigh) return { label: 'VERY HIGH', color: 'bg-pink-600', text: 'text-white' };
  if (score >= thr.high) return { label: 'HIGH', color: 'bg-amber-500', text: 'text-black' };
  if (score >= thr.medium) return { label: 'MEDIUM', color: 'bg-lime-500', text: 'text-black' };
  return { label: 'LOW', color: 'bg-slate-300', text: 'text-black' };
}

export const SharborCard: React.FC<SharborCardProps> = ({
  sharbor,
  className,
  showRarity = true,
  showLineage = true,
  showStats = true,
  showActions = true,
  thresholds,
}) => {
  const thr = useMemo<Thresholds>(
    () => ({
      veryHigh: thresholds?.veryHigh ?? 80,
      high: thresholds?.high ?? 50,
      medium: thresholds?.medium ?? 25,
    }),
    [thresholds]
  );

  const rarity = useMemo(() => getMutationLabel(sharbor.mutation_score ?? 0, thr), [sharbor.mutation_score, thr]);
  const parentDisplay = useMemo(() => {
    const parent = sharbor.parent_nft_address;
    return parent ? truncateAddress(parent) : 'Unknown';
  }, [sharbor.parent_nft_address]);

  const [isWatering, setIsWatering] = useState(false);
  const [lastWaterApplied, setLastWaterApplied] = useState<boolean | null>(null);

  const onShare = useCallback(() => {
    const id = sharbor.nft_id || sharbor.ton_address;
    shareSharbor(String(id));
  }, [sharbor.nft_id, sharbor.ton_address]);

  const onWater = useCallback(async () => {
    try {
      setIsWatering(true);
      const res = await waterFriend(sharbor.ton_address);
      if (res.ok) {
        setLastWaterApplied(res.applied);
      } else {
        setLastWaterApplied(false);
      }
    } finally {
      setIsWatering(false);
    }
  }, [sharbor.ton_address]);

  return (
    <div
      className={
        className ??
        'rounded-xl border border-slate-200 bg-white/80 shadow-sm p-4 flex flex-col gap-3 max-w-md w-full'
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Sharbor</div>
          <div className="font-semibold text-slate-900 truncate">
            {sharbor.nft_id ? `NFT ${sharbor.nft_id}` : truncateAddress(sharbor.ton_address)}
          </div>
        </div>
        {showRarity && (
          <div className={`px-2 py-1 rounded-md text-xs font-semibold ${rarity.color} ${rarity.text}`}>
            Mutation Chance: {rarity.label}
          </div>
        )}
      </div>

      {showLineage && (
        <div className="text-sm text-slate-700">
          Lineage: Generation {sharbor.generation ?? '—'}, Parent: {parentDisplay}
        </div>
      )}

      {showStats && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-xs text-slate-500">Shards</div>
            <div className="font-semibold">{sharbor.shard_balance ?? 0}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-xs text-slate-500">Health</div>
            <div className="font-semibold">{sharbor.health ?? '—'}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-xs text-slate-500">Growth</div>
            <div className="font-semibold">
              {typeof sharbor.growth_percent === 'number' ? `${sharbor.growth_percent}%` : '—'}
            </div>
          </div>
        </div>
      )}

      {showActions && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
          >
            Share
          </button>
          <button
            type="button"
            onClick={onWater}
            disabled={isWatering}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition-colors"
          >
            {isWatering ? 'Watering…' : 'Water'}
          </button>
          {lastWaterApplied !== null && (
            <div className="text-xs text-slate-500 self-center">
              {lastWaterApplied ? '+5 applied' : 'Daily limit reached'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Usage example:
//
// import React from 'react';
// import { SharborCard, Sharbor } from './SharborCard';
//
// const Example: React.FC = () => {
//   const sharbor: Sharbor = {
//     ton_address: 'EQCk...abcd',
//     shard_balance: 42,
//     mutation_score: 57,      // -> displays "Mutation Chance: HIGH" by default thresholds
//     health: 88,
//     growth_percent: 64,
//     nft_id: '12345',
//     generation: 4,
//     parent_nft_address: 'EQBparentParentParentParentParentParentParent1234'
//   };
//
//   return <SharborCard sharbor={sharbor} showActions />;
// };
