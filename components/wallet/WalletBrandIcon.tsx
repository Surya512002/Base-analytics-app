/** Wallet brand marks for the connect modal. */

export function BaseAppWalletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 111 111"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <path d="M0 0H111V111H0V0Z" fill="#0052FF" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M25.7465 55.5C25.7465 39.021 39.021 25.7465 55.5 25.7465C71.979 25.7465 85.2535 39.021 85.2535 55.5C85.2535 71.979 71.979 85.2535 55.5 85.2535C39.021 85.2535 25.7465 71.979 25.7465 55.5ZM55.5 15.7465C33.4964 15.7465 15.7465 33.4964 15.7465 55.5C15.7465 77.5036 33.4964 95.2535 55.5 95.2535C77.5036 95.2535 95.2535 77.5036 95.2535 55.5C95.2535 33.4964 77.5036 15.7465 55.5 15.7465Z"
        fill="white"
      />
    </svg>
  );
}

export function FarcasterWalletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <rect width="256" height="256" rx="56" fill="#855DCD" />
      <path
        fill="white"
        d="M64 96h128v80c0 17.673-14.327 32-32 32H96c-17.673 0-32-14.327-32-32V96zm0 0c0-26.51 21.49-48 48-48h32c26.51 0 48 21.49 48 48H64z"
      />
    </svg>
  );
}

export function MetaMaskWalletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 318.6 318.6"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <path fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z" />
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zM238.3 206.8l-26.5 40.6 56.7 15.6 16.3-55.3zM33.9 207.7 50 262l56.7-15.6-26.5-40.6z" />
      <path fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zM214.9 138.2l-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.2-16 28.6-23.6z" />
      <path fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round" d="m140 231.4-33.2 16 10-42.3zM178 231.4l23.2 26.2 10.1-42.3z" />
      <path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m178.1 231.4-23.2 26.2 18.7 5.5 38.3-27.5zM140 231.4l-10 42.3 18.8 5.5z" />
      <path fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round" d="m149.8 237.3-18.8-5.5 6.5 4.3 23.3-4.3zM198.1 237.3-18.8-5.5 6.5 4.3 23.3-4.3z" />
      <path fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round" d="m178.1 231.4-23.2-26.2 28.6 23.6zM140 231.4l33.2-16-28.6-23.6z" />
      <path fill="#F6851B" stroke="#F6851B" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2 36.4 68.5-2-60.5zM214.9 138.2l-36.4 68.5 2-60.5z" />
    </svg>
  );
}
