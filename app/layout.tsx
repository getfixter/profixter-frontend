import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import Providers from "./providers";
import ScrollToTop from "./ScrollToTop";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.profixter.com"),
  title: {
    default: "Profixter | Home Support AI, Handyman Visits, Membership & Projects",
    template: "%s | Profixter",
  },
  description:
    "Profixter helps Long Island homeowners with free Home Support AI, $99 one-time handyman visits, ongoing membership, and larger home project estimates. Licensed HI-71484. Nassau and Suffolk County.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Profixter",
    "Long Island handyman",
    "home maintenance membership",
    "home support AI",
    "Nassau County handyman",
    "Suffolk County handyman",
    "home project estimates",
  ],
  openGraph: {
    title: "Profixter | Home Support for Long Island Homeowners",
    description:
      "Free Home Support AI, $99 handyman visits, ongoing maintenance membership, and larger home project estimates.",
    url: "https://www.profixter.com",
    siteName: "Profixter",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/images/hero-bg.webp",
        width: 1200,
        height: 630,
        alt: "Profixter home support for Long Island homeowners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter | Home Support for Long Island Homeowners",
    description:
      "Free Home Support AI, $99 handyman visits, membership, and larger project estimates.",
    images: ["/images/hero-bg.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <Script
          id="profixter-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HomeAndConstructionBusiness",
            name: "Profixter",
            url: "https://www.profixter.com",
            telephone: "+1-631-599-1363",
            areaServed: ["Nassau County, NY", "Suffolk County, NY"],
            image: "https://www.profixter.com/images/hero-bg.webp",
            priceRange: "$$",
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Profixter services",
              itemListElement: [
                { "@type": "Offer", name: "Home Support AI" },
                { "@type": "Offer", name: "One-Time Handyman Visit" },
                { "@type": "Offer", name: "Profixter Membership" },
                { "@type": "Offer", name: "Home Projects" },
              ],
            },
          })}
        </Script>
        <Script id="gtm-head" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KFPSD2P6');`}
        </Script>
      </head>

      {FB_PIXEL_ID ? (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${FB_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>

          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}

      <body className="antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KFPSD2P6"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        <ScrollToTop />

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
