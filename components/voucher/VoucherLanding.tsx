"use client";

import { motion } from "motion/react";
import VoucherHero from "@/components/wallet/VoucherHero";
import VoucherMarketplace from "@/components/voucher/VoucherMarketplace";
import { SECTION_THEME } from "@/lib/motion/presets";

/** Combined voucher landing — hero + live marketplace in one section. */
export default function VoucherLanding() {
  const v = SECTION_THEME.vouchers;
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: v.border,
          background: `linear-gradient(150deg, ${v.soft}, transparent 50%)`,
        }}
      >
        <div className={`h-1 w-full bg-gradient-to-r ${v.bar}`} />
        <div className="p-1">
          <VoucherHero />
        </div>
      </div>
      <VoucherMarketplace />
    </motion.div>
  );
}
