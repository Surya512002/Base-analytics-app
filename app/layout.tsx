import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const APP_URL = 'https://base-analytics-app.vercel.app';

export const metadata: Metadata = {
  title: 'Base Analytics — Season 1: Genesis',
  description: 'Track your onchain score, mint gasless badges, farm XP and climb the leaderboard on Base.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'Base Analytics — Season 1: Genesis',
    description: 'Track your onchain score, mint gasless badges, farm XP and climb the leaderboard on Base.',
    url: APP_URL,
    siteName: 'Base Analytics',
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Base Analytics — Season 1: Genesis',
    images: [`${APP_URL}/opengraph-image`],
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next',
      imageUrl: `${APP_URL}/opengraph-image`,
      button: {
        title: 'Check Score & Mint Badges',
        action: {
          type: 'launch_frame',
          name: 'Base Analytics',
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: '#060a14',
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta property="og:image" content={`${APP_URL}/opengraph-image`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
      </head>
      <body className="bg-[#060a14] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
 