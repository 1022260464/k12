# Design QA

## Evidence

- Source visual truth: `C:\Users\Lenovo\Desktop\页面 1.png`
- Source pixels: `1708 x 3347`
- User desktop implementation: `http://127.0.0.1:5173/`, Codex in-app Browser tab 3 capture
- User mobile implementation: `http://127.0.0.1:5173/`, Codex in-app Browser tab 1 capture
- Admin implementation: `http://127.0.0.1:5174/`, Codex in-app Browser tab 2 capture
- Desktop viewport: `1280 x 720` CSS pixels, DPR `1.5`, document scroll width `1265`
- Mobile verification viewport: user page `438` CSS pixels wide with document scroll width `423`; admin narrow capture约 `435` CSS pixels wide且页面无横向滚动
- Admin viewport: `1280 x 720` CSS pixels, DPR `1.5`, document scroll width `1280`
- State: logged-out user dashboard, mobile navigation open/closed, user login dialog open, admin login page
- Screenshot storage: captures are attached to the Codex in-app Browser tool results; this browser backend does not expose a local screenshot path.

## Comparison Scope

The supplied image is used as the visual-language reference, not as the user homepage information architecture. The user explicitly required the final homepage to contain useful product workflows instead of marketing and architecture content. The implementation therefore preserves the reference's white canvas, blue accent, compact navigation, black heading hierarchy, thin borders, low radii, restrained shadows, and sparse color accents while replacing promotional sections with courses, tasks, homework, AI assistance, progress, and recent activity.

## Required Fidelity Surfaces

- Fonts and typography: system sans-serif stack matches the reference's neutral product type; headings use compact weights and sizes appropriate for a dashboard rather than hero-scale marketing copy. Letter spacing is `0`.
- Spacing and layout rhythm: the desktop first viewport presents courses and tasks together; panels use a consistent `20px` gap, `6px` radius, and thin borders. Mobile collapses to one column with no horizontal overflow.
- Colors and visual tokens: white is dominant, near-black is used for headings, neutral gray for secondary text, and blue/cyan for navigation, focus, progress, buttons, links, and metrics. Yellow and teal are limited to semantic state accents.
- Image quality and asset fidelity: the existing learning-path illustration is a real raster asset and is used only inside the meaningful weekly-path panel. No placeholder, CSS drawing, inline SVG, or decorative gradient is used.
- Copy and content: the homepage is user-facing and task-oriented. The image-backed home banner leads directly into courses, tasks, personalized recommendations, AI assistance, and progress; platform architecture and audience explanations remain excluded.

## Interaction Checks

- User login button opens the login dialog and close returns to the dashboard.
- Logged-out protected actions route to login rather than pretending to complete work.
- Mobile menu exposes all four primary destinations.
- Course carousel moves horizontally through five courses with previous and next controls; the checked next action changed `scrollLeft` from `16` to `263.33`.
- AI assistant is a floating headless-style popover with a round launcher, neutral message bubbles, icon controls, focus state, sending state and visible API error state. It requires authentication before calling the real Agent run API.
- User and admin browser consoles contain no warnings or errors during the checked states.
- Production builds passed for both Vite applications.

## Comparison History

1. P1: the first implementation copied promotional role and architecture sections from the reference, which did not serve the user homepage. Fixed by replacing them with the learning dashboard and verifying the revised desktop and mobile captures.
2. P2: the previous admin theme used a dark login panel and dark sidebar, conflicting with the requested white and blue direction. Fixed by using white surfaces, blue active states, and neutral borders; verified on the admin login capture.
3. P2: the initial narrow-browser capture showed horizontal overflow caused by a minimum body width. Fixed by removing the fixed minimum width and verifying that mobile document scroll width stays below the viewport width.
4. P1: the task-focused dashboard lacked a recognizable home banner and content discovery. Fixed by adding the supplied learning-path image as a functional home banner, a five-course carousel, and three contextual recommendation entries without reintroducing platform-marketing sections.
5. P1: the AI assistant previously read as a rigid fixed panel. Fixed by using a compact round launcher and a lightweight white popover with softer corners, round avatar controls, restrained shadow, neutral bubbles, and a mobile-safe width. Verified in fresh desktop and narrow in-app Browser tabs.
6. P1: management pages exposed only top-level CRUD even though the backend already provided nested APIs. Fixed by adding course chapter management, Agent run and artifact inspection, homework recipient validation, question management, submissions, per-answer grading, full grading, and grade history. Production build and protected-page HTTP checks passed; the latest check also verified the explicit error state when a running backend resource request returned `500`.
7. P1: narrow course filters shrank Chinese labels into vertical text, and long homework codes escaped their task rows. Fixed with non-shrinking horizontal filters, constrained text containers, and `overflow-wrap` on API-provided titles.
8. P1: homework recipients were edited as a raw ID textarea and the workspace produced nested horizontal scrolling on mobile. Fixed with a searchable enabled-student checklist, bulk and individual selection, invalid-recipient cleanup, and responsive table rows.
9. P2: resource and user edit forms reused list payloads, which could leave fields blank when list responses are reduced. Fixed by loading each entity detail before opening its edit form; homework creation now uses a course selector backed by the course API.
10. P2: an API `500` was visually indistinguishable from an empty dataset. Fixed by separating loading, request failure, filtered-empty, and true-empty states. During the latest visual check the running backend intermittently returned `500`; the UI correctly exposed the failure and retained a refresh action.

## Focused Comparison

- Header: blue square brand, compact navigation, pill search, text login, and dark registration button follow the reference closely.
- User first viewport: the supplied illustration anchors a compact learning banner; the next viewport hint exposes the course carousel and today's tasks instead of promotional content.
- Login controls: blue focus ring, square inputs, compact button, and neutral overlay remain visually consistent.
- Admin login: white split layout, blue actions, and a thin security note replace the previous dark marketing panel.

No actionable P0 or P1 visual issues remain in the checked states. The current backend `500` still needs service-side log inspection, but it is not produced by the frontend build and is now represented explicitly rather than as empty data.

final result: passed
