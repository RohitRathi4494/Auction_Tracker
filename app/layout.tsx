import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SARDA Corporate Cricket League — Auction Dashboard',
  description:
    'Live auction dashboard for SARDA Corporate Cricket League Season 6. Player directory, live bidding, real-time team views.',
  keywords: ['cricket', 'auction', 'SCCL', 'corporate cricket', 'SARDA'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[oklch(0.12_0.01_250)] text-[oklch(0.95_0.005_250)] antialiased font-[var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
