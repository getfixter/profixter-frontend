export type Service = {
  id: string;
  title: string;
  description: string;
  color: 'blue' | 'light' | 'dark';
  size: 'small' | 'normal' | 'large';
  offset: number;
};

export const services: Service[] = [
  { id: '01', title: 'Unlimited requests', description: 'One active job at a time; finish one - book the next.', color: 'blue', size: 'normal', offset: 0 },
  { id: '02', title: 'Basic improvements', description: 'Mount TVs/shelves, replace faucets/locks, hang fixtures, assemble furniture, etc.', color: 'light', size: 'normal', offset: 0 },
  { id: '03', title: 'Quick fixes', description: 'Outlets, leaks, cabinet hinges, caulk, drywall touch-ups, etc.', color: 'dark', size: 'small', offset: 0 },
  { id: '04', title: 'Store pickup & delivery', description: 'We pick up materials or supplies for your project at no extra cost.', color: 'blue', size: 'normal', offset: -50 },
  { id: '05', title: 'Standard materials included', description: 'We bring repair supplies. Specialty finishes billed at cost if needed.', color: 'dark', size: 'large', offset: -20 },
  { id: '06', title: '24/7 emergency help', description: 'Reach us anytime for urgent issues that can’t wait. By phone call 631-599-1363', color: 'dark', size: 'small', offset: -100 },
  { id: '07', title: 'Get 2 pros when needed', description: 'Extra hands for heavy lifting or complex tasks - included at no extra cost.', color: 'dark', size: 'normal', offset: 10 },
  { id: '08', title: 'Renovation consultation', description: 'Scope, estimate ranges, timelines, materials guidance, home improvement checking.', color: 'light', size: 'normal', offset: -20 },
  { id: '09', title: 'Seasonal property inspection', description: 'Regular seasonal assessments to spot maintenance needs early.', color: 'dark', size: 'large', offset: -30 },
  { id: '10', title: 'General Contractor', description: 'General contractor-level project management, with home-improvement discounts', color: 'blue', size: 'large', offset: -60 },
];

export type Plan = {
  name: 'Basic' | 'Plus' | 'Premium' | 'Elite';
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
    name: 'Basic',
    description: 'Great for steady small jobs',
    price: 149,
    features: ['Unlimited requests', 'Basic improvements', 'Quick fixes'],
    buttonText: 'Get started Free',
    stripeLink: 'https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02',
  },
  {
    name: 'Plus',
    description: 'More momentum each month',
    price: 249,
    subtitle: 'Everything in Basic',
    features: ['Store pickup & delivery', 'Standard materials included', 'Consultation'],
    buttonText: 'Get started Free',
    stripeLink: 'https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03',
  },
  {
    name: 'Premium',
    description: 'Most popular - 24/7 support',
    price: 349,
    subtitle: 'Everything in Plus',
    features: ['24/7 emergency help', 'Get 2 pros when needed', 'Renovation consultation'],
    buttonText: 'Get started Free',
    isPopular: true,
    stripeLink: 'https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04',
  },
  {
    name: 'Elite',
    description: 'For properties that need it all',
    price: 499,
    subtitle: 'Everything in Premium',
    features: ['Seasonal property inspection', 'General Contractor', 'Home Improvement discount'],
    buttonText: 'Get started Free',
    stripeLink: 'https://buy.stripe.com/5kQ28qeANaW8ac93ASawo01',
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
    name: 'Taras Bandura',
    photo: '/images/ttaras.png',
    thumb: '/images/ttaras.png',
    blurb:
      "Friendly, experienced, and always ready to help. Makes every home project stress-free. Always focused on quality and customer satisfaction. Favorite projects: Bring treats for your pets.",
  },
  {
    id: 2,
    name: 'Roman Hecha',
    photo: '/images/handymen2.png',
    thumb: '/images/handymen2.png',
    blurb: 'Detail-driven electrician and installer. Loves smart-home setups and clean finishes. Reliable and Proffetional.',
  },
  {
    id: 3,
    name: 'Jason Statham',
    photo: '/images/Jason.png',
    thumb: '/images/Jason.png',
    blurb: "Painter and finisher with a designer's eye. Passionate about refreshing spaces with precision, Temporarily on different job",
  },
  {
    id: 4,
    name: 'Ben Affleck',
    photo: '/images/Ben.png',
    thumb: '/images/Ben.png',
    blurb: "Hardworking and versatile handyman. Skilled in carpentry and general repairs. Always puts customer needs first. Temporarily Acting",
  },
];
