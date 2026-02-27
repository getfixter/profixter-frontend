export type RecommendedBusinessCategory =
  | "Electrician"
  | "HVAC"
  | "Plumber"
  | "Home Improvement"
  | "House Keeping";

export type RecommendedBusiness = {
  category: RecommendedBusinessCategory;
  name: string;
  phoneDisplay: string; // how it shows on screen
  phoneTel: string; // only digits (for tel:)
  description: string;
  photoSrc: string; // put images in /public/images/partners/...
  featured?: boolean; // paid spot / featured badge
};

export const RECOMMENDED_MAGIC_WORD = "Mr. Fixter";

export const RECOMMENDED_BUSINESSES: RecommendedBusiness[] = [
  {
    category: "Electrician",
    name: "Patrick",
    phoneDisplay: "(718) 450-2485",
    phoneTel: "+17184502485",
    description:
      "Reliable electrician — clear communication, clean work, and solid troubleshooting.",
    photoSrc: "/images/partners/patrick.jpg",
    featured: true,
  },
  {
    category: "HVAC",
    name: "Kamil",
    phoneDisplay: "(631) 946-9890",
    phoneTel: "+16319469890",
    description:
      "Great HVAC tech for diagnostics and service calls — honest recommendations and quick response.",
    photoSrc: "/images/partners/kamil.jpg",
  },
  {
    category: "Plumber",
    name: "Greg",
    phoneDisplay: "(631) 988-0071",
    phoneTel: "+16319880071",
    description:
      "Professional plumber — solves problems the right way and keeps things clean and straightforward.",
    photoSrc: "/images/partners/greg.jpg",
  },
  {
    category: "Home Improvement",
    name: "KIE (Jarek)",
    phoneDisplay: "(631) 835-3607",
    phoneTel: "+16318353607",
    description:
      "Skilled home improvement pro — strong craftsmanship, detail-oriented finishes, reliable scheduling.",
    photoSrc: "/images/partners/jarek.jpg",
  },
  {
    category: "House Keeping",
    name: "Edita",
    phoneDisplay: "(631) 456-3334",
    phoneTel: "+16314563334",
    description:
      "Trusted housekeeping — consistent quality, dependable, and great for recurring or deep cleanings.",
    photoSrc: "/images/partners/edita.jpg",
  },
];