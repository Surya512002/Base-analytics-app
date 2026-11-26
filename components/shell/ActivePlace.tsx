"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { placeFor, type PlaceId } from "@/lib/nav/directory";

type Render = (place: PlaceId) => ReactNode;

function FromQuery({ tab, children }: { tab?: string; children: Render }) {
  const path = usePathname() || "/";
  const params = useSearchParams();
  const view = params?.get("view");
  // Auto-invest lives at /swap?mode=recurring but belongs to Trade.
  if (path === "/swap" && params?.get("mode") === "recurring") return children("trade");
  // Holdings and Orders live on the lending page but belong to Account.
  const account = path === "/lend" && (view === "portfolio" || view === "orders");
  return children(account ? "account" : placeFor(path, tab));
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
