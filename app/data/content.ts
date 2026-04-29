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
    title: "Simple monthly visits",
    description:
      "Choose the plan that fits your home. Each visit covers up to 90 minutes of work.",
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
      "Emergency visits are limited to one per month and are for urgent situations only.",
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
    question: "How long is each visit?",
    answer:
      "Each visit covers up to 90 minutes of work for eligible tasks.",
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
    question: "How many visits come with each plan?",
    answer:
      "Home Care Membership includes one scheduled visit each month. Home Care Plus includes two scheduled visits each month. Home Protection includes two scheduled visits plus one emergency visit per month. Whole-Home Care includes two scheduled visits plus one full project day per month (up to 8 hours).",
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
      "Big remodels, structural work, large electrical/plumbing projects, and appliances fixes are not included.",
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
      "Yes-please reschedule early so we can offer the slot to another customer.",
    color: "light",
    size: "normal",
    offset: -20,
  },
  {
    id: "10",
    question: "Are you Licensed and Insured?",
    answer:
      "Yes we are fully Licensed and Insured, here is our Licensed #HI-71484.",
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
  {
    id: "12",
    question: "How often can I book?",
    answer:
      "You can book as often as availability allows. Most members use one visit per month.",
    color: "light",
    size: "normal",
    offset: -20,
  },
  


];

export const homepageFaqs: Faq[] = [
  {
    id: "01",
    question: "What can I book?",
    answer:
      "Common handyman tasks that fit within your visit time. Use 'What can I book?' for the full guide.",
    color: "blue",
    size: "normal",
    offset: 0,
  },
  {
    id: "02",
    question: "How often can I book?",
    answer:
      "You can book as often as availability allows. Most members use one visit per month.",
    color: "light",
    size: "normal",
    offset: 0,
  },
  {
    id: "03",
    question: "Do I need estimates?",
    answer:
      "No. You choose your plan, book online, and know what to expect upfront. No estimates and no surprise invoices.",
    color: "dark",
    size: "normal",
    offset: 0,
  },
  {
    id: "04",
    question: "How does booking work?",
    answer:
      "Pick your plan, choose an available day and time, describe the task, add photos, and we confirm the appointment.",
    color: "dark",
    size: "small",
    offset: 0,
  },
  {
    id: "05",
    question: "What if I need more flexibility?",
    answer:
      "Higher memberships include more scheduled visits each month — and Home Protection adds emergency response, while Whole-Home Care adds a full project day for the bigger items.",
    color: "blue",
    size: "normal",
    offset: -50,
  },
];

export type Plan = {
  // Internal name — used for Stripe links, plan-rank logic, billing actions.
  // DO NOT change without also updating subscription-service + stripe-links.
  name: "Basic" | "Plus" | "Premium" | "Elite";

  // Display name shown to homeowners — retention-first membership framing.
  displayName: string;

  // One-line outcome promise (replaces old "positioning label").
  tagline: string;

  // Short cadence line shown above features (replaces "1 active booking" framing).
  cadence: string;

  description: string;
  price: number;
  subtitle?: string;
  features: string[];
  buttonText: string;

  // Italic retention-prime line shown near the CTA. Plants the
  // "this is something people keep" frame at decision time.
  retentionLine: string;

  // Card badge label — only used by 1-2 plans to anchor the ladder.
  badge?: "StartHere" | "StayHere";

  stripeLink: string;
};

export const plans: Plan[] = [
  {
    name: "Basic",
    displayName: "Home Care Membership",
    tagline: "Your home, handled.",
    cadence: "One scheduled visit each month",
    description:
      "The easiest way to keep your home handled, year-round.",
    price: 149,
    features: [
      "One scheduled visit each month",
      "Same trusted team — they get to know your home",
      "Small fixes and regular maintenance, no estimates",
      "Predictable monthly billing",
    ],
    buttonText: "Become a Member",
    retentionLine:
      "Most members stay for the long haul — your home keeps getting better, not worse.",
    stripeLink: "https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02",
  },
  {
    name: "Plus",
    displayName: "Home Care Plus",
    tagline: "Stay ahead of your home, not behind it.",
    cadence: "Two scheduled visits each month",
    description:
      "More care, more often — for active homes with an ongoing list.",
    price: 249,
    subtitle: "Everything in Home Care",
    features: [
      "Two scheduled visits each month",
      "Same trusted team — they remember every detail",
      "Tackle the to-do list before it becomes a problem list",
      "Priority on open scheduling slots",
    ],
    buttonText: "Become a Member",
    badge: "StartHere",
    retentionLine:
      "Where most homeowners with active homes start — and stay for years.",
    stripeLink: "https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03",
  },
  {
    name: "Premium",
    displayName: "Home Protection",
    tagline: "Cared for. And protected.",
    cadence: "Two scheduled visits + emergency response",
    description:
      "Ongoing care, plus on-call help when something can't wait.",
    price: 349,
    subtitle: "Everything in Home Care Plus",
    features: [
      "Two scheduled visits each month",
      "One emergency visit per month when something can't wait",
      "Same trusted team — on call for the moments that matter",
      "Direct line to Taras, the founder",
    ],
    buttonText: "Become a Member",
    badge: "StayHere",
    retentionLine:
      "The plan members keep when they have kids, pets, or a finished basement.",
    stripeLink: "https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04",
  },
  {
    name: "Elite",
    displayName: "Whole-Home Care",
    tagline: "Everything about your home — handled.",
    cadence: "Two scheduled visits + a full project day each month",
    description:
      "Ongoing care, emergency coverage, and a dedicated project day every month.",
    price: 499,
    subtitle: "Everything in Home Protection",
    features: [
      "Two scheduled visits each month",
      "One full project day per month (up to 8 hours)",
      "Emergency response when something can't wait",
      "10% off home improvement projects (roofing, remodeling, kitchen)",
    ],
    buttonText: "Become a Member",
    retentionLine:
      "The plan that replaces the contractor list in your phone.",
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
    name: "Taras Bandura - General Manager",
    photo: "/images/Taras.png",
    thumb: "/images/Taras.png",
    blurb:
      "I founded Mr. Fixter to fix what’s broken in the handyman industry - unreliable scheduling, unclear pricing, and inconsistent quality. With 9+ years in construction and home services, I personally oversee customer support, approve bookings, and make sure every visit meets our standard. My goal is simple: make home service more affordable, more professional, and completely stress-free. If you ever have questions or need help, you can reach me directly 24/7 - you’re in good hands here.",
  },
  {
    id: 2,
    name: "Roman Hecha - Lead Handyman",
    photo: "/images/Roman.png",
    thumb: "/images/Roman.png",
    blurb:
      "Roman is our lead handyman and the standard-setter for quality at Mr. Fixter. He’s skilled across electrical, mounting, installations, and everyday home repairs - with a sharp eye for clean finishes and long-lasting results. Homeowners love him because he’s punctual, respectful, and explains the plan before he starts. He works fast, keeps the workspace clean, and treats every home like it’s his own.",
  },
];
