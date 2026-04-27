# Third-Party Notices

This project (`pwa-map`, MIT-licensed — see [`LICENSE`](./LICENSE))
depends on the following third-party packages and data sources.
Their copyrights and licences are reproduced and acknowledged below.

The "License" column shows the SPDX identifier as declared by each
package's own `package.json`. The full licence text for each
dependency is available in its `node_modules/<pkg>/LICENSE` file
after running `npm install`.

## Runtime dependencies (shipped to the browser)

| Package       | Version | License      | Upstream                                     |
| ------------- | ------- | ------------ | -------------------------------------------- |
| `maplibre-gl` | ^3.6.2  | BSD-3-Clause | <https://github.com/maplibre/maplibre-gl-js> |
| `mgrs`        | ^2.1.0  | MIT          | <https://github.com/proj4js/mgrs>            |
| `proj4`       | ^2.12.1 | MIT          | <https://github.com/proj4js/proj4js>         |

## Build-time / dev-time dependencies (NOT shipped to the browser)

These are listed for transparency. They are not part of the
deployed PWA artifact, but they are present in the `node_modules/`
tree on a contributor's machine.

| Package                        | Version  | License    | Upstream                                                 |
| ------------------------------ | -------- | ---------- | -------------------------------------------------------- |
| `@eslint/js`                   | ^9.12.0  | MIT        | <https://github.com/eslint/eslint>                       |
| `@playwright/test`             | ^1.48.0  | Apache-2.0 | <https://github.com/microsoft/playwright>                |
| `@sveltejs/vite-plugin-svelte` | ^3.1.2   | MIT        | <https://github.com/sveltejs/vite-plugin-svelte>         |
| `@tsconfig/svelte`             | ^5.0.4   | MIT        | <https://github.com/tsconfig/bases>                      |
| `@types/node`                  | ^22.7.0  | MIT        | <https://github.com/DefinitelyTyped/DefinitelyTyped>     |
| `@types/proj4`                 | ^2.5.5   | MIT        | <https://github.com/DefinitelyTyped/DefinitelyTyped>     |
| `@vitest/ui`                   | ^2.1.2   | MIT        | <https://github.com/vitest-dev/vitest>                   |
| `eslint`                       | ^9.12.0  | MIT        | <https://github.com/eslint/eslint>                       |
| `eslint-plugin-svelte`         | ^2.46.0  | MIT        | <https://github.com/sveltejs/eslint-plugin-svelte>       |
| `globals`                      | ^15.11.0 | MIT        | <https://github.com/sindresorhus/globals>                |
| `jsdom`                        | ^25.0.1  | MIT        | <https://github.com/jsdom/jsdom>                         |
| `prettier`                     | ^3.3.3   | MIT        | <https://github.com/prettier/prettier>                   |
| `prettier-plugin-svelte`       | ^3.2.7   | MIT        | <https://github.com/sveltejs/prettier-plugin-svelte>     |
| `svelte`                       | ^4.2.19  | MIT        | <https://github.com/sveltejs/svelte>                     |
| `svelte-check`                 | ^4.0.4   | MIT        | <https://github.com/sveltejs/language-tools>             |
| `tslib`                        | ^2.7.0   | 0BSD       | <https://github.com/microsoft/tslib>                     |
| `typescript`                   | ^5.6.2   | Apache-2.0 | <https://github.com/microsoft/TypeScript>                |
| `typescript-eslint`            | ^8.8.0   | MIT        | <https://github.com/typescript-eslint/typescript-eslint> |
| `vite`                         | ^5.4.8   | MIT        | <https://github.com/vitejs/vite>                         |
| `vite-plugin-pwa`              | ^0.20.5  | MIT        | <https://github.com/vite-pwa/vite-plugin-pwa>            |
| `vitest`                       | ^2.1.2   | MIT        | <https://github.com/vitest-dev/vitest>                   |
| `workbox-window`               | ^7.1.0   | MIT        | <https://github.com/GoogleChrome/workbox>                |

All listed licenses (MIT, BSD-3-Clause, Apache-2.0, 0BSD) are
permissive and compatible with this project's MIT licence. None
imposes a copyleft requirement on `pwa-map`'s own source.

## Map tile data sources

Tiles are fetched from upstream tile servers at runtime — the
project does NOT redistribute tile data. Each source has its own
licence and attribution requirement:

| Source                                                                             | Licence / Terms                                                                       | Attribution displayed in app   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| **OpenStreetMap**                                                                  | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/)    | "© OpenStreetMap contributors" |
| **NLSC** (內政部國土測繪中心 / National Land Surveying and Mapping Center, Taiwan) | [政府資料開放授權條款 1.0](https://data.gov.tw/license) (equivalent to CC-BY 4.0)     | "© 內政部國土測繪中心 (NLSC)"  |
| **Google Maps**                                                                    | [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms) | "© Google Maps"                |

The in-app `AttributionBar` component (feature 003) displays the
required attribution string for whichever tile source is active,
and the Settings sheet (feature 007) carries a permanent licence
notice reminding users that the cache is for short-term offline
fallback only — bulk download or redistribution of tiles is
forbidden by these upstream licences.

## Reference data

The test vectors in `tests/unit/fixtures/test-vectors.json` are
copied verbatim from the reference document
**Taiwan Coordinate Systems Reference v2.0.0** (MIT-licensed) —
Copyright (c) 2026 TacMap TW contributors. The copy is checked
in with its SHA-256 digest pinned in
`tests/unit/fixtures/vectors-digest.txt`.

## Reporting issues

If you believe any of the above attributions or licence
identifiers are incorrect, or if a dependency has been added to
`package.json` without a corresponding entry here, please open an
issue or pull request at
<https://github.com/swim-fish/pwa_map/issues>.
