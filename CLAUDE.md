# Global conventions (Sabir / ZyncGold)

I work across the **ZyncGold ERP** ecosystem. New projects should pick one of the four standards below and mirror the canonical reference repo. Don't reinvent patterns per project.

## The four standards

### zync-nestjs standard — backend services

Use for any new API / ERP backend service.

**Stack:** NestJS 9 + TypeScript, Apollo GraphQL (code-first), MongoDB via Mongoose 6 + `mongoose-delete`, Redis (ioredis), JWT + passport, `class-validator` / `class-transformer`, Jest 28 + `ts-jest`.

**Custom libs (always used):** `zync-nest-data-module` (`AbstractBaseService`, `AbstractBaseRepository`, `BaseSchema`), `zync-nest-library`.

**Layering (strict, never skip):**
```
Resolver → Service → Repository → Schema
```
- No business logic in resolvers
- No raw Mongoose queries outside repositories
- Resolvers extend `ApBaseResolver<T>`, use `@ApGqlAuthorize()` + `@AuditMeta()`
- Services extend `AbstractBaseService<T>`, inject `TransactionManager`
- Repositories extend `AbstractBaseRepository<Document>`, override `buildQuery()`, use `page()` / `handlePageFacet()` / `handlePageResult()`
- Schemas extend `BaseSchema`, register `mongoose-delete`

**Module file layout:** `<feat>.module.ts`, `.resolver.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`, `.dto.ts`, optional `.controller.ts`.

**DTO composition:**
```ts
class CommonInput { /* shared */ }
class CreateBranchInput extends CommonInput {}
class UpdateBranchInput extends PartialType(CommonInput) {}
class QueryBranchInput extends PartialType(CommonInput) {}
class BranchPageInput / BranchPageResult
```

**Multi-tenant:** always read `contextSvc.companyId` / `contextSvc.branchId`. Never hardcode.
**Schema:** `schema.gql` is generated — never hand-edit.
**Tests:** colocated `*.spec.ts`, use mocks not a real DB.

**Canonical reference:** [zyncg-server/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-server/CLAUDE.md) + [zyncg-server/src/modules/branch/](/Users/sabiridwan/Projects/zyncgold/zyncg-server/src/modules/branch/)

---

### zync-nextjs standard — Next.js admin dashboards / control planes

Use for any new internal dashboard, admin panel, or control plane.

**Stack:** Next.js 13+ (App or Pages), TypeScript strict, Tailwind CSS + optional SCSS globals, Apollo Client 3 (if GraphQL backend) **or** Axios + Next API routes (if self-contained), Formik 2 + Yup 1, Ant Design 5 for heavy UI, `next-auth`.

**Layering (strict):**
```
component → <Feature>Context → gql/query.ts → Apollo
                              (or axios → /api/*)
component → use<Feature>State() only
```

- Every module exposes a single `use<Feature>Query()` hook wrapping all `useMutation` / `useLazyQuery`.
- `context.tsx` is the **only** consumer of `use<Feature>Query()`. It holds state and exposes plain async methods (`xxxPage`, `createXxx`, `updateXxx`, `deleteXxx`) + state via `use<Feature>State()`.
- Components import `use<Feature>State()` only. They MUST NOT import from `gql/`, call `useMutation` / `useLazyQuery` / `useQuery` / `axios` / `fetch` / `/api/*` directly.
- If a component needs something the context doesn't expose, **extend the context** — don't reach past it.
- After any mutation, the context must trigger `reload()` / refetch.

**Module file layout:** `modules/<feat>/{components/, gql/{query,fragment}.ts, context.tsx, model.ts, page.tsx}`. Nest sub-features the same way.

**Naming:**
- Shared UI components prefixed `Ap` (`ApButton`, `ApTextInput`, `ApSelectInput`, `ApTable`, `ApModal`)
- Interfaces prefixed `I` (`IItem`, `IProps`, `IModal<'create'|'update'>`)
- Hooks `use<Thing>` / `use<Feature>State`
- GraphQL ops: `SCREAMING_SNAKE` (`ITEM_PAGE`, `CREATE_ITEM`)
- Files: components `PascalCase.tsx`; feature files `model.ts`, `context.tsx`, `page.tsx`

**Forms:** Formik + Yup. Inputs wired through `Ap*` components (they use `useField()`). `FormSchema` lives in the component file.

**Selects with create flow:** use `ApSelectInputAsync` with `createable` + `onCreateOption` → open same create modal, pre-fill typed value. No detail/history links next to selects.

**No new state libs** — stick to React Context. No Redux, no Zustand.

**Canonical references:**
- GraphQL-backed admin: [zyncg-admin/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-admin/CLAUDE.md) + [zyncg-admin/src/modules/branch/](/Users/sabiridwan/Projects/zyncgold/zyncg-admin/src/modules/branch/)
- Self-contained (Mongo via API routes): [zyncg-master/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-master/CLAUDE.md)

---

### zync-expo standard — React Native apps (Expo)

Use for any new mobile app (iOS/Android/Web) built on Expo.

**Stack:** Expo 52+ + React Native, Expo Router (file-based `/app`), NativeWind 4, Apollo Client (primary) + optional `graphql-request` / Axios for REST, Formik + Yup, React Context for state.

**Layering (same as zync-nextjs):**
```
screen/component → <Feature>Context → gql/query.ts → Apollo
```

- `app/*.tsx` route files stay thin — auth guard + `<FeatureScreen />` only. All logic in `src/modules/<feat>/screen.tsx`.
- Same `use<Feature>Query()` / `use<Feature>State()` rules as zync-nextjs.
- Apollo hooks / `useAxios` only callable from `context.tsx` or `service.ts`.

**Module file layout:** `src/modules/<feat>/{screen.tsx, context.tsx, service.ts, model.ts, gql/{query,fragment}.ts, components/}`.

**Naming:** same `Ap*` / `I*` / `<Feature>Screen` / `use<Feature>State` conventions.

**Theme:** colors + fonts from `theme.ts` (or `ApTheme.Color.*`). Never hardcode hex.
**Uploads:** custom Apollo upload link (multipart FormData).
**Errors:** route GraphQL errors through `ToastService.GraphQLError(err)`.
**Auth:** token in AsyncStorage, injected via Apollo auth link; auto-signout on 401.

**No AsyncStorage access from components** — go through auth context / services.

**Canonical references:**
- Customer-facing: [zyncg-app/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-app/CLAUDE.md)
- Staff / POS: [zyncg-staff-app/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-staff-app/CLAUDE.md)

---

### zync-nextjs-standalone standard — self-contained Next.js full-stack apps

Use when the product needs both a public/mobile-first app shell **and** an admin dashboard, with the database accessed directly from Next.js API routes (no separate backend service).

**Stack:** Next.js 16+ (App Router), TypeScript strict, Mongoose 9 + `@typegoose/typegoose` 13 (decorator-based schemas), `next-auth` v4 (JWT + CredentialsProvider), Formik 2 + Yup 1, `react-select` 5, Tailwind CSS 3 (brand token system).

**Canonical references:**
- [zyncws](/Users/sabiridwan/Projects/zyncws) — primary canonical reference for the `src/frontend` + `src/backend` split structure used in all new projects. Read `src/backend/lib/base/` and `src/backend/modules/task/`.
- [wzb-app](/Users/sabiridwan/Projects/wazobia/wzb-app) — legacy reference; older flat `src/modules/` layout (no frontend/backend split).
- **Skill:** invoke `zync-nextjs-standalone` skill for step-by-step scaffolding guidance.

---

#### Layering (strict, never skip)

```
API Route → Service → Repository → Typegoose Model → MongoDB
```

- API routes call services only. Never touch repositories or models directly.
- Services contain all business logic. They call repository methods and other services.
- Repositories contain all Mongoose query logic. No raw queries outside repositories.
- Every service and repository is exported as a **pre-instantiated module singleton** (e.g. `export const userService = new UserService()`). API routes import the singleton — no DI container.

---

#### Base abstractions (src/lib/)

**`base.schema.ts` — BaseSchema**

Every Typegoose schema class extends `BaseSchema`. Provides:
- `ref` — 12-char hex public ID (via `generateRef()`), indexed, unique, sparse. Use this for URLs, never expose `_id`.
- `createdBy`, `updatedBy` — optional `ObjectId` refs.
- `timestamps: true` via `@modelOptions` → auto `createdAt` / `updatedAt`.

**`base.repository.ts` — AbstractBaseRepository\<T\>**

Constructor receives the Typegoose model. Provides: `findById`, `findOne`, `find`, `create`, `update` (`$set`), `delete`, `createMany`, `updateMany`, `paginate`, `count`, `findByRef`. All reads use `.lean()`. `paginate` accepts `{ page, limit, sort, filter }` → returns `{ data, total, page, limit }`.

**`base.service.ts` — AbstractBaseService\<T, R\>`**

Thin delegation over the repository. Subclasses inject a concrete repository and add domain methods.

**`lib/mongoose.ts` — DB connection singleton**

`connectToDatabase()` uses `global.__mongoose` cache. Call it at the top of every service and repository method — it is a no-op after the first call in a process. Never assume the connection exists; always call it explicitly.

**`lib/auth.ts` — NextAuth options**

JWT strategy. Two `CredentialsProvider` instances: `phone` (OTP-verified login, no password) and `admin` (email + bcrypt password, role check). JWT callback stamps `id`, `role`, `locationVerified`, `phoneNumber`. Type-augment in `src/types/next-auth.d.ts`.

**`lib/admin-guard.ts` — requireAdmin()**

Call at the top of every admin API route. Throws `'Forbidden'` if session is missing or `role !== ADMIN`. Routes catch and return 403. No Edge middleware — all guards are Server Components + route handlers.

---

#### Project file layout

All new zync-nextjs-standalone projects use a **`src/frontend` + `src/backend` split** (canonical: [zyncws](/Users/sabiridwan/Projects/zyncws)):

```
src/
├── app/                          ← Thin Next.js wrappers ONLY — no logic here
│   ├── layout.tsx                ← Root layout: fonts, <Providers> (SessionProvider only)
│   ├── providers.tsx             ← 'use client'; SessionProvider wrapper
│   ├── page.tsx                  ← Redirects / → default route
│   ├── <feature>/page.tsx        ← Renders <FeaturePage> from frontend module
│   ├── admin/
│   │   ├── layout.tsx            ← Server Component; requireAdmin() → redirect if not ADMIN
│   │   └── <feature>/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── <resource>/route.ts           ← requireAuth(); calls service singleton
│       ├── <resource>/[ref]/route.ts
│       ├── admin/<resource>/route.ts     ← requireAdmin(); calls service singleton
│       └── admin/<resource>/[ref]/route.ts
│
├── frontend/
│   ├── components/
│   │   ├── ap/                   ← Shared Ap* components (ApButton, ApTextInput, etc.)
│   │   └── app/                  ← Shared chrome (Navbar, etc.)
│   ├── hooks/                    ← Shared React hooks
│   └── modules/
│       └── <feat>/
│           ├── <Feat>Page.tsx    ← Top-level page component rendered by app/
│           ├── model.ts          ← Frontend TypeScript interfaces (IFeat, IFeatProps)
│           ├── service.ts        ← fetch() / axios calls to /api/* routes
│           └── components/       ← Feature-scoped UI components
│               └── *.tsx
│
├── backend/
│   ├── lib/
│   │   ├── base/
│   │   │   ├── base.schema.ts
│   │   │   ├── base.repository.ts
│   │   │   └── base.service.ts
│   │   ├── auth.ts               ← NextAuth options
│   │   ├── auth-guard.ts         ← requireAuth()
│   │   ├── admin-guard.ts        ← requireAdmin()
│   │   └── mongoose.ts           ← connectToDatabase() singleton
│   ├── modules/
│   │   └── <feat>/
│   │       ├── <feat>.schema.ts      ← Typegoose class extending BaseSchema; enums here
│   │       ├── <feat>.repository.ts  ← extends AbstractBaseRepository; domain queries
│   │       └── <feat>.service.ts     ← extends AbstractBaseService; exports singleton
│   └── scripts/                  ← One-off seed scripts; call connectToDatabase() explicitly
│
└── shared/
    └── types.ts                  ← Interfaces shared between frontend and backend
```

**Key rules:**
- `app/` pages do nothing except import and render the module's `<FeaturePage>` component.
- `app/api/` routes do nothing except call the backend service singleton and return JSON.
- Frontend `service.ts` files call `fetch('/api/...')` — they never import backend modules directly.
- Backend modules never import from `frontend/`.
- `shared/` is the only cross-boundary import allowed.

**Typegoose model registration guard:** always use `mongoose.models.X || getModelForClass(X)` to prevent "cannot overwrite model" errors on hot reload.

No `.module.ts`, no `.resolver.ts`, no `.dto.ts` — this is not NestJS. Add `.client.ts` for long-lived external clients (use `globalThis` singleton to survive hot reloads).

---

#### API route conventions

- Export named async functions: `GET`, `POST`, `PATCH`, `DELETE`.
- Admin routes: first line is always `await requireAdmin()` (or equivalent).
- Wrap all handlers in try/catch; return `NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 500 })`.
- Admin mutations must call `auditService.log({ adminId, action, targetId, targetType, metadata })`.

---

#### UI component patterns

**Shared `Ap*` components** live in `src/frontend/components/ap/`, re-exported from `index.ts`. All are `'use client'` and wired to Formik via `useField()` — no manual `field` prop threading.

| Component | Purpose |
|---|---|
| `ApTextInput` | text / email input |
| `ApPasswordInput` | password with show/hide |
| `ApNumberInput` | number input |
| `ApDateInput` | date input |
| `ApTextarea` | textarea |
| `ApSelectInput` | static react-select |
| `ApSelectInputAsync` | async-creatable react-select |
| `ApPhoneInput` | country flag + digit composite |
| `ApButton` | primary / danger variants with loading state |

All inputs show label + touched error automatically.

**App shell** (`src/frontend/components/app/`): `ApHeader` (sticky 3-zone: left/center/right slots), `ProfileAvatar` (fixed avatar linking to /profile).

**Admin shell** (`src/frontend/components/admin/`): `Sidebar` (fixed nav with active state via `usePathname`, sign-out button).

---

#### Design token system (tailwind.config.ts)

Define all colors as `brand-*` tokens. Never hardcode hex values in components.

```
brand-accent   primary CTA (dark green default)
brand-bg       page background
brand-surface  card/panel background
brand-text     primary text
brand-border   borders
brand-muted    secondary text
brand-danger   destructive actions
brand-success  positive feedback
brand-warning  caution feedback
rounded-brand  border-radius default
font-brand     primary font stack
```

Also define `selectStyles.ts` in `src/frontend/components/ap/` exporting `buildSelectStyles(hasError)` returning a `react-select StylesConfig` aligned to brand tokens.

---

#### State management

No global state library. No Context providers beyond `SessionProvider`. Pages own their data with local `useState` / `useEffect` + `fetch()` calls to `/api/*` routes. After mutations, pages call a local `load()` function to refetch or update state optimistically.

This is intentionally simpler than the zync-nextjs standard (no `use<Feature>State()` / `FeatureContext` layer).

---

#### Forms

Formik 2 + Yup. Define a `Yup.object({...})` schema at module or component scope. Wrap in `<Formik initialValues validationSchema onSubmit>`. Use `Ap*` components inside `<Form>` — they connect via `useField()` internally. `onSubmit` receives `(values, { setSubmitting, resetForm })`.

For simple forms without validation needs, raw controlled `useState` + `e.preventDefault()` is acceptable.

---

#### Auth flow (OTP)

1. User submits phone → `POST /api/auth/otp` (generate) → OTP stored bcrypt-hashed with 10-min TTL.
2. User submits code → `POST /api/auth/otp` (verify) → `bcrypt.compare`, marks `used: true`.
3. On success, client calls `signIn('phone', { phoneNumber })` → NextAuth `phone` CredentialsProvider → JWT session.

---

#### Config system

Store runtime key/value pairs as MongoDB documents in a `configs` collection. Define `CONFIG_KEYS` and `CONFIG_DEFAULTS` constants in `src/modules/config/config.schema.ts`. Admin edits via `/admin/config` page. Never hardcode values that operators should be able to change.

---

#### Seeding

One-off bootstrap scripts in `src/scripts/`. Run via `npm run seed` using `ts-node` + `tsconfig-paths`. Scripts call `connectToDatabase()` explicitly, perform upserts, then disconnect.

---

#### Naming conventions

- Module files: `<feature>.schema.ts`, `<feature>.repository.ts`, `<feature>.service.ts`
- Enum values: `SCREAMING_SNAKE` keys, lowercase string values (`UserRole.ADMIN = 'admin'`)
- Shared components: `Ap` prefix
- Interfaces: `I` prefix
- Files: kebab-case dot-segmented by role

---

## Universal rules (all three standards)

- **Commits:** Conventional Commits with scope — `feat(item): …`, `fix(invoice): …`.
- **File names:** kebab-case (`branch.service.ts`), dot-segmented by role.
- **Class names:** PascalCase with role suffix (`BranchService`, `BranchRepository`).
- **Module-first:** features self-contained; never split a feature by technical layer across the tree.
- **Context owns state; components are dumb.** This is non-negotiable.
- **No new state libs.** React Context only. No Redux/Zustand/MobX.
- **Extend before reach-through.** If the context doesn't expose what you need, add to the context — don't bypass it.

## Counter-examples — projects that do NOT follow the standards

- **zyncg-web** is a static marketing site (Next.js 16 + Framer Motion + Formspree). No Apollo, no auth, no `Ap*` components, no module pattern. Don't use it as a template for SaaS work. See [zyncg-web/CLAUDE.md](/Users/sabiridwan/Projects/zyncgold/zyncg-web/CLAUDE.md).

## When starting a new project

1. Identify which standard fits: backend → **zync-nestjs**, admin/dashboard → **zync-nextjs**, full-stack standalone (app + admin + own DB) → **zync-nextjs-standalone**, mobile → **zync-expo**.
2. Read the canonical reference's CLAUDE.md (paths above) for the full detail.
3. Scaffold following the module file layout for that standard.
4. Run `/init` once there's code, to generate a project-specific CLAUDE.md that inherits from and extends the standard. Reference the canonical repo in the new CLAUDE.md rather than duplicating rules.
5. If the new project genuinely needs to deviate from the standard, document the deviation and the reason in its CLAUDE.md — don't silently diverge.
