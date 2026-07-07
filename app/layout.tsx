import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import Providers from "./providers";
import ScrollToTop from "./ScrollToTop";
import CustomerSiteMobileNav from "./components/CustomerSiteMobileNav";
import "./globals.css";
import { DEFAULT_OG_IMAGE, PROFIXTER_STRUCTURED_DATA, SITE_NAME, SITE_URL } from "@/lib/seo";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Long Island Handyman | $99 Visits & Home Maintenance Membership",
    template: "%s | Profixter",
  },
  description:
    "Monthly home maintenance Membership, $99 One-Time Handyman Visits, and renovation help for Long Island homeowners.",
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
    title: "Long Island Handyman | $99 Visits & Home Maintenance Membership",
    description:
      "Monthly home maintenance Membership, $99 One-Time Handyman Visits, and renovation help for Long Island homeowners.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Island Handyman | $99 Visits & Home Maintenance Membership",
    description:
      "Monthly home maintenance Membership, $99 One-Time Handyman Visits, and renovation help for Long Island homeowners.",
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/manifest-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/manifest-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  manifest: "/manifest.webmanifest",
  category: "home services",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    telephone: true,
    address: false,
    email: true,
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
        <meta name="theme-color" content="#0B1628" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Profixter" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Script
          id="profixter-local-business-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify(PROFIXTER_STRUCTURED_DATA)}
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

        <Providers>
          {children}
          <CustomerSiteMobileNav />
        </Providers>
      </body>
    </html>
  );
}
