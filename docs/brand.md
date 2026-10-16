# BehindTheMark brand assets

- [Primary transparent PNG](../frontend/public/brand/behindthemark-logo.png): generated with the built-in image-generation tool, copied into the project without modifying its alpha channel. Black artwork is inverted for the existing dark navigation surface via CSS.
- [Small-size favicon](../frontend/public/brand/favicon.svg): a simple code-native monogram companion for browser tabs.
- `frontend/src/components/Brand.tsx` renders the primary asset with accessible alternative text.

## Generation prompt

```text
Use case: logo-brand.
Asset type: original primary logo for BehindTheMark, an education product that helps teachers look beyond quiz scores to understand a learner's reasoning. Intended for the project website, presentation, and README.
Create one polished, professional, distinctive logo, not a page of options.
Design concept: a bold, beautifully proportioned capital B monogram formed from two interlocking rounded conversation/page shapes, with a precise open negative-space gap revealing the second shape behind the first. It should quietly communicate "there is a story behind the mark" and listening to a student's thinking, not grading or surveillance. The silhouette must remain recognizable as a small app icon. Use restrained geometric construction, balanced optical weight and generous breathing room.
Layout: a single horizontal lockup, monogram at left and wordmark at right, optically aligned. The mark should be distinctive but not oversized relative to the wordmark.
Text (verbatim): "BehindTheMark". Render exactly once, with uppercase B, T, M, and all other letters lowercase. Use a confident, contemporary humanist/geometric sans serif, medium-bold weight, superb kerning, highly legible, warm and credible rather than childish.
Palette: monochrome charcoal/black ink, consistent with the existing project's black-and-white identity. Flat solid artwork, no gradients or texture.
Background: genuinely transparent alpha, no background rectangle, no checkerboard drawn into the image.
Constraints: crisp vector-like edges at high resolution, production-ready standalone raster logo, one icon plus the exact wordmark only. No slogan, no labels, no mockup, no frames, no shadows, no 3D, no neon glow, no stock graduation caps, brains, magnifying glasses, generic AI sparkles, checkmarks, or third-party brand marks.
```

This is a generated raster identity concept, not a trademark-clearance claim or a source-vector deliverable. No existing logo asset was overwritten.
