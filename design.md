# Design - Mancing NFT

A locked visual system for the routed analytics app. Business logic, API routes,
watchlist persistence, and non-custodial signing boundaries remain outside this document.

## Genre

Dense exchange terminal for institutional NFT liquidity research.

## Macrostructure family

- App pages: `20 Ecosystem Index`, with live market discovery first and a compact collection resolver above it.
- Collection pages: asymmetric exchange terminal with capital-to-target as the dominant task and intelligence rails beside it.
- Utility pages: index-first ledgers using the same control geometry and measurement rhythm.

## Theme

- `--color-paper`: `oklch(10.5% 0.012 255)`
- `--color-paper-2`: `oklch(14.5% 0.014 252)`
- `--color-ink`: `oklch(96% 0.008 220)`
- `--color-ink-2`: `oklch(83% 0.012 225)`
- `--color-rule`: `oklch(25% 0.018 248)`
- `--color-accent`: `oklch(70% 0.18 245)`
- `--color-focus`: `oklch(74% 0.17 245)`

NFT artwork supplies most visual color. The interface uses one crisp blue interaction accent,
green/red only for market direction, and small violet and amber network identifiers.

## Typography

- Display and body: Geist, roman, 400/700.
- Data and addresses: IBM Plex Mono, 400/600.
- Display tracking: `0`; large headings stay compact rather than heroic.
- All numeric tables use tabular figures.

## Spacing

Four-point named scale in `tokens.css`. Layouts use semantic tokens and keep touch
targets at least 44 px.

## Motion

- Market values interpolate slowly enough to remain readable.
- Analyze and network detection use functional loading indicators.
- Theme switching is immediate.
- Reduced motion removes spatial animation and keeps state changes visible.

## Microinteractions stance

- Visible focus rings appear instantly.
- Hover and press use one restrained signal each.
- Tooltips are supplemental; essential values also appear on focus or inline.
- Successful local actions are silent because the result is visible.

## CTA voice

- Primary: restrained signal fill, 4 px radius, explicit verb.
- Secondary: ruled outline, same height and radius.
- Icon-only controls include an accessible name and tooltip.

## Per-page allowances

- Real NFT artwork is present but no longer determines the page structure.
- App sections do not use generated decoration, glass, or ambient gradients.
- Charts and tables may use semantic color when it communicates data.

## What pages MUST share

- Top market strip, compact workspace navigation, and chain identifiers.
- Accent placement, font pairing, control geometry, and focus behavior.
- Unframed page bands separated by rules; cards are reserved for repeated records.
- Dark and light themes with the same hue anchors.

## What pages MAY differ on

- The proportion of artwork to executable data.
- Desktop column proportions based on the page's dominant task.
- Table-to-stacked-row behavior on mobile.

## Exports

### tokens.css

The canonical CSS token export is stored in `tokens.css` at the project root.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(10.5% 0.012 255);
  --color-ink: oklch(96% 0.008 220);
  --color-accent: oklch(70% 0.18 245);
  --font-display: var(--font-geist);
  --font-body: var(--font-geist);
  --font-mono: var(--font-plex-mono);
  --spacing-md: 1rem;
  --text-md: 1.125rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

The reusable DTCG export is stored in `tokens.json` at the project root.

### shadcn/ui CSS variables

```css
:root {
  --background: 0.105 0.012 255;
  --foreground: 0.96 0.008 220;
  --primary: 0.70 0.18 245;
  --primary-foreground: 0.12 0.028 250;
  --muted: 0.185 0.016 250;
  --muted-foreground: 0.64 0.016 235;
  --border: 0.25 0.018 248;
  --input: 0.25 0.018 248;
  --ring: 0.74 0.17 245;
  --radius: 0.25rem;
}
```

## Mancing NFT terminal redesign
Quant Workbench: collection 23%, book 45%, execution 32%. Near-black panels, cyan controls, green bids and red asks. Mobile uses Overview, Book, Trade and Analytics tabs. Preserve Geist and IBM Plex Mono. No decorative motion or gradients.
