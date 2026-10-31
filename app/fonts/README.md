# Self-hosted fonts

These are the exact WOFF2 files `next/font/google` downloaded from Google Fonts at build time, saved on 2026-10-31. Each one is byte-identical to the file production served before the switch (SHA-256 checked). They're loaded by `app/site-fonts.ts` and `app/components/admin/office/knight-font.ts`, and `app/fonts.css` chains the subsets back into one CSS variable per family.

Every family is licensed under the SIL Open Font License 1.1. The licence and copyright notice are in each folder's `OFL.txt` and must stay with the files.

To update a family, fetch `https://fonts.googleapis.com/css2?family=...&display=swap` with a Chrome user agent, replace the files subset by subset, and copy the new `unicode-range` values into the matching `localFont` call.

| File | Source | SHA-256 | Bytes |
|---|---|---|---|
| `cinzel/cinzel-latin-ext.woff2` | https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgfYPlDWxcZqTFU3AS.woff2 | `597be5e7c13054c6…` | 8,320 |
| `cinzel/cinzel-latin.woff2` | https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgfY3lDWxcZqTFUw.woff2 | `f266c0cab0426b50…` | 15,224 |
| `cormorant-garamond/cormorant-garamond-cyrillic-ext-italic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtFmSqn7B6DxjY.woff2 | `919a7720ae1671f0…` | 25,196 |
| `cormorant-garamond/cormorant-garamond-cyrillic-ext.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtKky2F7i6C.woff2 | `d04439363ec80513…` | 23,408 |
| `cormorant-garamond/cormorant-garamond-cyrillic-italic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtMmSqn7B6DxjY.woff2 | `3170a883f1968a2d…` | 21,264 |
| `cormorant-garamond/cormorant-garamond-cyrillic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrXtKky2F7i6C.woff2 | `d81372bae1f872f1…` | 21,132 |
| `cormorant-garamond/cormorant-garamond-latin-ext-italic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtGmSqn7B6DxjY.woff2 | `06bc9a8c179afaf7…` | 34,444 |
| `cormorant-garamond/cormorant-garamond-latin-ext.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYp3tKky2F7i6C.woff2 | `9dc38267bdee93a6…` | 33,740 |
| `cormorant-garamond/cormorant-garamond-latin-italic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2 | `e6d6d1d73858aa9b…` | 39,304 |
| `cormorant-garamond/cormorant-garamond-latin.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2 | `5d618c462b7a5b74…` | 37,776 |
| `cormorant-garamond/cormorant-garamond-vietnamese-italic.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtHmSqn7B6DxjY.woff2 | `3512ad3b4ddd21fa…` | 11,556 |
| `cormorant-garamond/cormorant-garamond-vietnamese.woff2` | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpntKky2F7i6C.woff2 | `826f73ca737feec0…` | 11,264 |
| `geist-mono/geist-mono-cyrillic-ext.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrodmhHkjkotbA.woff2 | `e27f657e38d52887…` | 6,204 |
| `geist-mono/geist-mono-cyrillic.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrMdmhHkjkotbA.woff2 | `75b3bedbebc35f34…` | 12,872 |
| `geist-mono/geist-mono-latin-ext.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrkdmhHkjkotbA.woff2 | `745994b5cd950ec2…` | 14,712 |
| `geist-mono/geist-mono-latin.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2 | `5f3d6ad60f29d6cb…` | 23,108 |
| `geist-mono/geist-mono-symbols2.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFg08vz7MhEIVVeA.woff2 | `d67e4a94ba498635…` | 5,892 |
| `geist-mono/geist-mono-vietnamese.woff2` | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrgdmhHkjkotbA.woff2 | `16e1d48b6dd29eb2…` | 7,728 |
| `geist/geist-cyrillic-ext.woff2` | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwRGFWNOITddY4.woff2 | `b7a545bbb08256bd…` | 7,252 |
| `geist/geist-cyrillic.woff2` | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwYGFWNOITddY4.woff2 | `6129fc8571c3e0cb…` | 14,900 |
| `geist/geist-latin-ext.woff2` | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwSGFWNOITddY4.woff2 | `58a6b173d5ca1dec…` | 16,540 |
| `geist/geist-latin.woff2` | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2 | `9b6f5ff45b278c74…` | 29,288 |
| `geist/geist-vietnamese.woff2` | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwTGFWNOITddY4.woff2 | `f689f638f29fff46…` | 7,968 |
| `montserrat/montserrat-cyrillic-ext.woff2` | https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WRhyyTh89ZNpQ.woff2 | `744830a0e77dd14d…` | 24,072 |
| `montserrat/montserrat-cyrillic.woff2` | https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459W1hyyTh89ZNpQ.woff2 | `0b00fbd6edcc84cd…` | 21,492 |
| `montserrat/montserrat-latin-ext.woff2` | https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WdhyyTh89ZNpQ.woff2 | `920711de9ae96c18…` | 68,224 |
| `montserrat/montserrat-latin.woff2` | https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.woff2 | `6438d7b8ea9c7c39…` | 35,508 |
| `montserrat/montserrat-vietnamese.woff2` | https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WZhyyTh89ZNpQ.woff2 | `9e2672d100bc36a3…` | 10,620 |
