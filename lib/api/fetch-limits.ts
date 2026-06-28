export type FetchMode = "fast" | "full";

export interface FetchLimits {
  alchemyMaxPages: number;
  blockscoutTokenPages: number;
  blockscoutInternalPages: number;
  blockscoutExternalPages: number;
  blockscoutDeadlineMs: number;
  includeBasescan: boolean;
}

export const FETCH_LIMITS: Record<FetchMode, FetchLimits> = {
  fast: {
    alchemyMaxPages: 2,
    blockscoutTokenPages: 6,
    blockscoutInternalPages: 12,
    blockscoutExternalPages: 4,
    blockscoutDeadlineMs: 5000,
    includeBasescan: false,
  },
  full: {
    alchemyMaxPages: 10,
    blockscoutTokenPages: 30,
    blockscoutInternalPages: 25,
    blockscoutExternalPages: 15,
    blockscoutDeadlineMs: 28000,
    includeBasescan: true,
  },
};
