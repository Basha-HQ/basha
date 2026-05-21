export default function BotOverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', background: '#0A0A0A' }}>
        {children}
      </body>
    </html>
  );
}
