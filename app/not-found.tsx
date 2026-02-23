import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#020410] text-white">
      <h2>404 - Page Not Found</h2>
      <Link href="/" className="text-blue-500 mt-4">Return Home</Link>
    </div>
  );
} 