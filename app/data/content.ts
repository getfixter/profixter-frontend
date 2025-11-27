export type Service = {
  id: string;
  title: string;
  description: string;
  color: 'blue' | 'light' | 'dark';
  size: 'small' | 'normal' | 'large';
  offset: number;
};

export const services: Service[] = [
  { id: '01', title: 'Unlimited requests', description: 'One active job at a time; finish one — book the next.', color: 'blue', size: 'normal', offset: 0 },
  { id: '02', title: 'Basic improvements', description: 'Mount TVs/shelves, replace faucets/locks, hang fixtures, assemble furniture.', color: 'light', size: 'normal', offset: 0 },
  { id: '03', title: 'Quick fixes', description: 'Outlets, leaks, cabinet hinges, caulk, drywall touch-ups.', color: 'dark', size: 'small', offset: 0 },
  { id: '04', title: 'Standard materials included', description: 'We bring repair supplies. Specialty finishes billed at cost if needed.', color: 'blue', size: 'normal', offset: -50 },
  { id: '05', title: 'Consultation', description: 'Practical DIY & planning advice on-site or virtual.', color: 'dark', size: 'large', offset: -20 },
  { id: '06', title: 'Get 2 pros when needed', description: 'Safe lifting or added complexity.', color: 'dark', size: 'small', offset: -100 },
  { id: '07', title: 'Renovation consultation', description: 'Scope, estimate ranges, timelines, materials guidance.', color: 'dark', size: 'normal', offset: 10 },
  { id: '08', title: '24/7 emergency help', description: 'Scope, estimate ranges, timelines, materials guidance.', color: 'light', size: 'normal', offset: -20 },
  { id: '09', title: 'Seasonal property inspection', description: 'Regular seasonal assessments to spot maintenance needs early.', color: 'dark', size: 'large', offset: -30 },
  { id: '10', title: 'Exclusive discount', description: 'Best rates on bigger projects.', color: 'blue', size: 'large', offset: -60 },
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
    subtitle: 'Everything in Basic, plus',
    features: ['Standard materials included', 'Consultation'],
    buttonText: 'Get started Free',
    stripeLink: 'https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03',
  },
  {
    name: 'Premium',
    description: 'Most popular - priority slots',
    price: 349,
    subtitle: 'Everything in Plus, plus',
    features: ['Get 2 pros when needed', 'Renovation consultation', '24/7 emergency help'],
    buttonText: 'Get started Free',
    isPopular: true,
    stripeLink: 'https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04',
  },
  {
    name: 'Elite',
    description: 'For busy homes & properties',
    price: 449,
    subtitle: 'Everything in Premium, plus',
    features: ['Seasonal property inspection', 'Exclusive discount'],
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
    photo: '/images/handymen.png',
    thumb: '/images/handymen.png',
    blurb:
      "Friendly, experienced, and always ready to help. Makes every home project stress-free. Always focused on quality and customer satisfaction. Favorite projects: lighting setups and quick home improvements.",
  },
  {
    id: 2,
    name: 'Nazar Kovalenko',
    photo: '/images/handymen2.png',
    thumb: '/images/handymen2.png',
    blurb: 'Detail-driven electrician and installer. Loves smart-home setups and clean finishes. Reliable and fast.',
  },
  {
    id: 3,
    name: 'Iryna Melnyk',
    photo: '/images/handymen3.png',
    thumb: '/images/handymen3.png',
    blurb: "Painter and finisher with a designer's eye. Passionate about refreshing spaces with precision.",
  },
  {
    id: 4,
    name: 'Oleksii Chernyk',
    photo: '/images/handymen.png',
    thumb: '/images/handymen.png',
    blurb: 'Multiskill handyman: carpentry, drywall, and hardware fixes. Focused on tidy, durable results.',
  },
];
