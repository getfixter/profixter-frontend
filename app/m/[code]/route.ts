import { NextResponse, type NextRequest } from "next/server";

/**
 * The personal link printed on each postcard (and behind its QR code):
 * www.profixter.com/m/<wave>-<code>. It sends the homeowner to the free-visit
 * booker with tags that attribute the visit to that mail wave and recipient,
 * so first free visits from mail are counted per wave. Unknown or malformed
 * codes still land on the booker, tagged as mail.
 */
const CODE = /^(w\d{6}[a-z0-9]{2})-([a-z0-9]{4,12})$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = String(code || "").toLowerCase().slice(0, 40);
  const match = CODE.exec(clean);
  const url = new URL("/book/free", request.nextUrl.origin);
  url.searchParams.set("utm_source", "postcard");
  url.searchParams.set("utm_medium", "mail");
  if (match) {
    url.searchParams.set("utm_campaign", match[1]);
    url.searchParams.set("utm_content", clean);
  }
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
