import '@/app/ui/global.css';
import { albert_sans } from '@/app/ui/fonts';
import { Metadata } from 'next';
import { Toaster } from './ui/shadcn/components/ui/toaster';

export const metadata: Metadata = {
  title: {
    template: '%s | RMS',
    default: 'Schedule | RMS',
  },
  description: 'The RMS Fitness management app',
  viewport: 'width=device-width, initial-scale=1.0',
  metadataBase: new URL('https://rms-scheduler.vercel.app'),
  manifest: '/manifest.json',
  icons: [
    {
      rel: 'icon',
      type: 'image/ico',
      sizes: '32x32',
      url: '/icon.ico',
    },
    {
      rel: 'icon',
      type: 'image/ico',
      sizes: '16x16',
      url: '/icon16x16.ico',
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      url: '/favicon/apple-touch-icon.png',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${albert_sans.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
