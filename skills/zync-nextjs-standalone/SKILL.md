---
name: zync-nextjs-standalone
description: Use when creating, scaffolding, or extending any zync-nextjs-standalone project — self-contained Next.js full-stack apps with their own MongoDB via Typegoose. Triggers on "standalone standard", "zns", "follow standalone", "new standalone module", or when building any full-stack Next.js app (app + admin + own DB) in the ZyncGold ecosystem. Enforces the src/frontend + src/backend split structure canonical to zyncws.
---

# Zync Next.js Standalone Standard (zns)

## Overview

A **zync-nextjs-standalone** project is a self-contained Next.js full-stack app: no separate backend service, database accessed directly from API routes via Typegoose + Mongoose.

**Canonical reference:** [zyncws](/Users/sabiridwan/Projects/zyncws) — always read `src/backend/lib/base/` and `src/backend/modules/user/` before generating code.

**Stack:** Next.js 16+ (App Router), TypeScript strict, Mongoose 9 + `@typegoose/typegoose` 13, `next-auth` v4 (JWT), Tailwind CSS 3 (brand token system), `react-select` 5, Formik 2 + Yup 1.

**Auth pattern reference:** [zendocs-clone](/Users/sabiridwan/SamMedia/products/zendocs-clone) — Google OAuth via NextAuth, same `signIn` upsert + JWT stamp pattern.

---

## When to Use

- "Create a `<feat>` module following standalone standard / zns"
- Building a new feature in any zyncws-pattern project
- Scaffolding a brand new standalone Next.js + Mongo app

When NOT to use: NestJS backends (use `zync-be-standard`), pure admin dashboards with a separate API (use `zync-nextjs`), or mobile apps (use `zync-expo`).

---

## Step 0 — Read the canonical module first (always)

Before writing any file, read the target project's existing user module:

```bash
find src/backend/modules/user -type f | sort
find src/backend/lib/base -type f | sort
```

Mirror import paths exactly. Never assume.

---

## Layering (strict, never skip)

```
API Route → Service → Repository → Typegoose Model → MongoDB
```

- API routes call services only. Never import repositories or models in route handlers.
- Services contain all business logic.
- Repositories contain all Mongoose query logic. No raw queries outside repositories.
- Every service and repository is exported as a **pre-instantiated module singleton**:
  ```ts
  export const userService = new UserService()
  ```
  API routes import the singleton — no DI container.
- Frontend `service.ts` files call `fetch('/api/...')` — they NEVER import backend modules.
- Backend modules NEVER import from `frontend/`.

---

## Project File Layout

```
src/
├── app/                                 ← Thin Next.js wrappers ONLY — no logic here
│   ├── layout.tsx                       ← Root layout + <Providers>
│   ├── providers.tsx                    ← 'use client'; SessionProvider wrapper
│   ├── page.tsx                         ← Redirect / → default route
│   ├── login/page.tsx                   ← Renders LoginPage from frontend/modules/auth
│   ├── <feature>/page.tsx               ← Renders <FeaturePage> from frontend module
│   ├── admin/
│   │   ├── layout.tsx                   ← Server Component; requireAdmin() → redirect
│   │   └── <feature>/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── <resource>/route.ts          ← requireAuth(); calls service singleton; returns JSON
│       ├── <resource>/[ref]/route.ts
│       ├── admin/<resource>/route.ts    ← requireAdmin(); calls service singleton
│       └── admin/<resource>/[ref]/route.ts
│
├── frontend/
│   ├── components/
│   │   ├── ap/                          ← Shared Ap* components (re-exported from index.ts)
│   │   └── app/                         ← Shared chrome (Navbar, Sidebar, etc.)
│   ├── hooks/                           ← Shared React hooks
│   └── modules/
│       └── <feat>/
│           ├── <Feat>Page.tsx           ← Top-level page component rendered by app/
│           ├── model.ts                 ← Frontend TS interfaces (IFeat, IFeatProps)
│           ├── service.ts               ← fetch()/axios calls to /api/* routes (no backend imports)
│           └── components/              ← Feature-scoped UI components
│               └── *.tsx
│
├── backend/
│   ├── lib/
│   │   ├── base/
│   │   │   ├── base.schema.ts           ← BaseSchema (ref, createdBy, updatedBy, timestamps)
│   │   │   ├── base.repository.ts       ← AbstractBaseRepository<T>
│   │   │   └── base.service.ts          ← AbstractBaseService<T, R>
│   │   ├── auth.ts                      ← NextAuth options (Google OAuth)
│   │   ├── auth-guard.ts                ← requireAuth() — throws 'Unauthorized' if no session
│   │   ├── admin-guard.ts               ← requireAdmin() — throws 'Forbidden' if not admin
│   │   └── mongoose.ts                  ← connectToDatabase() singleton (global.__mongoose cache)
│   ├── modules/
│   │   └── <feat>/
│   │       ├── <feat>.schema.ts         ← Typegoose class extending BaseSchema; enums here
│   │       ├── <feat>.repository.ts     ← extends AbstractBaseRepository; domain queries
│   │       └── <feat>.service.ts        ← extends AbstractBaseService; exports singleton
│   └── scripts/                         ← Seed scripts; call connectToDatabase() explicitly
│
└── shared/
    └── types.ts                         ← Interfaces shared between frontend and backend
```

---

## Backend Module Pattern

### `<feat>.schema.ts`
```ts
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import mongoose from 'mongoose'
import { BaseSchema } from '@/backend/lib/base/base.schema'

export enum FeatStatus { ACTIVE = 'active', INACTIVE = 'inactive' }

@modelOptions({ schemaOptions: { collection: 'feats', timestamps: true } })
export class Feat extends BaseSchema {
  @prop({ type: () => String, required: true })
  public name!: string

  @prop({ type: () => String, enum: FeatStatus, default: FeatStatus.ACTIVE })
  public status!: string
}

// Registration guard — prevents "cannot overwrite model" on hot reload
export const FeatModel =
  (mongoose.models.Feat as mongoose.Model<Feat>) || getModelForClass(Feat)
```

### `<feat>.repository.ts`
```ts
import { AbstractBaseRepository } from '@/backend/lib/base/base.repository'
import { FeatModel, Feat } from './feat.schema'

export class FeatRepository extends AbstractBaseRepository<Feat> {
  constructor() { super(FeatModel) }
}

export const featRepository = new FeatRepository()
```

### `<feat>.service.ts`
```ts
import { AbstractBaseService } from '@/backend/lib/base/base.service'
import { Feat } from './feat.schema'
import { featRepository, FeatRepository } from './feat.repository'

export class FeatService extends AbstractBaseService<Feat, FeatRepository> {
  constructor() { super(featRepository) }

  async findByName(name: string) {
    await this.connectDb()
    return featRepository.findOne({ name })
  }
}

export const featService = new FeatService()
```

---

## API Route Pattern

```ts
// app/api/feats/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/backend/lib/auth-guard'
import { featService } from '@/backend/modules/feat/feat.service'

export async function GET() {
  try {
    await requireAuth()
    const data = await featService.find({})
    return NextResponse.json(data)
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : e.message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const result = await featService.create(body)
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

---

## Frontend Module Pattern

### `model.ts`
```ts
export interface IFeat {
  _id: string
  ref: string
  name: string
  status: string
  createdAt: string
}
```

### `service.ts`
```ts
import { IFeat } from './model'

export async function fetchFeats(): Promise<IFeat[]> {
  const res = await fetch('/api/feats')
  if (!res.ok) throw new Error('Failed to fetch feats')
  return res.json()
}

export async function createFeat(data: Partial<IFeat>): Promise<IFeat> {
  const res = await fetch('/api/feats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create feat')
  return res.json()
}
```

### `<Feat>Page.tsx` (top-level page component)
```tsx
'use client'
import { useEffect, useState } from 'react'
import { IFeat } from './model'
import { fetchFeats } from './service'

export default function FeatPage() {
  const [feats, setFeats] = useState<IFeat[]>([])

  async function load() {
    setFeats(await fetchFeats())
  }

  useEffect(() => { load() }, [])

  return <div>...</div>
}
```

---

## Auth — Google OAuth (follow zendocs-clone pattern)

`backend/lib/auth.ts` — GoogleProvider only, JWT strategy, upsert user on signIn:

```ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { userService } from '@/backend/modules/user/user.service'

export const authOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  })],
  session: { strategy: 'jwt' as const },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (account?.provider !== 'google' || !user.email) return false
      await userService.upsertFromGoogle({ email: user.email, name: user.name, image: user.image, googleId: profile?.sub })
      return true
    },
    async jwt({ token, user }: any) {
      if (user?.email) {
        const dbUser = await userService.findByEmail(user.email)
        if (dbUser) { token.id = String(dbUser._id); token.role = dbUser.role }
      }
      if (!token.role) token.role = 'user'
      return token
    },
    async session({ session, token }: any) {
      if (session.user) { session.user.id = token.id; session.user.role = token.role }
      return session
    },
  },
}
```

Login page: centered card, "Continue with Google" button, `signIn('google', { callbackUrl })`. Mirror [zendocs-clone login page](/Users/sabiridwan/SamMedia/products/zendocs-clone/src/app/login/page.tsx).

---

## BaseSchema — what every schema gets

- `ref` — 12-char hex public ID (`generateRef()`), indexed, unique. Use for URLs, never expose `_id`.
- `createdBy`, `updatedBy` — optional ObjectId refs.
- `timestamps: true` via `@modelOptions` → auto `createdAt` / `updatedAt`.

---

## DB Connection

`connectToDatabase()` in `backend/lib/mongoose.ts` uses `global.__mongoose` cache. Call at the top of every service and repository method — it's a no-op after first call. Never assume the connection exists.

---

## Design Token System (tailwind.config.ts)

Define all colors as `brand-*` tokens. Never hardcode hex values in components.

```
brand-accent    primary CTA
brand-bg        page background
brand-surface   card/panel background
brand-text      primary text
brand-border    borders
brand-muted     secondary text
brand-danger    destructive actions
brand-success   positive feedback
brand-warning   caution feedback
rounded-brand   border-radius default
font-brand      primary font stack
```

---

## Ap* Component Library

All live in `src/frontend/components/ap/`, `'use client'`, wired to Formik via `useField()`:

| Component | Purpose |
|---|---|
| `ApButton` | primary / danger variants with loading state |
| `ApTextInput` | text / email input |
| `ApPasswordInput` | password with show/hide |
| `ApNumberInput` | number input |
| `ApTextarea` | textarea |
| `ApSelectInput` | static react-select |
| `ApSelectInputAsync` | async-creatable react-select |

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Putting logic in `app/` page files | Move to `frontend/modules/<feat>/<Feat>Page.tsx` |
| Frontend importing backend modules directly | Frontend service.ts uses `fetch('/api/...')` only |
| Backend importing from `frontend/` | Never. One-way: backend is import-only by API routes |
| Raw Mongoose queries in service | All queries go in the repository |
| Forgetting `mongoose.models.X \|\| getModelForClass(X)` | Hot reload "cannot overwrite model" error |
| Assuming DB connection exists | Always call `connectToDatabase()` at top of service/repo methods |
| Hardcoding hex colors in components | Use `brand-*` Tailwind tokens |
| No `requireAuth()`/`requireAdmin()` on API routes | Every protected route must call the guard first |
| Calling `requireAdmin()` but not catching 403 | Wrap in try/catch, return `{ status: 403 }` on `'Forbidden'` |

---

## Canonical References

- **Structure:** [zyncws/src/](/Users/sabiridwan/Projects/zyncws/src) — `frontend/` + `backend/` split
- **Base abstractions:** [zyncws/src/backend/lib/base/](/Users/sabiridwan/Projects/zyncws/src/backend/lib/base/)
- **Auth (Google OAuth):** [zendocs-clone/src/lib/auth.ts](/Users/sabiridwan/SamMedia/products/zendocs-clone/src/lib/auth.ts) + [login page](/Users/sabiridwan/SamMedia/products/zendocs-clone/src/app/login/page.tsx)
- **Example module:** [zyncws/src/backend/modules/task/](/Users/sabiridwan/Projects/zyncws/src/backend/modules/task/)
