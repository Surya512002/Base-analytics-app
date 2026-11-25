/** Who runs this site and what it never asks for. Shown in the footer and on pages opened from shared links. */
export default function SafetyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-[var(--ink-muted)] ${className}`}>
      Base Analytics is an independent app. It is not affiliated with or endorsed by Base or Coinbase. It never asks for
      your wallet&apos;s recovery phrase, private key or password.
    </p>
  );
}
