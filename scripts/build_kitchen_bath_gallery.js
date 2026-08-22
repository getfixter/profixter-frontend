/**
 * Builds the /kitchen-bathroom gallery from the real project photography in
 * `public/Bath And Kitchen`.
 *
 * The source folder is camera output: 12 megapixel, 2-5 MB JPEGs with EXIF
 * rotation, plus a set of smaller social exports. Handing those to next/image
 * means the optimizer decodes 12MP on every cache miss, so they are resized
 * once, here, into web-sized WebP under `public/images/kitchen-bath/`.
 *
 * Source files are never modified. This script only reads them.
 *
 * It also emits `app/data/kitchen-bath-gallery.ts` carrying the measured
 * dimensions and a tiny blur placeholder per image, so the page can reserve
 * exact space for every tile and never shift layout as photos load.
 *
 * Run: node scripts/build_kitchen_bath_gallery.js
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "public", "Bath And Kitchen");
const OUT_DIR = path.join(ROOT, "public", "images", "kitchen-bath");
const DATA_FILE = path.join(ROOT, "app", "data", "kitchen-bath-gallery.ts");

/** Long edge of the generated source. next/image resizes down from here. */
const MAX_EDGE = 2000;
/** The hero is the LCP element and is the one image worth extra pixels. */
const HERO_MAX_EDGE = 2600;

/**
 * The order photographs appear in the "All work" grid, and with the
 * non-matching ones filtered out, inside every category view.
 *
 * Kept separate from the manifest below so the manifest can stay grouped by
 * category, which is how you maintain it, while this stays a reading
 * sequence, which is how you look at it. Photographs of the same room sit
 * next to each other. Any slug missing here falls to the end, so forgetting
 * to list a new photo hides nothing.
 *
 * The hero is deliberately absent: it is already the largest thing on the
 * page and repeating it in the grid reads as an accident.
 */
const ORDER = [
  "kitchen-navy-island",
  "bath-freestanding-tub-hex",
  "shower-marble-gold-tub",
  "bath-round-mirror-vanity",
  "kitchen-handleless-island",
  "shower-marble-glass-hex",
  "shower-mosaic-niche-glass",
  "bath-dark-marble-suite",
  "shower-striated-stone",
  "detail-striated-tile-window",
  "bath-backlit-vanity-stone",
  "kitchen-grey-shaker-island",
  "bath-marble-tub-hex",
  "shower-black-marble-glass",
  "shower-hex-black-fixtures",
  "bath-slab-marble-vanity",
  "shower-decorative-niche-gold",
  "shower-gold-window-patterned",
  "bath-navy-vanity-shiplap",
  "kitchen-wine-wall",
  "bath-double-vanity-gold",
  "bath-double-vanity-brass-mirror",
  "bath-wood-vanity-marble",
  "shower-marble-black-fixtures",
  "shower-glass-vanity-black",
  "kitchen-cream-shaker",
  "shower-stacked-stone-warmer",
  "detail-stacked-stone",
  "shower-grey-bench",
  "shower-grey-glass-vanity",
  "bath-grey-double-vanity",
  "kitchen-white-peninsula",
  "shower-fishscale-mosaic",
  "shower-wood-look-niches",
  "shower-tub-niche-band",
  "detail-tub-tile-niche",
  "bath-vanity-marble-wood-mirror",
  "bath-grey-vanity-pebble-floor",
  "bath-glass-shower-hex-floor",
  "detail-arabesque-backsplash",
  "detail-marble-mosaic-tub-deck",
];

/**
 * The curation.
 *
 * Every entry is a real photograph of completed or in-progress Profixter work.
 * `alt` describes only what is visible in the frame - no locations, no
 * materials that cannot be identified by eye, no project names.
 *
 * `crop` trims a distraction at the edge of an otherwise strong frame
 * (a drop cloth, a tool, a hand at the lens). Values are fractions of the
 * corresponding edge, applied after EXIF rotation.
 *
 * `group` marks photographs that are demonstrably the same room or home:
 * consecutive camera filenames AND the same tile, vanity and floor visible
 * across the frames. It is used only to keep those photos adjacent in the
 * grid - the page makes no claim about them beyond that.
 */
const GALLERY = [
  // ---- Hero -------------------------------------------------------------
  {
    slug: "bath-shiplap-skylight",
    file: "IMG_5486.JPG",
    category: "bathrooms",
    span: "feature",
    hero: true,
    alt: "Renovated bathroom with a freestanding tub, a tiled walk-in shower with a built-in bench, white shiplap walls and a skylight above.",
  },

  // ---- Kitchens ---------------------------------------------------------
  {
    slug: "kitchen-navy-island",
    file: "179724924_308853474105988_3149276663885084125_n.jpg",
    category: "kitchens",
    alt: "Renovated kitchen with white shaker cabinets, a navy island with a marble-look countertop, brick-pattern backsplash and glass pendant lights.",
  },
  {
    slug: "kitchen-handleless-island",
    file: "IMG_5252.JPG",
    category: "kitchens",
    span: "wide",
    alt: "Modern kitchen renovation with handleless cabinets, a large island with a white countertop, herringbone tile backsplash and a built-in cooktop.",
  },
  {
    slug: "kitchen-grey-shaker-island",
    file: "Kitchen Project.jpg",
    category: "kitchens",
    alt: "Renovated kitchen with grey shaker cabinets, a granite-look island, stainless steel range hood and marble-look tile flooring.",
  },
  {
    slug: "kitchen-wine-wall",
    file: "IMG_5241.JPG",
    category: "kitchens",
    span: "feature",
    // The right edge of the frame catches a drop cloth and the photographer's
    // arm; the bottom catches bare subfloor. The kitchen itself is untouched.
    crop: { right: 0.14, bottom: 0.12 },
    alt: "Open kitchen renovation with white cabinets, a built-in wine rack column, a range hood and an island with upholstered bar stools.",
  },
  {
    slug: "kitchen-cream-shaker",
    file: "273252204_522970615677322_1023821590732960814_n.jpg",
    category: "kitchens",
    alt: "Renovated kitchen with cream shaker cabinets, stainless steel appliances, a built-in wine rack and wood-look tile flooring.",
  },
  {
    slug: "kitchen-white-peninsula",
    file: "284047573_1406102983186326_4859577267093287587_n.jpg",
    category: "kitchens",
    alt: "Renovated kitchen with white cabinets, a raised breakfast peninsula with bar stools and glass pendant lighting.",
  },

  // ---- Bathrooms --------------------------------------------------------
  {
    slug: "bath-dark-marble-suite",
    file: "IMG_3962.JPG",
    category: "bathrooms",
    span: "feature",
    // Bottom of the frame catches cleaning supplies left on the floor.
    crop: { bottom: 0.14 },
    alt: "Large renovated primary bathroom with dark marble-look wall panels, a freestanding tub, a navy double vanity and a glass shower enclosure.",
  },
  {
    slug: "bath-backlit-vanity-stone",
    file: "IMG_2274.JPG",
    category: "bathrooms",
    span: "wide",
    group: "striated-stone",
    alt: "Renovated bathroom with a white floating double vanity, a large backlit mirror and a glass shower lined in grey striated stone-look tile.",
  },
  {
    slug: "bath-freestanding-tub-hex",
    file: "275814443_502664214797128_3481491690003026338_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a freestanding oval tub, marble-look wall tile, a white vanity and dark hexagon floor tile.",
  },
  {
    slug: "bath-marble-tub-hex",
    file: "275910652_313046667394708_658733056050064451_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with marble-look wall tile, a freestanding tub, a glass shower panel and dark hexagon floor tile.",
  },
  {
    slug: "bath-round-mirror-vanity",
    file: "275805676_502295484621859_7409952251334941425_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a white vanity, marble-look countertop, a round backlit mirror and a geometric patterned feature wall.",
  },
  {
    slug: "bath-double-vanity-gold",
    file: "290269136_604789244295550_9158049807393199293_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a white double vanity, a wide mirror, brass wall sconces and a glass shower enclosure.",
  },
  {
    slug: "bath-double-vanity-brass-mirror",
    file: "290553425_1162306881284280_5097966882880126705_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a white double vanity, a brass-framed mirror and brass wall sconces.",
  },
  {
    slug: "bath-slab-marble-vanity",
    file: "278440433_1359260807926962_72537164710955072_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with large marble-look wall slabs, a backlit mirror, a grey vanity and a glass shower.",
  },
  {
    slug: "bath-wood-vanity-marble",
    file: "IMG_3964.JPG",
    category: "bathrooms",
    span: "tall",
    alt: "Renovated bathroom with a wood floating double vanity, marble-look wall tile, a wood-panel accent wall and a built-in tub.",
  },
  {
    slug: "bath-navy-vanity-shiplap",
    file: "IMG_2508.JPG",
    category: "bathrooms",
    span: "tall",
    group: "gold-patterned",
    alt: "Renovated bathroom with a navy vanity, white shiplap walls, a black-framed mirror and patterned floor tile.",
  },
  {
    slug: "bath-grey-double-vanity",
    file: "IMG_5284.JPG",
    category: "bathrooms",
    group: "grey-large-format",
    alt: "Renovated bathroom with a white double vanity, two mirrors, wall sconces and large-format grey wall tile.",
  },
  {
    slug: "bath-vanity-marble-wood-mirror",
    file: "275979601_2906763222956385_2083524219156400111_n.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a white vanity, marble-look wall tile and a wood-framed mirror.",
  },
  {
    slug: "bath-grey-vanity-pebble-floor",
    file: "IMG_2204.JPG",
    category: "bathrooms",
    alt: "Renovated bathroom with a grey double vanity, a wide mirror, grey wall tile and pebble-pattern floor tile.",
  },
  {
    slug: "bath-glass-shower-hex-floor",
    file: "Bathroom Project.jpg",
    category: "bathrooms",
    alt: "Renovated bathroom with a glass shower enclosure, marble-look wall tile and hexagon floor tile.",
  },

  // ---- Showers ----------------------------------------------------------
  {
    slug: "shower-marble-gold-tub",
    file: "275833495_372301284747377_5248212021206533489_n.jpg",
    category: "showers",
    alt: "Tub and shower lined in marble-look tile with a decorative diamond tile band, brass fixtures and a sliding glass door.",
  },
  {
    slug: "shower-marble-glass-hex",
    file: "278153228_497151278730467_1942833522213168420_n.jpg",
    category: "showers",
    alt: "Walk-in shower with large marble-look wall tile, a frameless glass enclosure and hexagon mosaic floor tile.",
  },
  {
    slug: "shower-black-marble-glass",
    file: "316121189_534092461582719_3458333800309802536_n.jpg",
    category: "showers",
    span: "wide",
    alt: "Shower with white and black marble-look tile, a glass enclosure, a wall niche and a built-in tub surround.",
  },
  {
    slug: "shower-mosaic-niche-glass",
    file: "278283565_155645480256007_2832056877835265219_n.jpg",
    category: "showers",
    alt: "Walk-in shower with marble-look wall tile, two mosaic-lined niches and a frameless glass enclosure.",
  },
  {
    slug: "shower-hex-black-fixtures",
    file: "275740740_1121433631765450_4440314835841090641_n - Copy.jpg",
    category: "showers",
    alt: "Walk-in shower with white hexagon mosaic wall tile, a built-in niche, a stone bench and matte black fixtures.",
  },
  {
    slug: "shower-marble-black-fixtures",
    file: "275945570_719091462584138_9038484309533368290_n.jpg",
    category: "showers",
    alt: "Walk-in shower with marble-look wall tile, a rain shower head, matte black fixtures and hexagon mosaic tile.",
  },
  {
    slug: "shower-glass-vanity-black",
    file: "275867858_125014476767518_6156696583653795169_n.jpg",
    category: "showers",
    alt: "Walk-in shower with a black-framed glass enclosure beside a white vanity with a backlit mirror and black fixtures.",
  },
  {
    slug: "shower-decorative-niche-gold",
    file: "IMG_2506.JPG",
    category: "showers",
    span: "tall",
    group: "gold-patterned",
    alt: "Walk-in shower with white wall tile, a tall decorative tile niche, brass fixtures and patterned floor tile.",
  },
  {
    slug: "shower-gold-window-patterned",
    file: "IMG_2507.JPG",
    category: "showers",
    group: "gold-patterned",
    alt: "Walk-in shower with white wall tile, a brass rain head and hand shower, a window and patterned floor tile.",
  },
  {
    slug: "shower-striated-stone",
    file: "IMG_2263.JPG",
    category: "showers",
    span: "tall",
    group: "striated-stone",
    alt: "Walk-in shower lined in grey striated stone-look tile with a pebble floor and a glass panel.",
  },
  {
    slug: "shower-stacked-stone-warmer",
    file: "IMG_2353.JPG",
    category: "showers",
    span: "tall",
    group: "stacked-stone",
    alt: "Walk-in shower with a stacked stone accent wall, large-format tile and a wall-mounted towel warmer.",
  },
  {
    slug: "shower-grey-bench",
    file: "IMG_5282.JPG",
    category: "showers",
    span: "tall",
    group: "grey-large-format",
    alt: "Walk-in shower with large-format grey wall tile, a built-in bench, a wall niche and a rain shower head.",
  },
  {
    slug: "shower-grey-glass-vanity",
    file: "IMG_5283.JPG",
    category: "showers",
    span: "wide",
    group: "grey-large-format",
    alt: "Walk-in shower with large-format grey tile and a glass panel, next to a white vanity.",
  },
  {
    slug: "shower-fishscale-mosaic",
    file: "IMG_2644.JPG",
    category: "showers",
    alt: "Walk-in shower with blue fish-scale mosaic wall tile, a black tile border and a speckled terrazzo-look floor.",
  },
  {
    slug: "shower-wood-look-niches",
    file: "IMG_3757.JPG",
    category: "showers",
    span: "tall",
    alt: "Tub and shower surround in wood-look tile with a column of stacked built-in niches.",
  },
  {
    slug: "shower-tub-niche-band",
    file: "IMG_3374.JPG",
    category: "showers",
    alt: "Tub and shower surround in marble-look tile with a decorative patterned niche and a wall-mounted shower fitting.",
  },

  // ---- Details ----------------------------------------------------------
  {
    slug: "detail-striated-tile-window",
    file: "IMG_2264.JPG",
    category: "details",
    span: "tall",
    group: "striated-stone",
    alt: "Close view of grey striated stone-look tile running across a shower wall and around a window opening.",
  },
  {
    slug: "detail-stacked-stone",
    file: "IMG_2354.JPG",
    category: "details",
    group: "stacked-stone",
    alt: "Close view of a stacked stone accent wall meeting large-format tile inside a shower.",
  },
  {
    slug: "detail-arabesque-backsplash",
    file: "IMG_3626.JPG",
    category: "details",
    span: "wide",
    // Counter and floor are still a working surface at this stage.
    crop: { bottom: 0.3 },
    alt: "Kitchen wall with white shaker cabinets, a dark chevron range hood and a blue arabesque tile backsplash.",
  },
  {
    slug: "detail-marble-mosaic-tub-deck",
    file: "IMG_2643.JPG",
    category: "details",
    span: "wide",
    crop: { bottom: 0.16 },
    alt: "Bathroom under construction with marble mosaic tile on the walls and a tiled tub deck beneath a window.",
  },
  {
    slug: "detail-tub-tile-niche",
    file: "IMG_3372.JPG",
    category: "details",
    alt: "Tub surround in marble-look tile with a long decorative patterned niche above it.",
  },
];

// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

async function build() {
  if (!fs.existsSync(SRC_DIR)) {
    fail(`Source folder not found: ${SRC_DIR}`);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const slugs = new Set();
  const records = [];
  let totalIn = 0;
  let totalOut = 0;

  for (const item of GALLERY) {
    if (slugs.has(item.slug)) {
      fail(`Duplicate slug: ${item.slug}`);
      return;
    }
    slugs.add(item.slug);

    const srcPath = path.join(SRC_DIR, item.file);
    if (!fs.existsSync(srcPath)) {
      fail(`Missing source photo: ${item.file}`);
      return;
    }
    totalIn += fs.statSync(srcPath).size;

    // .rotate() with no argument applies the EXIF orientation and drops the
    // tag, so downstream consumers see upright pixels.
    let pipeline = sharp(srcPath).rotate();
    const meta = await pipeline.metadata();

    // metadata() reports pre-rotation dimensions, so swap them ourselves for
    // the orientations that turn the frame on its side.
    const rotated = meta.orientation >= 5 && meta.orientation <= 8;
    let width = rotated ? meta.height : meta.width;
    let height = rotated ? meta.width : meta.height;

    if (item.crop) {
      const left = Math.round(width * (item.crop.left || 0));
      const top = Math.round(height * (item.crop.top || 0));
      const right = Math.round(width * (item.crop.right || 0));
      const bottom = Math.round(height * (item.crop.bottom || 0));
      width = width - left - right;
      height = height - top - bottom;
      pipeline = pipeline.extract({ left, top, width, height });
    }

    const maxEdge = item.hero ? HERO_MAX_EDGE : MAX_EDGE;
    if (Math.max(width, height) > maxEdge) {
      const scale = maxEdge / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      pipeline = pipeline.resize(width, height, { fit: "fill" });
    }

    const outPath = path.join(OUT_DIR, `${item.slug}.webp`);
    await pipeline
      .clone()
      .webp({ quality: item.hero ? 84 : 80, effort: 5 })
      .toFile(outPath);
    totalOut += fs.statSync(outPath).size;

    // 12px wide placeholder. Large enough to read as the photo's colour and
    // tone, small enough that inlining it costs less than a round trip.
    const blur = await sharp(outPath)
      .resize(12, Math.max(1, Math.round((12 * height) / width)))
      .webp({ quality: 40 })
      .toBuffer();

    records.push({
      slug: item.slug,
      src: `/images/kitchen-bath/${item.slug}.webp`,
      width,
      height,
      alt: item.alt,
      category: item.category,
      span: item.span || "standard",
      hero: Boolean(item.hero),
      group: item.group || null,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    });

    console.log(
      `  ${item.slug.padEnd(34)} ${String(width).padStart(4)}x${String(height).padEnd(4)}  ${(
        fs.statSync(outPath).size / 1024
      ).toFixed(0)}KB`
    );
  }

  /*
   * Resolution guard.
   *
   * A two-cell tile is roughly 666 CSS pixels wide on a 1440 desktop, so on a
   * retina screen it wants around 1330 real ones. Several of these photographs
   * are old social exports that top out at 828, and next/image cannot invent
   * the difference - it just serves the source and the browser upscales it,
   * which is exactly the soft, cheap look this page is supposed to avoid.
   *
   * So the manifest is checked against what each span actually demands rather
   * than trusted. Promoting a small photograph to a feature tile fails loudly
   * here instead of quietly on somebody's laptop.
   *
   * One photograph has already been cut on this rule: a bookmatched marble
   * shower that only survives as a 600px export. Good frame, not enough
   * pixels for any tile on the page.
   */
  const NEEDS = { feature: 1330, wide: 1330, tall: 650, standard: 650 };
  const soft = records.filter(
    (record) => !record.hero && record.width < NEEDS[record.span]
  );
  if (soft.length) {
    for (const record of soft) {
      fail(
        `${record.slug} is ${record.width}px wide but span "${record.span}" needs ~${
          NEEDS[record.span]
        }px. Give it a smaller span or a higher-resolution source.`
      );
    }
    return;
  }

  /*
   * Drop anything this run did not produce.
   *
   * Removing a photograph from the manifest used to leave its WebP behind,
   * unreferenced by the data file and invisible on the page, but still
   * committed and still shipped. The output directory is generated, so it is
   * allowed to mirror the manifest exactly.
   */
  const expected = new Set([...records.map((r) => `${r.slug}.webp`), "og.jpg"]);
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (expected.has(name)) continue;
    fs.unlinkSync(path.join(OUT_DIR, name));
    console.log(`  removed stale ${name}`);
  }

  /*
   * Social and ad previews.
   *
   * Cropped to 1.91:1 and written as JPEG rather than reusing the hero WebP:
   * link unfurlers are the one audience still worth serving the older format,
   * and a 4:3 hero handed to them gets centre-cropped by whoever renders it.
   */
  const heroItem = GALLERY.find((item) => item.hero);
  if (heroItem) {
    await sharp(path.join(SRC_DIR, heroItem.file))
      .rotate()
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(OUT_DIR, "og.jpg"));
    console.log(`  ${"og.jpg".padEnd(34)} 1200x630`);
  }

  // The hero leads regardless; everything else follows the reading sequence,
  // with anything unlisted falling to the end rather than disappearing.
  const rank = (slug) => {
    const index = ORDER.indexOf(slug);
    return index === -1 ? ORDER.length : index;
  };
  records.sort((a, b) => {
    if (a.hero !== b.hero) return a.hero ? -1 : 1;
    return rank(a.slug) - rank(b.slug);
  });

  const unlisted = records.filter((r) => !r.hero && !ORDER.includes(r.slug));
  if (unlisted.length) {
    console.log(
      `\n⚠️  Not in ORDER, appended at the end: ${unlisted.map((r) => r.slug).join(", ")}`
    );
  }

  const ts = `/**
 * Generated by scripts/build_kitchen_bath_gallery.js - do not edit by hand.
 *
 * Real Profixter kitchen and bathroom photography, resized for the web from
 * the camera originals in \`public/Bath And Kitchen\`. Dimensions are the
 * generated file's own, so every tile can reserve its exact box before the
 * image arrives.
 */

export type GalleryCategory = "kitchens" | "bathrooms" | "showers" | "details";
export type GallerySpan = "feature" | "wide" | "tall" | "standard";

export type GalleryPhoto = {
  slug: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  category: GalleryCategory;
  span: GallerySpan;
  hero: boolean;
  /**
   * Set where several frames are demonstrably the same room: consecutive
   * camera filenames and the same tile, vanity and floor across the photos.
   * Used only to keep them adjacent in the grid.
   */
  group: string | null;
  blurDataURL: string;
};

export const KITCHEN_BATH_PHOTOS: GalleryPhoto[] = ${JSON.stringify(records, null, 2)};

export const KITCHEN_BATH_HERO =
  KITCHEN_BATH_PHOTOS.find((photo) => photo.hero) ?? KITCHEN_BATH_PHOTOS[0];

export function photosByCategory(category: GalleryCategory): GalleryPhoto[] {
  return KITCHEN_BATH_PHOTOS.filter((photo) => photo.category === category);
}

export function photoBySlug(slug: string): GalleryPhoto | undefined {
  return KITCHEN_BATH_PHOTOS.find((photo) => photo.slug === slug);
}
`;

  fs.writeFileSync(DATA_FILE, ts, "utf8");

  console.log(
    `\n✅ ${records.length} photos → ${path.relative(ROOT, OUT_DIR)}` +
      `\n   ${(totalIn / 1048576).toFixed(1)}MB source → ${(totalOut / 1048576).toFixed(1)}MB web` +
      ` (${(100 - (totalOut / totalIn) * 100).toFixed(0)}% smaller)` +
      `\n   data → ${path.relative(ROOT, DATA_FILE)}`
  );
}

build().catch((error) => {
  fail(error.stack || error.message);
});
