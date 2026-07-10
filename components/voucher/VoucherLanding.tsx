import VoucherHero from "@/components/wallet/VoucherHero";
import VoucherMarketplace from "@/components/voucher/VoucherMarketplace";

/** Combined voucher landing — hero + live marketplace in one section. */
export default function VoucherLanding() {
  return (
    <div className="space-y-4">
      <VoucherHero />
      <VoucherMarketplace />
    </div>
  );
}
