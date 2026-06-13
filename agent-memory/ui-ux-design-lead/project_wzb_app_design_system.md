---
name: project-wzb-app-design-system
description: Wazobia (wzb-app) design system tokens, component rules, and established visual patterns for the zync-nextjs-standalone PWA
metadata:
  type: project
---

## Stack
`zync-nextjs-standalone` — Next.js 16+ App Router, Tailwind CSS with `brand-*` tokens, Mongoose/Typegoose, next-auth.

## Brand tokens (tailwind.config.ts)
- `brand-bg`: `#fdf8f0` — warm cream page background
- `brand-surface`: `#ffffff` — cards, modals, bottom sheets
- `brand-accent`: `#059669` — emerald, primary CTAs, active states
- `brand-accent-dark`: `#065f46`
- `brand-accent-light`: `#d1fae5` — emerald tint for empty states, badge backgrounds
- `brand-text`: `#1c1917` — warm almost-black
- `brand-muted`: `#78716c` — warm stone secondary text
- `brand-border`: `#e7e0d5` — warm border/divider
- `brand-gold`: `#d97706` — golden amber for prices and monetary values
- `brand-gold-light`: `#fef3c7` — amber tint for pending status badges
- `brand-danger`: `#dc2626` — errors, destructive actions
- `rounded-brand`: `16px`

## Visual rules (applied across all pages)

### Cards
`rounded-[20px] shadow-[0_2px_12px_rgba(28,25,23,0.08)]` — NO hard borders on cards

### Primary CTA buttons
`rounded-full bg-brand-accent text-white py-4 font-bold`

### Danger buttons
`rounded-full` text-only `text-brand-danger` OR `rounded-full bg-brand-danger text-white` — never use `rounded-brand`

### Secondary / outline buttons
`rounded-[14px]` with `border border-brand-border`

### Input fields
`rounded-[14px] border border-brand-border bg-brand-bg focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20`

### Empty states
`w-20 h-20 rounded-[24px] bg-brand-accent-light shadow-[0_4px_16px_rgba(5,150,105,0.15)]` with full-opacity icon `text-brand-accent`
Heading: `font-extrabold text-brand-text tracking-tight`

### Skeleton loading
`bg-brand-border/40 animate-pulse` on rounded containers (match card radius)

### Error inline
`text-brand-danger bg-red-50 rounded-[12px] px-4 py-3`

### Status badges
- Positive/active/completed: `bg-brand-accent-light text-brand-accent`
- Pending: `bg-brand-gold-light text-brand-gold`
- Cancelled/rejected/danger: `bg-red-50 text-brand-danger`
- Closed/voided: `bg-brand-border text-brand-muted`

### Price/money values
`text-brand-gold font-extrabold` — always gold, never emerald

### Back button
`w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-bg transition-colors` with chevron SVG

### Back button over dark hero (marketplace/business detail)
`w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center`

### Auth pages (location screens)
- Top half: `bg-brand-bg` with `w-20 h-20 rounded-[24px] bg-brand-accent-light` icon + heading
- Bottom sheet: `bg-brand-surface rounded-t-[32px] shadow-[0_-4px_32px_rgba(28,25,23,0.10)] px-6 pt-8 pb-12`

### Location option buttons
`rounded-[14px] border` — selected: `border-brand-accent bg-brand-accent-light text-brand-accent`

### Hero detail pages (marketplace listing, business directory)
- Dark emerald hero: `bg-brand-accent` with image overlay
- Content card lifts over: `bg-brand-surface rounded-t-3xl -mt-4 min-h-screen`

### Wallet gradient card
`bg-gradient-to-br from-[#059669] to-[#0d9488] rounded-[24px]`

### Category pill tabs
Active: `bg-brand-accent text-white rounded-full`
Inactive: `bg-brand-bg border border-brand-border text-brand-muted rounded-full`

## Pages audited and updated (2026-06-02)
All pages under `/src/app/(app)/` — 23 total. Redirect-only pages (topup, transactions, withdraw) had no UI to update.

**Why:** Full design overhaul to warm cream + emerald + gold palette replacing cold blue/grey palette.

**How to apply:** When adding new pages or components to wzb-app, follow all rules above. Never use hardcoded hex, old blue classes (`text-blue-*`, `bg-blue-*`), `rounded-brand` on primary CTA buttons, or semantic-less colors (`text-green-600`, `text-red-500`, `bg-amber-100`).
