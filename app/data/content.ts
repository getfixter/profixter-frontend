// app/data/content.ts

export type Service = {
  id: string;
  title: string;
  description: string;
  color: "blue" | "light" | "dark";
  size: "small" | "normal" | "large";
  offset: number;
};

export const services: Service[] = [
  {
    id: "01",
    title: "Unlimited requests",
    description:
      "Basic: 1 active appointment at a time. Plus & higher: 2 active appointments at once.",
    color: "blue",
    size: "normal",
    offset: 0,
  },
  {
    id: "02",
    title: "Basic improvements",
    description:
      "Mount TVs/shelves, replace faucets/locks, hang fixtures, assemble furniture, etc.",
    color: "light",
    size: "normal",
    offset: 0,
  },
  {
    id: "03",
    title: "Quick fixes",
    description:
      "Outlets, leaks, cabinet hinges, caulk, drywall touch-ups, etc.",
    color: "dark",
    size: "small",
    offset: 0,
  },
  {
    id: "04",
    title: "Store pickup & delivery",
    description:
      "We pick up materials or supplies for your project at no extra cost.",
    color: "blue",
    size: "normal",
    offset: -50,
  },
  {
    id: "05",
    title: "Standard materials included",
    description:
      "We bring repair supplies. Specialty finishes billed at cost if needed.",
    color: "dark",
    size: "large",
    offset: -20,
  },
  {
    id: "06",
    title: "24/7 emergency help",
    description:
      "Reach us anytime for urgent issues that can’t wait. Call 631-599-1363.",
    color: "dark",
    size: "small",
    offset: -100,
  },
  {
    id: "07",
    title: "Second pro when needed",
    description:
      "Extra hands for heavy lifting or complex tasks — included when needed at no extra labor cost.",
    color: "dark",
    size: "normal",
    offset: 10,
  },
  {
    id: "08",
    title: "Renovation consultation",
    description:
      "Scope, estimate ranges, timelines, materials guidance, home improvement guidance.",
    color: "light",
    size: "normal",
    offset: -20,
  },
  {
    id: "09",
    title: "Seasonal property inspection",
    description:
      "Regular seasonal assessments to spot maintenance needs early.",
    color: "dark",
    size: "large",
    offset: -30,
  },
  {
    id: "10",
    title: "General Contractor",
    description:
      "General contractor-level project management, with home-improvement discounts.",
    color: "blue",
    size: "large",
    offset: -60,
  },
];

export type Faq = {
  id: string;
  question: string;
  answer: string;
  color: "blue" | "light" | "dark";
  size: "small" | "normal" | "large";
  offset: number;
};

export const faqs: Faq[] = [
  {
    id: "01",
    question: "What is included in each visit?",
    answer:
      "Each visit includes up to 90 minutes of handyman labor for eligible tasks.",
    color: "blue",
    size: "normal",
    offset: 0,
  },
  {
    id: "02",
    question: "Do I pay anything per visit?",
    answer:
      "No extra labor charge per visit. If materials are needed, you only cover material cost.",
    color: "light",
    size: "normal",
    offset: 0,
  },
  {
    id: "03",
    question: "How many appointments can I have booked at once?",
    answer:
      "Basic members can have 1 active appointment booked at a time. Plus, Premium, and Elite can have 2 active appointments booked at once.",
    color: "dark",
    size: "normal",
    offset: 0,
  },
  {
    id: "04",
    question: "What if my job takes longer than 90 minutes?",
    answer:
      "We can split the work into multiple visits based on availability.",
    color: "dark",
    size: "small",
    offset: 0,
  },
  {
    id: "05",
    question: "How do I book a visit?",
    answer:
      "Use the booking form after you’re a member and choose an available slot.",
    color: "blue",
    size: "normal",
    offset: -50,
  },
  {
    id: "06",
    question: "How fast can I get an appointment?",
    answer:
      "Appointments are based on availability. We aim for the soonest possible slot.",
    color: "dark",
    size: "large",
    offset: -20,
  },
  {
    id: "07",
    question: "What tasks are NOT covered?",
    answer:
      "Big remodels, structural work, large electrical/plumbing projects, and specialty trades are not included.",
    color: "dark",
    size: "small",
    offset: -100,
  },
  {
    id: "08",
    question: "Do you bring materials?",
    answer:
      "Basic supplies may be used. If special parts are needed, you cover material cost.",
    color: "dark",
    size: "normal",
    offset: 10,
  },
  {
    id: "09",
    question: "Can I reschedule?",
    answer:
      "Yes—please reschedule early so we can offer the slot to another customer.",
    color: "light",
    size: "normal",
    offset: -20,
  },
  {
    id: "10",
    question: "Is this insurance?",
    answer:
      "No. It’s a handyman protection membership (not insurance).",
    color: "dark",
    size: "large",
    offset: -30,
  },
  {
    id: "11",
    question: "How do I contact you?",
    answer:
      "Call or text Taras at 631-599-1363 anytime you have questions.",
    color: "blue",
    size: "large",
    offset: -60,
  },
];

export type Plan = {
  name: "Basic" | "Plus" | "Premium" | "Elite";
  description: string;
  price: number;
  subtitle?: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  stripeLink: string;
};

export const plans: Plan[] = [
  {
    name: "Basic",
    description: "Small fixes",
    price: 149,
    features: [
      "Unlimited visits",
      "Up to 90 minutes per visit",
      "1 active appointment at a time",
    ],
    buttonText: "Get started",
    stripeLink: "https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02",
  },
  {
    name: "Plus",
    description: "Busy homes (2 active bookings)",
    price: 249,
    subtitle: "Everything in Basic + book 2 appointments at once",
    features: [
      "2 active appointments at once",
      "Multiple tasks per visit",
      "Store pickup",
      "Standard materials included",
    ],
    buttonText: "Get started",
    stripeLink: "https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03",
  },
  {
    name: "Premium",
    description: "Families & urgent needs",
    price: 349,
    subtitle: "Everything in Plus",
    features: [
      "2 active appointments at once",
      "24/7 emergency help",
      "After-hours availability",
      "Second pro when needed",
    ],
    buttonText: "Get started",
    isPopular: true,
    stripeLink: "https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04",
  },
  {
    name: "Elite",
    description: "Rentals & large homes",
    price: 499,
    subtitle: "Everything in Premium",
    features: [
      "2 active appointments at once",
      "General contractor support",
      "Property management help",
      "Home-improvement discounts",
    ],
    buttonText: "Get started",
    stripeLink: "https://buy.stripe.com/5kQ28qeANaW8ac93ASawo01",
  },
];

export type TeamMember = {
  id: number;
  name: string;
  photo: string;
  thumb: string;
  blurb: string;
};

export const team: TeamMember[] = [
  {
    id: 1,
    name: "Taras Bandura",
    photo: "/images/ttaras.png",
    thumb: "/images/ttaras.png",
    blurb:
      "Friendly, experienced, and always ready to help. Makes every home project stress-free. Always focused on quality and customer satisfaction. Favorite projects: bringing treats for your pets.",
  },
  {
    id: 2,
    name: "Roman Hecha",
    photo: "/images/handymen2.png",
    thumb: "/images/handymen2.png",
    blurb:
      "Detail-driven electrician and installer. Loves smart-home setups and clean finishes. Reliable and professional.",
  },
];
