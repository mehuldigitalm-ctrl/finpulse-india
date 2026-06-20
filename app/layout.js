import "./globals.css";

export const metadata = {
  title: "FinPulse India — AI-Curated Indian Finance News",
  description:
    "Live Indian finance news curated by AI. Sensex, Nifty, RBI updates, Indian economy, startups, and policy — updated every hour.",
  keywords: "Indian finance news, Sensex, Nifty, BSE, NSE, RBI, Indian stocks, economy",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
