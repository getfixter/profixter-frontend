/**
 * The Meta dataset id, and nothing else.
 *
 * WHY THIS IS ITS OWN FILE, WITH NO "use client".
 *
 * The root layout is a Server Component and interpolates this id into the
 * pixel's inline script. lib/meta.ts is marked "use client", and a value
 * imported from a client module into a server component is a client reference,
 * not the string - so `${META_PIXEL_ID}` rendered as nothing and the site
 * served a pixel snippet with an empty id. It looked completely normal: the
 * script tag was present, the noscript image was present, and not one event
 * could ever have been attributed.
 *
 * Keeping the constant in a plain module both sides can import means the
 * server and the browser use the same literal and it exists in exactly one
 * place in the frontend. BackEnd/utils/metaCapi.js holds the matching copy for
 * the Conversions API; the two are asserted equal by the tracking test.
 */
export const META_PIXEL_ID = "3668264173327839";
