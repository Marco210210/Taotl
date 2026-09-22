CommonJS adaptation of decode-uri-component 0.5.0 (MIT), from the official npm package.
Fixes GHSA-vcc3-ghjq-m6fr in the query-string 7 dependency used by Expo Router 57.
Changes: default export becomes module.exports; preserves 0.2.x plus-to-space behavior.
Remove override when Expo Router adopts a compatible fixed decoder.
Upstream: https://github.com/SamVerschueren/decode-uri-component
