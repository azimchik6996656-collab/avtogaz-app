export const metadata = {
  title: "Avtogaz Service",
  description: "Avtogaz servis boshqaruv tizimi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      {/*
        Shriftlar bu yerda <link> orqali yuklanadi. Ilgari ular GlobalStyles ichidagi
        <style> tegida "@import url('...')" bo'lgan edi — u ikki muammo tug'dirardi:
        1) Server HTML'da apostrof va "&" belgilari HTML-escape qilinardi (&#x27; / &amp;),
           brauzerda esa yo'q — natijada hydration mos kelmay, React butun sahifani
           tashlab, qaytadan mijoz tomonida chizishga o'tardi (konsolda
           "Text content does not match server-rendered HTML").
        2) CSS "@import" faqat stylesheet o'qilgandan keyin ishga tushadi — <link>
           esa parallel yuklanadi, ya'ni shrift tezroq keladi.
      */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
