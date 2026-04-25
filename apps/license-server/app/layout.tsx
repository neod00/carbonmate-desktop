export const metadata = {
  title: 'CarbonMate License Server',
  description: 'License and update distribution for CarbonMate Desktop.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
