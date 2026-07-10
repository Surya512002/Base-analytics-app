import type { InsiderAllocation, VestedAllocation } from "@/lib/launchpad/launch-config";

export type LaunchPresetId = "fair" | "creator" | "team" | "meme";

export interface LaunchPreset {
  id: LaunchPresetId;
  label: string;
  tagline: string;
  creatorPct: number;
  insiders: Omit<InsiderAllocation, "id">[];
  vested: Omit<VestedAllocation, "id">[];
}

export const LAUNCH_PRESETS: LaunchPreset[] = [
  {
    id: "fair",
    label: "Fair launch",
    tagline: "0% creator · max pool reserve",
    creatorPct: 0,
    insiders: [],
    vested: [],
  },
  {
    id: "creator",
    label: "Creator",
    tagline: "10% liquid to your wallet",
    creatorPct: 10,
    insiders: [],
    vested: [],
  },
  {
    id: "team",
    label: "Team",
    tagline: "15% creator · 10% insiders",
    creatorPct: 15,
    insiders: [
      { address: "", pct: 5 },
      { address: "", pct: 5 },
    ],
    vested: [],
  },
  {
    id: "meme",
    label: "Meme",
    tagline: "5% creator · deep liquidity",
    creatorPct: 5,
    insiders: [],
    vested: [],
  },
];

export function getLaunchPreset(id: LaunchPresetId): LaunchPreset | undefined {
  return LAUNCH_PRESETS.find((p) => p.id === id);
}

export function applyLaunchPreset(
  preset: LaunchPreset
): {
  creatorPct: number;
  insiders: InsiderAllocation[];
  vested: VestedAllocation[];
} {
  return {
    creatorPct: preset.creatorPct,
    insiders: preset.insiders.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    })),
    vested: preset.vested.map((a) => ({
      ...a,
      id: crypto.randomUUID(),
    })),
  };
}
