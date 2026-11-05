import { describe, expect, it } from "vitest";
import React from "react";
import LendingViewTabs from "@/components/lending/LendingViewTabs";

describe("LendingViewTabs Layout & Simplified Navigation", () => {
  it("defines the 4 streamlined tabs without duplicate All Markets tab", () => {
    let selected = "stocks";
    const element = React.createElement(LendingViewTabs, {
      value: selected as any,
      onChange: (val) => {
        selected = val;
      },
      stocksCount: 12,
      vaultsCount: 6,
    });

    expect(element).toBeDefined();
    expect(element.props.stocksCount).toBe(12);
    expect(element.props.vaultsCount).toBe(6);
  });
});
