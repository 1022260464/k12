# Student Dual-Experience Design QA

## Scope

- Source direction: supplied primary-school colorful character sheet and junior/senior-high line-art sheet.
- Implemented phase: shared student application with switchable primary and teen experiences, distinct home composition, copy, navigation labels, tokens, responsive behavior, and experience-specific sticker assets.
- Asset source: user-supplied categorized sticker library. Selected PNG files were resized and converted to transparent WebP assets for browser delivery.

## Checks

- Desktop: primary and teen headers, audience switch, hero artwork, course rail, AI entry, and primary learning entrances remain within their containers.
- Mobile 390 x 844: no horizontal overflow; hero heading and audience switch fit their containers.
- Mobile floating assistant does not obscure the hero status label.
- Courses, tasks, progress, leaderboard, AI studio, and visual code lab use experience-aware copy and artwork where applicable.
- Audience switch: both directions update navigation, home content, page artwork, floating assistant, footer copy, and persistent local preference.
- Existing API and route behavior remains shared between experiences.
- Browser console: no errors or warnings during desktop/mobile switching and page checks.
- Authenticated header: account controls no longer compress the primary/teen experience labels; search and account name yield space first at medium desktop widths.
- Visual depth: home hero now uses a full-width stage band, supporting sticker accents, colored primary-school entry panels, elevated course tiles, and distinct shortcut colors without changing business behavior.
- Production build: passed.
- Unit tests: 22 passed.

## Follow-up

- P3: add more subject-specific sticker variants as new curriculum modules are introduced.
- P3: evaluate AVIF only if future image volume justifies maintaining another asset format.

final result: passed
