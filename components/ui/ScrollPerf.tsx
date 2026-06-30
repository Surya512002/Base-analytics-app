"use client";

import { useEffect } from "react";

/** Marks touch devices and pauses heavy effects while the user scrolls. */
export default function ScrollPerf() {
  useEffect(() => {
    const root = document.documentElement;

    const touchMq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const narrowMq = window.matchMedia("(max-width: 768px)");

    const applyTouch = () => {
      if (touchMq.matches || narrowMq.matches) {
        root.dataset.touch = "1";
      } else {
        delete root.dataset.touch;
      }
    };

    applyTouch();
    touchMq.addEventListener("change", applyTouch);
    narrowMq.addEventListener("change", applyTouch);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const markScrolling = () => {
      root.classList.add("is-scrolling");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove("is-scrolling"), 140);
    };

    window.addEventListener("scroll", markScrolling, { passive: true });
    window.addEventListener("touchmove", markScrolling, { passive: true });

    return () => {
      touchMq.removeEventListener("change", applyTouch);
      narrowMq.removeEventListener("change", applyTouch);
      window.removeEventListener("scroll", markScrolling);
      window.removeEventListener("touchmove", markScrolling);
      if (timer) clearTimeout(timer);
      root.classList.remove("is-scrolling");
      delete root.dataset.touch;
    };
  }, []);

  return null;
}
