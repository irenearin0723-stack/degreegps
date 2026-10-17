import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DegreeGPS — UW Academic & Career Navigator',
  description: 'Map University of Washington coursework to your career destination.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
