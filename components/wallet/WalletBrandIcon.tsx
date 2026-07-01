/** Wallet brand marks for the connect modal — crisp official assets. */

type WalletIconProps = {
  size?: number;
};

function WalletImageIcon({
  src,
  alt,
  size = 28,
}: {
  src: string;
  alt: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-[22%] object-cover"
      draggable={false}
    />
  );
}

export function BaseAppWalletIcon({ size = 28 }: WalletIconProps) {
  return (
    <WalletImageIcon
      src="/wallets/base-wallet.svg"
      alt="Base App Wallet"
      size={size}
    />
  );
}

export function MetaMaskWalletIcon({ size = 28 }: WalletIconProps) {
  return (
    <WalletImageIcon src="/wallets/metamask.png" alt="MetaMask" size={size} />
  );
}

export function FarcasterWalletIcon({ size = 28 }: WalletIconProps) {
  return (
    <WalletImageIcon src="/wallets/farcaster.svg" alt="Farcaster" size={size} />
  );
}
