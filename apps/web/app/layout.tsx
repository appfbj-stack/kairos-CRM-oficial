import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Kairos CRM — O CRM que vende por você',
    template: '%s · Kairos CRM',
  },
  description:
    'CRM visual, moderno, multi-tenant, com IA central, WhatsApp multi-provider, RAG e automações.',
  metadataBase: new URL('https://crm.fbautomacao.space'),
  openGraph: {
    title: 'Kairos CRM',
    description: 'O CRM que vende por você. Multi-tenant com IA central e WhatsApp nativo.',
    type: 'website',
  },
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans antialiased">{children}</body>
    </html>
  );
}
