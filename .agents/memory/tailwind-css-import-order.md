---
name: Tailwind v4 CSS @import ordering
description: Google Fonts (or any external) @import in index.css must go before @import "tailwindcss", not just before @plugin/@theme.
---

In Tailwind v4 projects, `@import "tailwindcss"` expands inline into thousands of lines of generated CSS at build time. Any `@import url(...)` (e.g. Google Fonts) placed textually after `@import "tailwindcss"` in the source file ends up *after* real CSS rules in the final output, which violates the CSS spec ("@import must precede all other statements") and triggers a build warning.

**Why:** Source-order position isn't what matters — post-expansion position is. Placing the external font import right before `@plugin`/`@theme` still fails because `@import "tailwindcss"` above it expands first.

**How to apply:** Put external `@import url(...)` statements as the very first line(s) of the CSS file, before `@import "tailwindcss"` and `@import "tw-animate-css"`.
