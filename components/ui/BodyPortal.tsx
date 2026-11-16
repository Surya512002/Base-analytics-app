"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Renders children into document.body. Overlays (modals, drawers, sheets) must live here:
 * a `position: fixed` element inside any ancestor with a transform, filter or
 * backdrop-filter is positioned against that ancestor instead of the viewport, which made
 * dialogs open far down the page behind a full-page blur.
 */
export default function BodyPortal({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  if (!isClient) return null;
  return createPortal(children, document.body);
}
