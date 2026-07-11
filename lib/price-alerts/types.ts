export type StoredPriceAlert = {
  id: string;
  wallet: string;
  address: string;
  symbol: string;
  direction: "above" | "below";
  priceUsd: number;
  createdAt: number;
  triggered?: boolean;
};

export type PriceAlertInput = Omit<
  StoredPriceAlert,
  "id" | "createdAt" | "triggered"
>;
