export const metadata = {
  title: "Avtogaz Service",
  description: "Avtogaz servis boshqaruv tizimi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
