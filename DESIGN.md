# DESIGN.md: Tatkal Trainer

Design source of truth. Wins over any skill or framework defaults.

## Two worlds, one screen

- **Left: Booking world** — a 2000s government-web-form look. Flat panels, crisp table borders, bevelled buttons, tabular LED countdown clock.
- **Right: Backend world** — a dark operations pipeline diagram showing load balancer → Redis token bucket → queue → workers → Postgres seat lock → outcomes.

## Palettes

### Booking world
- Page background: `#E9E4D6`
- Panel background: `#F7F4EC`
- Header band: `#1E3A66` with `#FFFFFF` text
- Table rules: `#9AA7B8`
- Body text: `#1B1B1B`
- Book Now button: `#E8731A` (hover `#C95F0F`)
- Disabled grey: `#BDB8AC`
- Bevel buttons: `#D4D0C8` with 2px outset borders (`border-style: outset`)

### LED clock
- Panel background: `#0A0A0A`
- Lit digits: `#FF3B30`
- Unlit segments: `#2A0A08`
- Font: `ui-monospace, Menlo, Consolas, monospace`
- `font-variant-numeric: tabular-nums`
- Size: `56px` desktop, `40px` mobile

### Backend world
- Background: `#0E1318`
- Node stroke: `#3A4A5A`
- Node fill: `#161E26`
- Primary text: `#C9D4DF`
- Pass: `#2ECC71`
- Waiting: `#F5A623`
- Reject: `#FF4D4F`
- "You" highlight: `#FFD400`

### Result stamp (the one expressive choice)
- Ink-stamp box rotated `-4deg`, `3px solid` border, uppercase
- Confirmed (`CNF`): `#1E8E3E`
- Waitlist (`WL`), `REGRET`, and `FAILED`: `#C62828`

## Typography

- Booking world font: `Verdana, Tahoma, Geneva, sans-serif`
- Body: `13px`
- Table text: `11px`
- Header band: `15px` bold
- Monospace for numbers/clock/code: `ui-monospace, Menlo, Consolas, monospace` with `font-variant-numeric: tabular-nums`
- No webfonts.

## Motion

- Result stamp drops in: scale `1.15 -> 1` over `120ms`.
- Blame node turns reject red (`#FF4D4F`) immediately on mount, pulses red twice (`2 x 400ms`), and stays red.
- Particle replay runs over `2.5s`, starting `300ms` after the result view mounts.
- Under `prefers-reduced-motion: reduce`: no pulse, no button shake, no particle canvas; show static counts only.

## Layout

- Before the click (`countdown` and `waiting`): booking screen fills the viewport, `max-width: 960px`, centred.
- After the click (`result`):
  - `>= 900px`: 50/50 split (booking left, backend right).
  - `< 900px`: stacked vertically, result on top, backend below.
- Must work cleanly with zero horizontal overflow at `390x844` (mobile) and `1280x800` (desktop).

## Copy rules

- First person, plain words, real numbers ("50,000 bots", "128 seats", "1,500 req/s").
- Every visible line names something real (seats, req/s, ms, request numbers).
- No hype verbs, no emoji.
- No IRCTC or Indian Railways logos, names-as-branding, colours, or screenshots. Train shown is fictional (`22999 VIDARBHA PRACTICE EXP`).
- Always include the disclaimer: "Toy model I wrote. Not IRCTC's real architecture. Not affiliated with IRCTC or Indian Railways."

## Banned

- Gradients
- Glassmorphism
- Gradient text
- Glow shadows
- Rounded-everything (booking world uses `0-2px` border-radius; backend nodes use `4px`)
- Marquees
- Noise overlays
- Serif display faces
- Three identical feature cards
