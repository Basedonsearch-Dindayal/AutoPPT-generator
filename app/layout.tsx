import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Auto PPT Maker - AI Powered Presentation Generator',
  description: 'Generate professional PowerPoint presentations instantly with AI. Just enter your topic and get a complete presentation ready to download.',
  keywords: 'PowerPoint, PPT, presentation, generator, AI, automatic, slides',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}