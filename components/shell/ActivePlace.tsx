"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { placeFor, type PlaceId } from "@/lib/nav/directory";

type Render = (place: PlaceId) => ReactNode;

function FromQuery({ tab, children }: { tab?: string; children: Render }) {
  const path = usePathname() || "/";
  const view = useSearchParams()?.get("view");
  // "My Stocks" lives on the lending page but belongs to Account.
  const holdings = path === "/lend" && view === "portfolio";
  return children(holdings ? "account" : placeFor(path, tab));
}

function FromPath({ tab, children }: { tab?: string; children: Render }) {
  return children(placeFor(usePathname() || "/", tab));
}

/** Tells a menu which place is open. The server HTML already shows the menu, from the path alone. */
export default function ActivePlace(props: { tab?: string; children: Render }) {
  return (
    <Suspense fallback={<FromPath {...props} />}>
      <FromQuery {...props} />
    </Suspense>
  );
}
