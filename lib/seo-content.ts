export type CtaLink = {
  label: string;
  href: string;
};

export type SeoPageContent = {
  slug: string;
  title: string;
  shortTitle: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  homeownerNeed: string;
  goodFit: string[];
  notAFit?: string[];
  prepNotes: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  tertiaryCta: CtaLink;
  relatedServiceSlugs?: string[];
  relatedRenovationSlugs?: string[];
  relatedLocationSlugs?: string[];
};

export type ServiceAreaContent = {
  slug: string;
  name: string;
  county: "Suffolk County" | "Nassau County";
  /** The village and/or town the community sits in, as residents would say it. */
  municipality: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** What is specific about the place. Verifiable facts only; no invented detail. */
  localContext: string;
  /** Who issues building permits there (village vs town). */
  permits: string;
  /** When the first fall freeze typically arrives (NWS medians). */
  freeze: string;
  /** False keeps the page reachable but noindexed and out of the sitemap. */
  indexable: boolean;
  /** Nearby towns where Profixter has completed visits (lib/profixter-data.ts). */
  nearby: string[];
};

export type MembershipBenefit = {
  title: string;
  body: string;
};

export type ProjectCaseStudy = {
  slug: string;
  title: string;
  serviceSlug: string;
  locationSlug?: string;
  summary: string;
  image?: string;
};

export type HomeownerGuide = {
  slug: string;
  title: string;
  category: "maintenance" | "repair" | "renovation" | "safety" | "seasonal";
  summary: string;
};

export const membershipBenefits: MembershipBenefit[] = [
  {
    title: "Ongoing help without a new search",
    body: "Members have one place to request practical handyman help instead of finding a new contractor for every small task.",
  },
  {
    title: "Better long-term value",
    body: "Membership is designed for homeowners who expect more than one visit over time and want a simpler way to keep up with the house.",
  },
  {
    title: "More service flexibility",
    body: "Members can request ongoing maintenance and small repairs through the same account experience, subject to scope and appointment capacity.",
  },
  {
    title: "Useful before larger work",
    body: "Members may receive project discounts, and some larger projects may qualify for up to 12 months of Profixter Membership.",
  },
];

export const handymanServices: SeoPageContent[] = [
  {
    slug: "tv-mounting",
    title: "TV Mounting",
    shortTitle: "TV Mounting",
    metaTitle: "TV Mounting on Long Island | Profixter $99 Visit",
    metaDescription:
      "Need a TV mounted cleanly? Book a $99 Profixter visit for approved small tasks or become a Member for ongoing home help.",
    h1: "TV mounting help for Long Island homeowners.",
    intro:
      "Get practical help mounting a TV, placing it cleanly, and making sure the job fits the wall, room, and visit scope.",
    homeownerNeed: "I need a TV mounted without turning it into a weekend project.",
    goodFit: [
      "Mounting one TV on a suitable wall",
      "Helping position the TV at a comfortable viewing height",
      "Basic bracket installation when materials are ready",
      "Small wall hanging tasks that fit the visit scope",
    ],
    notAFit: [
      "Electrical outlet relocation",
      "In-wall wiring that requires licensed electrical work",
      "Large media wall construction",
      "Appliance repair",
    ],
    prepNotes: [
      "Have the TV, mount, hardware, and manufacturer instructions ready before the visit.",
      "Send photos of the wall and outlet area so the request can be reviewed before approval.",
      "If the job needs new wiring or an outlet moved, use a licensed electrical path instead of a handyman visit.",
    ],
    faq: [
      {
        question: "Can TV mounting be booked as a One-Time Visit?",
        answer:
          "Yes, when it is a straightforward mount on a suitable wall and the bracket/materials are ready.",
      },
      {
        question: "What if I need wires hidden inside the wall?",
        answer:
          "In-wall wiring or new electrical work may require a licensed electrician and is not treated as a simple handyman task.",
      },
      {
        question: "Does Profixter repair appliances during this visit?",
        answer: "No. Profixter does not offer appliance repair.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedServiceSlugs: ["furniture-assembly", "drywall-repair", "caulking"],
    relatedLocationSlugs: ["babylon", "west-babylon", "lindenhurst"],
  },
  {
    slug: "drywall-repair",
    title: "Drywall Repair",
    shortTitle: "Drywall Repair",
    metaTitle: "Small Drywall Repair on Long Island | Profixter",
    metaDescription:
      "Fix the small wall damage you keep noticing. Profixter helps Long Island homeowners with drywall patches that fit a focused visit.",
    h1: "Small drywall repair before it gets ignored again.",
    intro:
      "Profixter helps with small wall patches and everyday drywall damage that fits a focused handyman visit.",
    homeownerNeed: "I have a small hole, dent, or damaged wall area that needs attention.",
    goodFit: [
      "Small drywall holes",
      "Minor wall patching",
      "Prepping a small damaged area for paint",
      "Damage from mounting, door handles, or ordinary wear",
    ],
    notAFit: [
      "Large water-damaged walls",
      "Mold remediation",
      "Full room drywall installation",
      "Structural repair",
      "Appliance repair",
    ],
    prepNotes: [
      "Send a clear photo with something nearby for scale so the damaged area can be reviewed.",
      "Tell us whether the area is dry, actively leaking, soft, stained, or recently repaired.",
      "If the damage is large, wet, mold-related, or structural, request a renovation estimate instead.",
    ],
    faq: [
      {
        question: "Can small drywall repair fit a One-Time Visit?",
        answer:
          "Often yes, for small holes, dents, and patching work that fits the 90-minute visit scope.",
      },
      {
        question: "What if there is water damage?",
        answer:
          "Water damage should be reviewed carefully first. Active leaks, mold, or large damaged areas are not a simple handyman visit.",
      },
      {
        question: "Can Profixter paint the repaired area?",
        answer:
          "Small prep or touch-up work may fit when materials are ready, but larger paint work belongs in a larger scope conversation.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Request Renovation Estimate", href: "/projects#estimate" },
    relatedServiceSlugs: ["caulking", "door-repair", "tv-mounting"],
    relatedLocationSlugs: ["babylon", "west-islip", "bay-shore"],
  },
  {
    slug: "door-repair",
    title: "Door Repair",
    shortTitle: "Door Repair",
    metaTitle: "Door Repair on Long Island | Profixter Handyman",
    metaDescription:
      "Sticking, loose, or misaligned door? Book a focused handyman visit or become a Member for ongoing Long Island home maintenance.",
    h1: "Door repair for the small things that make a home feel off.",
    intro:
      "A sticking, loose, or misaligned door can be a daily annoyance. Profixter helps with practical door fixes that fit a small handyman visit.",
    homeownerNeed: "A door sticks, rubs, will not latch cleanly, or needs a small repair.",
    goodFit: [
      "Door adjustments",
      "Loose hinge help",
      "Small latch and strike plate issues",
      "Interior door repair tasks that fit the visit scope",
    ],
    notAFit: [
      "Major exterior door replacement",
      "Structural framing repair",
      "Custom door installation projects",
      "Locksmith emergency work",
      "Appliance repair",
    ],
    prepNotes: [
      "Send photos of the door, hinges, latch, and frame so the issue can be reviewed before approval.",
      "Tell us whether the door sticks, rubs, will not latch, or feels loose.",
      "Exterior replacements, frame damage, and lock emergencies should use a specialist or renovation estimate path.",
    ],
    faq: [
      {
        question: "Can a sticking door be a One-Time Visit?",
        answer:
          "Usually, if it is a small adjustment, hinge issue, or latch alignment task within handyman scope.",
      },
      {
        question: "Do you replace full exterior doors?",
        answer:
          "Major exterior door replacement or framing work should be reviewed as a larger project, not a small visit.",
      },
      {
        question: "Do you handle locksmith emergencies?",
        answer:
          "No. Lockout or urgent locksmith work should go to a qualified locksmith.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Request Renovation Estimate", href: "/projects#estimate" },
    relatedServiceSlugs: ["drywall-repair", "caulking", "light-fixture-installation"],
    relatedLocationSlugs: ["west-babylon", "islip", "copiague"],
  },
  {
    slug: "light-fixture-installation",
    title: "Light Fixture Installation",
    shortTitle: "Light Fixtures",
    metaTitle: "Light Fixture Replacement on Long Island | Profixter",
    metaDescription:
      "Bought a new light fixture? Profixter helps with simple fixture replacements when existing wiring and scope are suitable.",
    h1: "Light fixture replacement, handled carefully.",
    intro:
      "Profixter can help with simple light fixture replacement when the existing wiring and box are suitable for the new fixture.",
    homeownerNeed: "I bought a new fixture and want help replacing the old one.",
    goodFit: [
      "Replacing a light fixture where wiring already exists",
      "Simple fixture swaps",
      "Ceiling or wall fixture help within scope",
      "Home maintenance tasks that need tools and care",
    ],
    notAFit: [
      "New electrical runs",
      "Panel work",
      "Unsafe or damaged wiring",
      "Major electrical troubleshooting",
      "Appliance repair",
    ],
    prepNotes: [
      "Have the new fixture, mounting hardware, and instructions ready.",
      "Send photos of the existing fixture and electrical box area before checkout.",
      "If wiring is damaged, missing, unsafe, or needs to be relocated, use a licensed electrician.",
    ],
    faq: [
      {
        question: "Can Profixter replace a light fixture?",
        answer:
          "Yes, when it is a simple replacement using existing suitable wiring and the new fixture is ready.",
      },
      {
        question: "Do you do new electrical wiring?",
        answer:
          "No. New wiring, panel work, unsafe wiring, or electrical troubleshooting should be handled by a qualified licensed professional.",
      },
      {
        question: "What if the fixture is heavy or unusual?",
        answer:
          "Share photos and product details first so the request can be reviewed before approval.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedServiceSlugs: ["tv-mounting", "door-repair", "furniture-assembly"],
    relatedLocationSlugs: ["lindenhurst", "amityville", "west-islip"],
  },
  {
    slug: "furniture-assembly",
    title: "Furniture Assembly",
    shortTitle: "Furniture Assembly",
    metaTitle: "Furniture Assembly on Long Island | Profixter",
    metaDescription:
      "Get small furniture assembled without losing the afternoon. Book a Profixter visit or become a Member for ongoing home help.",
    h1: "Furniture assembly without losing the afternoon.",
    intro:
      "Profixter helps with small furniture assembly tasks that fit within a focused handyman visit.",
    homeownerNeed: "I bought something for the house and want it assembled correctly.",
    goodFit: [
      "Small furniture assembly",
      "Shelves, simple pieces, and household items",
      "Assembly tasks with parts and instructions available",
      "Small fixes around the room during the same visit if time allows",
    ],
    notAFit: [
      "Large multi-room assembly projects",
      "Commercial furniture installation",
      "Built-in cabinetry",
      "Moving heavy items between floors",
      "Appliance repair",
    ],
    prepNotes: [
      "Have all boxes, parts, hardware, and instructions in the room where the item will be assembled.",
      "Tell us the item brand/model and whether wall anchoring is needed.",
      "Large built-ins, heavy moves, or multi-room assembly work may need a different project path.",
    ],
    faq: [
      {
        question: "What kind of furniture assembly fits?",
        answer:
          "Small household furniture and simple pieces usually fit when parts and instructions are ready.",
      },
      {
        question: "Can Profixter move heavy furniture?",
        answer:
          "Heavy moving between floors or large delivery-style work is not the right fit for a One-Time Visit.",
      },
      {
        question: "Can you anchor furniture to the wall?",
        answer:
          "Small anchoring tasks may fit if the wall is suitable and the required hardware is available.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedServiceSlugs: ["tv-mounting", "caulking", "door-repair"],
    relatedLocationSlugs: ["bay-shore", "islip", "copiague"],
  },
  {
    slug: "caulking",
    title: "Caulking and Sealing",
    shortTitle: "Caulking",
    metaTitle: "Caulking & Sealing Help on Long Island | Profixter",
    metaDescription:
      "Refresh worn caulk around tubs, sinks, trim, and small gaps before they become bigger home maintenance problems.",
    h1: "Caulking and sealing for the gaps homeowners keep noticing.",
    intro:
      "Worn caulk and small gaps can make a home feel unfinished. Profixter helps with focused caulking and sealing tasks that fit visit scope.",
    homeownerNeed: "I need old or worn caulk refreshed around a small area.",
    goodFit: [
      "Small caulking refreshes",
      "Sealing around tubs, sinks, trim, and small gaps",
      "Preventive home maintenance tasks",
      "A practical fix before a bigger moisture issue appears",
    ],
    notAFit: [
      "Mold remediation",
      "Waterproofing failures",
      "Major tile or shower reconstruction",
      "Hidden leak repair",
      "Appliance repair",
    ],
    prepNotes: [
      "Send photos of the area and mention whether there is active moisture, mold, or a known leak.",
      "Have the preferred caulk or sealant ready if you want a specific product or color.",
      "If the issue suggests hidden water damage, use a renovation estimate or specialist path instead.",
    ],
    faq: [
      {
        question: "Can caulking be booked as a One-Time Visit?",
        answer:
          "Yes, for focused caulking or sealing tasks around small areas like tubs, sinks, trim, or gaps.",
      },
      {
        question: "What if there is mold or active leaking?",
        answer:
          "Mold, active leaks, and waterproofing failures need deeper review and are not a simple caulking visit.",
      },
      {
        question: "Do I need to provide materials?",
        answer:
          "Please prepare or provide materials when a specific sealant, color, or product is needed.",
      },
    ],
    primaryCta: { label: "Book One-Time Visit", href: "/book" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Request Bathroom Estimate", href: "/projects?type=bathroom#estimate" },
    relatedServiceSlugs: ["drywall-repair", "door-repair", "light-fixture-installation"],
    relatedRenovationSlugs: ["bathroom-remodeling"],
    relatedLocationSlugs: ["babylon", "west-babylon", "amityville"],
  },
];

export const renovationServices: SeoPageContent[] = [
  {
    slug: "bathroom-remodeling",
    title: "Bathroom Remodeling",
    shortTitle: "Bathroom Remodeling",
    metaTitle: "Bathroom Remodeling Long Island | Plan with Profixter",
    metaDescription:
      "Plan tile, fixtures, waterproofing, layout, and scope before the mess starts. Request a clear bathroom remodeling estimate.",
    h1: "Bathroom remodeling planned before the mess starts.",
    intro:
      "Bathrooms are small rooms with a lot of moving parts. Profixter helps homeowners think through scope, finishes, waterproofing, schedule, and estimate next steps.",
    homeownerNeed: "I want a new bathroom and need a real estimate path.",
    goodFit: [
      "Shower, tub, vanity, tile, and fixture planning",
      "Bathroom updates that need coordination",
      "Wet-area details that should be reviewed carefully",
      "Homeowners who want one accountable project path",
    ],
    notAFit: [
      "Emergency plumbing response",
      "Appliance repair",
      "Unscoped work without a project review",
    ],
    prepNotes: [
      "Share photos, rough dimensions, inspiration, and what you want to change.",
      "Think through must-haves, nice-to-haves, and any known water or ventilation concerns.",
      "Use the estimate form for the first project conversation; do not try to squeeze a remodel into a One-Time Visit.",
    ],
    faq: [
      {
        question: "Is bathroom remodeling part of the One-Time Visit?",
        answer:
          "No. Bathroom remodeling is larger project work and should start with a renovation estimate.",
      },
      {
        question: "Can Profixter help review a bathroom quote?",
        answer:
          "Yes. Profixter AI can help you think through a quote or agreement as practical opinion, not legal advice.",
      },
      {
        question: "Do Members get renovation benefits?",
        answer:
          "Members may receive project discounts, and some larger projects may qualify for up to 12 months of Profixter Membership.",
      },
    ],
    primaryCta: { label: "Request Bathroom Estimate", href: "/projects?type=bathroom#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedRenovationSlugs: ["kitchen-remodeling", "full-home-renovation"],
    relatedLocationSlugs: ["babylon", "lindenhurst", "west-islip"],
  },
  {
    slug: "kitchen-remodeling",
    title: "Kitchen Remodeling",
    shortTitle: "Kitchen Remodeling",
    metaTitle: "Kitchen Remodeling Long Island | Plan with Profixter",
    metaDescription:
      "Turn kitchen ideas into a clearer project path for layout, cabinets, counters, backsplash, lighting, and coordination.",
    h1: "Kitchen remodeling with the scope organized first.",
    intro:
      "A kitchen project works better when layout, cabinets, counters, backsplash, lighting, and trade coordination are understood before demolition.",
    homeownerNeed: "I want to remodel a kitchen and need help turning the idea into a project.",
    goodFit: [
      "Kitchen layout and finish planning",
      "Cabinets, counters, backsplash, and lighting coordination",
      "Larger updates that need a written estimate",
      "Homeowners who want a cleaner path from idea to scope",
    ],
    notAFit: [
      "Appliance repair",
      "Emergency plumbing or electrical response",
      "Single small handyman tasks better suited for One-Time Visit",
    ],
    prepNotes: [
      "Share photos, layout goals, cabinet/counter ideas, and any appliance coordination needs.",
      "Separate must-have changes from cosmetic upgrades so the first estimate conversation is focused.",
      "Use the estimate path for layout, cabinet, counter, lighting, and trade coordination work.",
    ],
    faq: [
      {
        question: "Does Profixter repair kitchen appliances?",
        answer:
          "No. Profixter can coordinate renovation planning around appliances, but does not offer appliance repair.",
      },
      {
        question: "Can I ask Profixter AI to review a kitchen quote?",
        answer:
          "Yes. Upload a quote or agreement for practical homeowner guidance, not legal advice.",
      },
      {
        question: "What if I only need one small kitchen fix?",
        answer:
          "A focused small task may fit Book Handyman. Larger layout or finish work belongs in the renovation estimate path.",
      },
    ],
    primaryCta: { label: "Request Kitchen Estimate", href: "/projects?type=kitchen#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Review a Quote with AI", href: "/home-support" },
    relatedRenovationSlugs: ["bathroom-remodeling", "full-home-renovation"],
    relatedLocationSlugs: ["west-babylon", "bay-shore", "islip"],
  },
  {
    slug: "roofing",
    title: "Roofing",
    shortTitle: "Roofing",
    metaTitle: "Roofing Long Island | Estimates from Profixter",
    metaDescription:
      "Need a new roof or comparing quotes? Profixter helps Long Island homeowners plan roofing scope, cleanup, and estimate next steps.",
    h1: "Roofing estimates for Long Island homes.",
    intro:
      "Profixter helps homeowners plan larger roofing work with clear scope, cleanup expectations, and project coordination.",
    homeownerNeed: "I need new roofing or a larger roofing project reviewed.",
    goodFit: [
      "Roof replacement conversations",
      "Shingle, ventilation, flashing, and material planning",
      "Larger roofing work that needs an estimate",
      "Homeowners who want clear cleanup and project coordination",
    ],
    notAFit: [
      "Urgent storm response",
      "Small roof leak diagnostics without project review",
      "Appliance repair",
    ],
    prepNotes: [
      "Share roof photos, known leak locations, approximate roof age, and any previous repair history.",
      "Tell us whether you are comparing replacement options or trying to understand a contractor quote.",
      "Urgent storm damage or active safety issues should go to appropriate emergency or specialist help.",
    ],
    faq: [
      {
        question: "Is roofing a One-Time Visit service?",
        answer:
          "No. Roofing is larger exterior project work and should start with a renovation estimate.",
      },
      {
        question: "How long does a roof replacement usually take?",
        answer:
          "Standard roof replacements are usually completed in 1 day, depending on scope, conditions, and project review.",
      },
      {
        question: "Is there a labor warranty?",
        answer:
          "Qualifying roofing work may include a 5-year labor warranty. Final warranty terms are reviewed with the estimate.",
      },
    ],
    primaryCta: { label: "Request Roofing Estimate", href: "/projects?type=roofing#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedRenovationSlugs: ["siding", "full-home-renovation"],
    relatedLocationSlugs: ["babylon", "west-islip", "amityville"],
  },
  {
    slug: "siding",
    title: "Siding",
    shortTitle: "Siding",
    metaTitle: "Siding Long Island | Custom Estimates from Profixter",
    metaDescription:
      "Explore siding replacement with custom exterior options, trim details, colors, and a clear estimate path for your home.",
    h1: "Siding that protects the home and changes how it feels.",
    intro:
      "New siding should protect the home and improve curb appeal. Profixter helps homeowners compare options, details, colors, and project scope.",
    homeownerNeed: "I want new siding or a better exterior look.",
    goodFit: [
      "Siding replacement planning",
      "Trim, soffit, fascia, and exterior detail coordination",
      "Color and profile conversations",
      "Larger exterior projects that need a clear estimate",
    ],
    notAFit: [
      "Emergency storm response",
      "Tiny exterior repairs better suited for membership review",
      "Appliance repair",
    ],
    prepNotes: [
      "Share exterior photos, style goals, color ideas, and areas where existing siding has issues.",
      "Think about trim, soffit, fascia, and other exterior details before the first estimate conversation.",
      "For tiny exterior fixes, Membership or a separate review may be a better path than a full siding estimate.",
    ],
    faq: [
      {
        question: "Is siding handled through a renovation estimate?",
        answer:
          "Yes. Siding replacement and larger exterior updates belong in the renovation estimate path.",
      },
      {
        question: "Can the siding look custom?",
        answer:
          "Yes. The estimate conversation can include profile, color, trim, and detail choices for a more custom exterior look.",
      },
      {
        question: "Is there a labor warranty?",
        answer:
          "Qualifying siding work may include a 5-year labor warranty. Final warranty terms are reviewed with the estimate.",
      },
    ],
    primaryCta: { label: "Request Siding Estimate", href: "/projects?type=siding#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedRenovationSlugs: ["roofing", "full-home-renovation"],
    relatedLocationSlugs: ["lindenhurst", "copiague", "bay-shore"],
  },
  {
    slug: "full-home-renovation",
    title: "Full Home Renovation",
    shortTitle: "Full Home Renovation",
    metaTitle: "Full Home Renovation Long Island | Profixter Project Path",
    metaDescription:
      "Renovating more than one room? Organize scope, sequencing, finishes, and project coordination before work begins.",
    h1: "Full home renovation, organized before it begins.",
    intro:
      "Whole-home work needs sequencing, priorities, trades, and decisions organized early. Profixter helps turn a large idea into a clearer project path.",
    homeownerNeed: "I want to renovate multiple parts of the house and need a project conversation.",
    goodFit: [
      "Multi-room renovation planning",
      "Kitchen, bathroom, flooring, walls, and finish coordination",
      "Phased or full-scope project planning",
      "A single General Contractor relationship",
    ],
    notAFit: [
      "Small single-task handyman work",
      "Unverified project examples or fake before-and-after claims",
      "Appliance repair",
    ],
    prepNotes: [
      "Start with priorities: which rooms matter most, what must change, and what can wait.",
      "Gather photos, inspiration, and any existing contractor notes or quotes.",
      "Use Profixter AI to organize questions before requesting a renovation estimate if the scope feels unclear.",
    ],
    faq: [
      {
        question: "When is a project considered full-home renovation?",
        answer:
          "When multiple rooms, phases, finishes, or trade scopes need to be coordinated under one larger project plan.",
      },
      {
        question: "Can the work be phased?",
        answer:
          "Yes. Phasing can be discussed during the estimate process when it makes sense for the home and budget.",
      },
      {
        question: "Can Membership help during larger work?",
        answer:
          "Membership can be useful for ongoing home care, and eligible larger projects may include up to 12 months of Profixter Membership.",
      },
    ],
    primaryCta: { label: "Request Renovation Estimate", href: "/projects?type=other#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedRenovationSlugs: ["kitchen-remodeling", "bathroom-remodeling", "new-home-construction"],
    relatedLocationSlugs: ["babylon", "west-babylon", "west-islip"],
  },
  {
    slug: "new-home-construction",
    title: "New Home Construction",
    shortTitle: "New Home Construction",
    metaTitle: "New Home Construction Long Island | Profixter GC Path",
    metaDescription:
      "Start a serious new construction conversation with planning, coordination, trades, schedule, and construction management in mind.",
    h1: "New home construction with a General Contractor path.",
    intro:
      "Building a new home requires planning, coordination, trades, schedule, and construction management. Profixter can start that conversation through the renovation estimate path.",
    homeownerNeed: "I want to build a new house and need a clear first conversation.",
    goodFit: [
      "New home project conversations",
      "Planning, permitting, and trade coordination discussions",
      "Construction management scope review",
      "Homeowners who need a General Contractor relationship",
    ],
    notAFit: [
      "Small handyman visits",
      "Emergency response work",
      "Appliance repair",
    ],
    prepNotes: [
      "Prepare any drawings, land or property details, inspiration, timeline thoughts, and known constraints.",
      "Expect the first step to be a serious scope and coordination conversation, not a quick quote.",
      "Use the estimate form to start the discussion with the right project context.",
    ],
    faq: [
      {
        question: "Does Profixter build new houses?",
        answer:
          "Profixter can start new home construction conversations through a General Contractor project path.",
      },
      {
        question: "Is new construction the same as a renovation estimate?",
        answer:
          "It uses the same estimate intake path, but the scope is reviewed as new construction and construction management work.",
      },
      {
        question: "Is this available as a small handyman visit?",
        answer:
          "No. New home construction is larger project work, not a One-Time Visit.",
      },
    ],
    primaryCta: { label: "Discuss New Construction", href: "/projects?type=build-new-house#estimate" },
    secondaryCta: { label: "Become a Member", href: "/membership/plans" },
    tertiaryCta: { label: "Ask Profixter AI", href: "/home-support" },
    relatedRenovationSlugs: ["full-home-renovation", "roofing", "siding"],
    relatedLocationSlugs: ["babylon", "lindenhurst", "bay-shore"],
  },
];

/**
 * Town pages: only towns with real Profixter work, each saying something true
 * and useful about that place.
 *
 * WHAT A TOWN PAGE MAY SAY (October 2026 final pass)
 *  - Geography and municipality: which village or town it sits in. These decide
 *    who issues building permits, which is genuinely useful to a homeowner and
 *    differs from page to page.
 *  - When the first fall freeze typically arrives there (National Weather
 *    Service medians: about November 1 in Suffolk and northern Nassau, about
 *    November 11 on the Nassau South Shore).
 *  - Profixter's own record there, only where three or more customers are
 *    behind it (lib/profixter-data.ts), and nearby towns with completed visits.
 *  - NOT unsourced claims about the age or style of local housing, and not
 *    copy that only swaps the town name.
 *
 * `indexable: false` keeps a page reachable (it existed before) but out of the
 * index and the sitemap until there is real work to show there: Copiague and
 * Islip each have a handful of visits from a single customer.
 */
export const serviceAreas: ServiceAreaContent[] = [
  {
    slug: "lindenhurst",
    name: "Lindenhurst",
    county: "Suffolk County",
    municipality: "Village of Lindenhurst, Town of Babylon",
    metaTitle: "Handyman in Lindenhurst, NY | Profixter",
    metaDescription:
      "Profixter works out of Lindenhurst and has done more visits here than anywhere else on Long Island. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in Lindenhurst.",
    intro:
      "Lindenhurst is where Profixter is based, and it is the town where the team has worked for the most customers - single jobs, free first visits and members who book visits as their list grows.",
    localContext:
      "Lindenhurst is an incorporated village in the Town of Babylon, on the Great South Bay. Mailing addresses marked Lindenhurst also reach past the village line into unincorporated parts of the town.",
    permits:
      "Inside the village, building permits come from the Village of Lindenhurst. Lindenhurst addresses outside the village line go to the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["West Babylon", "North Babylon", "Babylon", "Amityville", "West Islip"],
    indexable: true,
  },
  {
    slug: "west-babylon",
    name: "West Babylon",
    county: "Suffolk County",
    municipality: "Town of Babylon",
    metaTitle: "Handyman in West Babylon, NY | Profixter",
    metaDescription:
      "Handyman visits in West Babylon from a team based next door in Lindenhurst. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in West Babylon.",
    intro:
      "West Babylon borders Lindenhurst, where Profixter is based, and it is one of the towns the team works in most often.",
    localContext:
      "West Babylon is an unincorporated hamlet in the Town of Babylon, between Lindenhurst and North Babylon.",
    permits: "West Babylon is not an incorporated village, so building permits come from the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["Lindenhurst", "North Babylon", "Babylon", "Deer Park", "Amityville"],
    indexable: true,
  },
  {
    slug: "north-babylon",
    name: "North Babylon",
    county: "Suffolk County",
    municipality: "Town of Babylon",
    metaTitle: "Handyman in North Babylon, NY | Profixter",
    metaDescription:
      "Handyman visits in North Babylon, a few minutes from Profixter's Lindenhurst base. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in North Babylon.",
    intro: "North Babylon is a few minutes from Profixter's base, and the team has a steady record of visits here.",
    localContext:
      "North Babylon is an unincorporated hamlet in the Town of Babylon, home to Belmont Lake State Park.",
    permits: "North Babylon is not an incorporated village, so building permits come from the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["West Babylon", "Lindenhurst", "Babylon", "Deer Park", "West Islip"],
    indexable: true,
  },
  {
    slug: "babylon",
    name: "Babylon",
    county: "Suffolk County",
    municipality: "Village of Babylon, Town of Babylon",
    metaTitle: "Handyman in Babylon Village, NY | Profixter",
    metaDescription:
      "Handyman visits in Babylon from a Town of Babylon team based in Lindenhurst. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in Babylon.",
    intro: "Profixter is based in the Town of Babylon and works in Babylon Village regularly.",
    localContext:
      "Babylon Village is an incorporated village on the Great South Bay, at the center of the town that shares its name.",
    permits:
      "Inside the village, building permits come from the Village of Babylon. Babylon addresses outside the village line go to the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["West Babylon", "North Babylon", "Lindenhurst", "West Islip", "Amityville"],
    indexable: true,
  },
  {
    slug: "amityville",
    name: "Amityville",
    county: "Suffolk County",
    municipality: "Village of Amityville, Town of Babylon",
    metaTitle: "Handyman in Amityville, NY | Profixter",
    metaDescription:
      "Handyman visits in Amityville from a Town of Babylon team based in Lindenhurst. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in Amityville.",
    intro:
      "Amityville is at the western edge of the Town of Babylon, a short drive from Profixter's base. The team has completed visits in Amityville and neighboring Amity Harbor.",
    localContext: "Amityville is an incorporated village on the South Shore, right at the Nassau-Suffolk line.",
    permits:
      "Inside the village, building permits come from the Village of Amityville. Amityville addresses outside the village line, including Amity Harbor, go to the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["Lindenhurst", "West Babylon", "Massapequa", "Babylon"],
    indexable: true,
  },
  {
    slug: "copiague",
    name: "Copiague",
    county: "Suffolk County",
    municipality: "Town of Babylon",
    metaTitle: "Handyman in Copiague, NY | Profixter",
    metaDescription:
      "Handyman visits in Copiague from a team based next door in Lindenhurst. One-Time Visits from $99 or a handyman membership from $149/month.",
    h1: "Handyman help in Copiague.",
    intro: "Copiague borders Lindenhurst, where Profixter is based.",
    localContext: "Copiague is an unincorporated hamlet in the Town of Babylon, between Lindenhurst and Amityville.",
    permits: "Copiague is not an incorporated village, so building permits come from the Town of Babylon.",
    freeze: "around November 1",
    nearby: ["Lindenhurst", "Amityville", "West Babylon", "Babylon"],
    indexable: false,
  },
  {
    slug: "west-islip",
    name: "West Islip",
    county: "Suffolk County",
    municipality: "Town of Islip",
    metaTitle: "Handyman in West Islip, NY | Profixter",
    metaDescription:
      "Handyman visits in West Islip, just across the Babylon town line from Profixter's base. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in West Islip.",
    intro: "West Islip sits just east of the Town of Babylon line, a short drive from Profixter's base in Lindenhurst.",
    localContext: "West Islip is an unincorporated hamlet in the Town of Islip, on the Great South Bay.",
    permits: "West Islip is not an incorporated village, so building permits come from the Town of Islip.",
    freeze: "around November 1",
    nearby: ["Babylon", "Bay Shore", "North Babylon", "Lindenhurst"],
    indexable: true,
  },
  {
    slug: "bay-shore",
    name: "Bay Shore",
    county: "Suffolk County",
    municipality: "Town of Islip",
    metaTitle: "Handyman in Bay Shore, NY | Profixter",
    metaDescription:
      "Handyman visits in Bay Shore. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month, from a team with a steady record of work here.",
    h1: "Handyman help in Bay Shore.",
    intro: "Bay Shore is the Town of Islip community where Profixter has worked for the most customers.",
    localContext: "Bay Shore is an unincorporated hamlet in the Town of Islip, on the Great South Bay.",
    permits: "Bay Shore is not an incorporated village, so building permits come from the Town of Islip.",
    freeze: "around November 1",
    nearby: ["West Islip", "Babylon", "Sayville", "Brentwood"],
    indexable: true,
  },
  {
    slug: "islip",
    name: "Islip",
    county: "Suffolk County",
    municipality: "Town of Islip",
    metaTitle: "Handyman in Islip, NY | Profixter",
    metaDescription:
      "Handyman visits in Islip. One-Time Visits from $99 or a handyman membership from $149/month, from a Long Island team that works across the Town of Islip.",
    h1: "Handyman help in Islip.",
    intro: "Profixter works in the Town of Islip, most often in Bay Shore and West Islip.",
    localContext: "Islip is an unincorporated hamlet on the South Shore, in the town of the same name.",
    permits: "Islip hamlet is not an incorporated village, so building permits come from the Town of Islip.",
    freeze: "around November 1",
    nearby: ["Bay Shore", "West Islip", "Sayville"],
    indexable: false,
  },
  {
    slug: "massapequa",
    name: "Massapequa",
    county: "Nassau County",
    municipality: "Town of Oyster Bay",
    metaTitle: "Handyman in Massapequa, NY | Profixter",
    metaDescription:
      "Handyman visits in Massapequa, just across the county line from Profixter's base. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in Massapequa.",
    intro:
      "Massapequa is just across the county line from Profixter's base in the Town of Babylon, and it is the Nassau town where the team has worked for the most customers.",
    localContext:
      "Massapequa is an unincorporated hamlet on the Nassau South Shore, in the Town of Oyster Bay. Its neighbor Massapequa Park is a separate incorporated village.",
    permits:
      "Massapequa is not an incorporated village, so building permits come from the Town of Oyster Bay. Homes inside the Village of Massapequa Park go to the village instead.",
    freeze: "around November 11",
    nearby: ["Seaford", "Amityville", "South Farmingdale", "Farmingdale"],
    indexable: true,
  },
  {
    slug: "seaford",
    name: "Seaford",
    county: "Nassau County",
    municipality: "Town of Hempstead",
    metaTitle: "Handyman in Seaford, NY | Profixter",
    metaDescription:
      "Handyman visits in Seaford. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month, from a team that works here regularly.",
    h1: "Handyman help in Seaford.",
    intro: "Seaford is one of the Nassau South Shore towns where Profixter works regularly.",
    localContext:
      "Seaford is an unincorporated hamlet on the Nassau South Shore, in the Town of Hempstead, between Wantagh and Massapequa.",
    permits: "Seaford is not an incorporated village, so building permits come from the Town of Hempstead.",
    freeze: "around November 11",
    nearby: ["Massapequa", "Wantagh", "Bellmore", "South Farmingdale"],
    indexable: true,
  },
  {
    slug: "farmingdale",
    name: "Farmingdale",
    county: "Nassau County",
    municipality: "Village of Farmingdale, Town of Oyster Bay",
    metaTitle: "Handyman in Farmingdale, NY | Profixter",
    metaDescription:
      "Handyman visits in Farmingdale and South Farmingdale. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month.",
    h1: "Handyman help in Farmingdale.",
    intro:
      "Farmingdale is a short drive west of Profixter's base. The team works here and in neighboring South Farmingdale and Old Bethpage.",
    localContext:
      "Farmingdale is an incorporated village in the Town of Oyster Bay, on the Nassau side of the county line. Farmingdale mailing addresses also cover unincorporated areas around the village.",
    permits:
      "Inside the village, building permits come from the Village of Farmingdale. Farmingdale and South Farmingdale addresses outside the village line go to the Town of Oyster Bay.",
    freeze: "in early to mid November",
    nearby: ["South Farmingdale", "Massapequa", "Old Bethpage", "North Babylon"],
    indexable: true,
  },
  {
    slug: "syosset",
    name: "Syosset",
    county: "Nassau County",
    municipality: "Town of Oyster Bay",
    metaTitle: "Handyman in Syosset, NY | Profixter",
    metaDescription:
      "Handyman visits in Syosset. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month, from a team that works here regularly.",
    h1: "Handyman help in Syosset.",
    intro: "Syosset is the northern Nassau town where Profixter works most often.",
    localContext: "Syosset is an unincorporated hamlet in the Town of Oyster Bay, in northern Nassau.",
    permits: "Syosset is not an incorporated village, so building permits come from the Town of Oyster Bay.",
    freeze: "around November 1",
    nearby: ["Old Bethpage", "Laurel Hollow", "Huntington", "Glen Head"],
    indexable: true,
  },
  {
    slug: "huntington",
    name: "Huntington",
    county: "Suffolk County",
    municipality: "Town of Huntington",
    metaTitle: "Handyman in Huntington, NY | Profixter",
    metaDescription:
      "Handyman visits in Huntington. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month, from a team working across the Town of Huntington.",
    h1: "Handyman help in Huntington.",
    intro:
      "Profixter works across the Town of Huntington: Huntington itself, East Northport, Dix Hills and Commack.",
    localContext:
      "Huntington is an unincorporated hamlet on the North Shore of western Suffolk, the center of the Town of Huntington.",
    permits:
      "Huntington hamlet is not an incorporated village, so building permits come from the Town of Huntington. Homes inside one of the town's incorporated villages go to that village instead.",
    freeze: "around November 1",
    nearby: ["East Northport", "Dix Hills", "Commack", "Syosset"],
    indexable: true,
  },
  {
    slug: "east-northport",
    name: "East Northport",
    county: "Suffolk County",
    municipality: "Town of Huntington",
    metaTitle: "Handyman in East Northport, NY | Profixter",
    metaDescription:
      "Handyman visits in East Northport. One-Time Visits from $99, a free first visit for new customers, or a handyman membership from $149/month, from a team working across the Town of Huntington.",
    h1: "Handyman help in East Northport.",
    intro: "East Northport is one of the Town of Huntington communities where Profixter works regularly.",
    localContext:
      "East Northport is an unincorporated hamlet in the Town of Huntington, south of the incorporated Village of Northport.",
    permits:
      "East Northport is not an incorporated village, so building permits come from the Town of Huntington. Homes inside the Village of Northport go to the village instead.",
    freeze: "around November 1",
    nearby: ["Huntington", "Commack", "Dix Hills", "Smithtown"],
    indexable: true,
  },
];

export const futureProjectCaseStudies: ProjectCaseStudy[] = [];
export const homeownerGuides: HomeownerGuide[] = [];

export const seoHubRoutes = [
  { path: "/services", changeFrequency: "monthly", priority: 0.76 },
  { path: "/renovations", changeFrequency: "monthly", priority: 0.82 },
  { path: "/locations", changeFrequency: "monthly", priority: 0.68 },
] as const;

export function getHandymanService(slug: string) {
  return handymanServices.find((service) => service.slug === slug);
}

export function getRenovationService(slug: string) {
  return renovationServices.find((service) => service.slug === slug);
}

export function getServiceArea(slug: string) {
  return serviceAreas.find((area) => area.slug === slug);
}

export function getSeoEngineSitemapRoutes() {
  return [
    ...seoHubRoutes,
    ...handymanServices.map((service) => ({
      path: `/services/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.64,
    })),
    ...renovationServices.map((service) => ({
      path: `/renovations/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.72,
    })),
    ...serviceAreas.filter((area) => area.indexable).map((area) => ({
      path: `/locations/${area.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.58,
    })),
  ];
}
