"use client";

import React from "react";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import StockQuotePicker from "./StockQuotePicker";

interface QuoteAssetPickerProps {
  selectedStock: BaseStock;
  onSelectStock: (stock: BaseStock) => void;
  stockPrices?: Record<string, number>;
}

export default function QuoteAssetPicker(props: QuoteAssetPickerProps) {
  return <StockQuotePicker {...props} />;
}
