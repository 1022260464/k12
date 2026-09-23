# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Current visual direction

- Use a Kaggle-like minimalist interface: white surfaces, thin neutral borders, compact spacing, restrained shadows, and radii no larger than 6px for panels.
- Use blue/cyan for navigation, links, focus rings, selected states, and metrics. Keep headings near-black and supporting text neutral gray; yellow, teal, and pink are small semantic accents only.
- Keep React components headless where practical: state and accessibility semantics belong in components, while visual decisions stay in the shared stylesheet.
- Avoid dark full-page sections in both the user app and admin app. A dark color is acceptable only for a clear command button or terminal/status strip.
- The user-app home page is a working learning dashboard, not a marketing page. Prioritize courses, current tasks, homework, AI assistance, and progress; keep architecture and role introductions out of the primary user flow.
- The floating AI assistant must feel like a lightweight headless popover: white and neutral surfaces, a soft shadow, rounded chat bubbles and icon controls. Do not use a large square blue panel or keep the chat permanently fixed in the page layout.
- Every clickable product action must call a real backend API. When the backend or page workflow does not exist yet, show an explicit planned empty state or disable the control; never simulate a successful operation.
- The student application has two audience experiences that share routes, API clients, authentication, and domain state: a playful primary-school experience and a denser junior/senior-high experience. Keep new business features shared; vary navigation labels, page composition, tokens, copy, and imagery through the experience layer instead of duplicating pages.
- The audience switch must remain visible and persist the learner's explicit choice. When no explicit choice exists, the learning profile may choose the initial experience: `PRIMARY_LOWER` and `PRIMARY_UPPER` use the primary experience; later stages use the teen experience.
- Primary-school artwork slots currently reuse repository assets while the supplied character sheets are manually separated. Preserve stable image containers so final transparent PNG/WebP assets can replace these files without changing page structure.
