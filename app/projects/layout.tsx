import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const projectsImage = {
  url: "/images/projects/New%20House%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island home renovation project by Profixter",
};

export const metadata: Metadata = {
  title: {
    absolute: "Long Island Renovations & General Contractor | Profixter",
  },
  description:
    "Planning roofing, siding, kitchen, bathroom, full-home renovation, or new construction? Request a clear project estimate from Profixter.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Long Island Renovations & General Contractor | Profixter",
    description:
      "Roofing, siding, kitchens, bathrooms, full-home renovations, and new construction estimates for Long Island homeowners.",
    url: absoluteUrl("/projects"),
    type: "website",
    images: [projectsImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Island Renovations & General Contractor | Profixter",
    description:
      "Request a clear estimate for roofing, siding, kitchen, bathroom, full-home renovation, or new construction.",
    images: [projectsImage.url],
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
