---
name: cc-page
description: |
  Create new credit card landing pages with the unified portfolio + payment flow system.
  
  Use this skill whenever the user wants to:
  - Create a new product landing page from the template
  - Fork the cc-dynamic-template for a different product
  - Set up payment integration for a new product
  - Understand the landing page architecture and codebase
  - Get guidance on customization and configuration
  - Build a fully functional landing page in ~45 minutes
  
  Triggers on: "create new page", "new product landing", "setup product", "fork template", "build landing page", "create product page", and similar requests.
---

# CC Page Creation Guide

## Quick Summary

This skill guides you through creating new credit card landing pages using the unified system. The process is straightforward and takes ~45 minutes:

1. **Clone/fork** the base template
2. **Configure** your product (brand.config.json)
3. **Add assets** (logo, hero background, showcase images)
4. **Customize content** (text, features, pricing)
5. **Test & build** 
6. **Verify** everything works

The system is **configuration-driven** — edit config, edit text, add images, and you have a complete landing page.

---

## Understanding the Architecture

The landing page uses a **unified flow** where two distinct experiences (portfolio shell + payment flow) are seamlessly integrated at a single `/subscribe` route:

### Two Flows, One Route

```
User visits /en/subscribe
        ↓
System checks: Device + Payment capabilities?
        ↓
├─ iPhone + Apple Pay available  → Full-screen payment (nonComp)
├─ Android + Google Pay available → Full-screen payment (nonComp)
└─ Desktop / no payment methods  → Portfolio Home + Payment Widget (comp)
```

### Key Concepts

| Concept | What it is | Where to find it |
|---------|-----------|------------------|
| **Portfolio Shell** | Home, Pricing, About, Contact pages (React Router) | `src/portfolio/` |
| **Payment Flow** | Apple Pay / Google Pay / Credit Card checkout (ouisys) | `src/Root.tsx`, `src/providers/` |
| **Subscribe Seam** | `/subscribe` route that decides which flow to show | `src/portfolio/pages/Subscribe.tsx` |
| **pageVariant** | State that determines layout: 'comp' (portfolio) or 'nonComp' (payment) | `src/providers/RootContext.tsx` |
| **Configuration** | Single source of truth for product settings | `src/config/brand.config.json` |

---

## Step-by-Step: Creating a New Product (45 minutes)

### Phase 1: Setup (5 minutes)

Clone the canonical template:

```bash
git clone <repo-url> cc-dynamic-template-{product-name}
cd cc-dynamic-template-{product-name}
```

The template includes:
- Pre-built React Router structure
- Payment widget components
- i18n system (18 languages)
- Responsive styling (Tailwind + SCSS)
- All reusable components

### Phase 2: Configuration (10 minutes)

Edit **`src/config/brand.config.json`** with your product details:

```json
{
  "brand": {
    "defaultServiceId": "myproduct",
    "brandColor": "#FF006D"
  },
  "languages": {
    "supported": ["en", "es", "fr"],
    "switcher": ["en", "es"]
  },
  "serviceLinks": {
    "home": "https://myproduct.com",
    "terms": "https://myproduct.com/terms",
    "privacy": "https://myproduct.com/privacy"
  },
  "features": [
    { "icon": "icon-name", "title": "Feature 1", "desc": "Description" },
    { "icon": "icon-name", "title": "Feature 2", "desc": "Description" }
  ],
  "pricing": {
    "trialPrice": "0.01",
    "subscriptionPrice": 49.99,
    "billingCycle": "28 days"
  }
}
```

**Key fields:**
- `defaultServiceId` — used to find your logo at `src/assets/logos/{serviceId}.svg`
- `brandColor` — primary accent color (hex)
- `serviceLinks.*` — external URLs (home, terms, privacy)
- `features[]` — 4-6 feature cards (icon name + title + description)
- `pricing` — trial price + recurring price + billing cycle

### Phase 3: Add Assets (10 minutes)

Place your brand assets in the correct locations:

1. **Logo** → `src/assets/logos/{serviceId}.svg`
   - SVG format, 200px × 200px recommended
   - Will be imported dynamically by service ID

2. **Hero Background** → `src/assets/imgs/hero-bg.png`
   - 2048 × 1440 px (16:9 aspect ratio)
   - High-quality product hero image
   - Used on `/subscribe` page

3. **Showcase Images** → `src/portfolio/assets/vr-*.png`
   - 6+ showcase images (vr-1.png, vr-2.png, etc.)
   - Used in marquee rows and gallery sections
   - Recommended: 800 × 600 px

**Asset checklist:**
- [ ] Logo (SVG) at `src/assets/logos/`
- [ ] Hero background (PNG) at `src/assets/imgs/hero-bg.png`
- [ ] 6+ showcase images (PNG) at `src/portfolio/assets/`

### Phase 4: Customize Content (15 minutes)

Edit **`src/portfolio/localization/en.yaml`** with your product text:

```yaml
home:
  hero:
    title: "Your Product Title"
    subtitle: "Your tagline or description"
    cta: "Get Started"
  
  showcase:
    title: "Product Showcase"
    subtitle: "See it in action"
  
  features:
    title: "Why Choose Us"
    subtitle: "Key benefits"
    card1:
      title: "Feature Name"
      text: "Feature description"
  
  pricing:
    title: "Simple Pricing"
    subtitle: "Choose your plan"
  
  faq:
    title: "Common Questions"
    q1: "How do I get started?"
    a1: "You can sign up in seconds..."
```

**Content checklist:**
- [ ] Hero title, subtitle, CTA button text
- [ ] Feature titles and descriptions (4-6)
- [ ] Pricing section title and labels
- [ ] FAQ questions and answers
- [ ] Other section titles and text

After editing, run:

```bash
yarn manage:translations
```

This extracts all i18n strings and compiles them.

### Phase 5: Test & Build (8 minutes)

```bash
# Install dependencies (if first time)
yarn install

# Start dev server
yarn dev
```

Test these:
1. **Desktop flow** → http://localhost:8081/en/subscribe
   - See portfolio Home with payment widget
   - Hero image displays correctly
   - Features and pricing sections visible
   - Payment buttons render

2. **Showcase & Gallery** → Scroll down on Home
   - Marquee animations work
   - Images load correctly

3. **Other pages** → /en/pricing, /en/about, /en/contact
   - Navigation works
   - Footer displays

4. **Language switching** → Click language selector
   - Text updates correctly
   - All languages work

5. **Payment widget** → Click Apple Pay or Google Pay
   - Buttons are clickable (don't need to complete payment in dev)

Build for production:

```bash
yarn build
```

Check that `dist/` directory is created and contains the built assets.

---

## Configuration Deep Dive

### brand.config.json Structure

| Section | Purpose | Example |
|---------|---------|---------|
| `brand` | Product identity | `{ defaultServiceId: "myproduct", brandColor: "#FF006D" }` |
| `languages` | Language support | `{ supported: ["en", "es", "fr"], switcher: ["en", "es"] }` |
| `serviceLinks` | External URLs | `{ home: "...", terms: "...", privacy: "..." }` |
| `features` | Feature cards (4-6) | `[{ icon: "...", title: "...", desc: "..." }]` |
| `pricing` | Trial + subscription | `{ trialPrice: "0.01", subscriptionPrice: 49.99, billingCycle: "28 days" }` |
| `contentGrid` | Showcase sections | Array of { title, subtitle, images } |
| `milestones` | Optional stats/numbers | `[{ label: "...", value: "..." }]` |

**Edit this file when:**
- Changing product colors or branding
- Adding/removing features
- Updating pricing
- Changing supported languages
- Modifying external links

**Do NOT edit when:**
- Changing page text (use localization YAML instead)
- Changing component logic (edit the component file instead)

### Icon Names (for features)

Common icon names available in the template:

- `bullhorn` — Announcement
- `certificate` — Verification/Trust
- `perfectly` — Quality
- `file` — Documentation
- `safe` — Security
- `user` — Users/Community
- `like` — Positive feedback
- `graphic` — Visual/Design
- `doc` — Documentation
- `love` — Love/Favorites
- `talk` — Support/Chat

Find more icons in `src/portfolio/assets/icons/`.

---

## File Structure Overview

When you create a new product, you'll work with these files:

```
cc-dynamic-template-myproduct/
├── src/
│   ├── config/
│   │   └── brand.config.json              ← Product configuration
│   ├── assets/
│   │   ├── logos/
│   │   │   └── myproduct.svg              ← Your logo
│   │   └── imgs/
│   │       └── hero-bg.png                ← Hero background
│   ├── portfolio/
│   │   ├── assets/vr-*.png                ← Showcase images
│   │   ├── localization/
│   │   │   └── en.yaml                    ← Product text (English)
│   │   ├── pages/
│   │   │   ├── Home.tsx                   ← Portfolio home page
│   │   │   ├── Subscribe.tsx              ← Dual-flow seam
│   │   │   ├── Pricing.tsx                ← Pricing page
│   │   │   └── ...
│   │   └── components/
│   │       └── PaymentWidget/             ← Payment buttons in portfolio style
│   └── Root.tsx                           ← Ouisys payment flow
├── docs/                                  ← Full documentation
│   ├── 1.ARCHITECTURE.md
│   ├── 2.QUICK_REFERENCE.md
│   ├── 3.BLUEPRINT.md
│   └── 4.AUTOMATION.md
└── yarn.lock
```

**Key insight:** You only modify files in these folders:
1. `src/config/brand.config.json` — Configuration
2. `src/assets/logos/` — Logo
3. `src/assets/imgs/` — Hero background
4. `src/portfolio/assets/` — Showcase images
5. `src/portfolio/localization/en.yaml` — Text content

Everything else is reusable and shared across products.

---

## Verification Checklist

Before pushing to production, verify:

### 1. Configuration
- [ ] `brand.config.json` is valid JSON
- [ ] `defaultServiceId` matches your logo filename (without .svg)
- [ ] `brandColor` is a valid hex color
- [ ] All URLs in `serviceLinks` are correct
- [ ] At least 4 features defined
- [ ] Pricing values are realistic

### 2. Assets
- [ ] Logo exists at `src/assets/logos/{serviceId}.svg`
- [ ] Hero background at `src/assets/imgs/hero-bg.png` (2048×1440)
- [ ] 6+ showcase images at `src/portfolio/assets/vr-*.png`
- [ ] All images are optimized (< 2MB each)

### 3. Content
- [ ] Hero title, subtitle, CTA are filled in `en.yaml`
- [ ] All feature titles and descriptions are present
- [ ] Pricing section has realistic values
- [ ] FAQ has at least 4 Q&A pairs
- [ ] `yarn manage:translations` ran successfully

### 4. Testing
- [ ] `yarn dev` starts without errors
- [ ] Desktop flow: http://localhost:8081/en/subscribe shows portfolio
- [ ] Hero image displays correctly
- [ ] Payment widget appears with Apple Pay + Google Pay buttons
- [ ] All portfolio pages load (/pricing, /about, /contact)
- [ ] Language switching works (if multilingual)
- [ ] `yarn build` completes without errors
- [ ] `dist/` folder contains built assets

### 5. Git & Deployment
- [ ] Committed all changes to feature branch
- [ ] Created PR with description
- [ ] All tests pass
- [ ] Ready to merge to `development`

---

## Common Customizations

### Change the Hero Background
Replace `src/assets/imgs/hero-bg.png` with your image. The styling is in `src/portfolio/portfolio.scss` (`.pf-hero--subscribe` class).

### Add More Features
Edit `src/config/brand.config.json` — add entries to the `features` array. Each has `icon`, `title`, and `desc`.

### Change Primary Color
Edit `brand.config.json` → `brand.brandColor`. The color is applied globally via CSS variables.

### Add Testimonials
Edit `src/portfolio/localization/en.yaml` → `home.testimonials.*`. The component is in `src/portfolio/pages/Home.tsx`.

### Modify Pricing Display
Edit the pricing section in `en.yaml`. The component automatically renders `home.pricing.trialPrice` and `home.pricing.subscriptionPrice`.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module 'vr-1.png'" | Check that images exist in `src/portfolio/assets/` and filenames match imports in `Home.tsx` |
| "Logo not loading" | Verify the filename matches `defaultServiceId` (e.g., `myproduct.svg` if serviceId is `myproduct`) |
| "Hero background not showing" | Ensure `hero-bg.png` exists and is at least 2048×1440 |
| "i18n strings not updating" | Run `yarn manage:translations` after editing `en.yaml` |
| "Build fails with missing images" | Check image formats (should be .png or .svg) and file paths |

---

## Next Steps

1. **Understand the architecture?** Read `docs/1.ARCHITECTURE.md` (10 min)
2. **Need a quick reference?** See `docs/2.QUICK_REFERENCE.md` (5 min)
3. **Want to dive deep?** Read `docs/3.BLUEPRINT.md` (60 min)
4. **Ready to set up?** Follow the phases above (45 min total)
5. **Got a specific question?** Ask me directly — I can help with configuration, customization, troubleshooting, or even implement the entire setup for you

---

## Tips for Success

✅ **Do:**
- Start with a clone of the canonical template
- Use the checklist above before testing
- Run `yarn manage:translations` after any text change
- Test both desktop and mobile flows
- Commit incrementally and push to a feature branch

❌ **Don't:**
- Edit files in `src/__doNotModify/` (auto-generated by ouisys)
- Hardcode product-specific values in component files
- Forget to add all required showcase images
- Skip the verification checklist
- Push directly to main/master without PR

---

**Version:** 1.0  
**Last Updated:** May 28, 2026  
**Questions?** Ask me anytime — I understand every line of code in the system and can help with anything from configuration to full implementation.
