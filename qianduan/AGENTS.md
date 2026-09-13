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
