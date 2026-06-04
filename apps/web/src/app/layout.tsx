import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'SmartResidence',
  description: 'Modern condo management — built for residents, not against them.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={font.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
