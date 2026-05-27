---
name: zync-srd
description: Use when the user wants to generate a System Requirements Document (SRD) for any project. Triggers on "write SRD", "create SRD", "system requirements document", "write a spec", "requirements for my project", or when the user gives a minimal project idea and wants it expanded into a full technical specification. Works for any tech stack, domain, or project type.
---

# Zync SRD — System Requirements Document Generator

Generate a complete, professional SRD from minimal input. Infer and expand everything possible from context; ask only what cannot be assumed.

## Step 1 — Gather Minimal Input (single message)

Ask the user only these questions — all in one go:

> 1. **Project name** — what's it called?
> 2. **One-liner** — what does it do and who uses it? (e.g. "staff leave management app for SMEs")
> 3. **Platform** — web app / mobile app / API / CLI / desktop / embedded / other?
> 4. **Tech preferences** — any stack constraints? (language, framework, DB) — or "flexible / don't know"
> 5. **Key features** — rough bullet list of modules or things it must do (don't worry about completeness)
> 6. **Hard constraints** — deadline, must-integrate-with, compliance (GDPR, HIPAA…), or "none"

Do NOT ask about non-functional requirements, data models, API design, or architecture — you will derive those.

## Step 2 — Infer & Expand

Before writing the document, silently reason through:

- **Domain patterns** — what features does this type of app always need? (auth, roles, notifications, audit trail, etc.)
- **Unstated requirements** — what will the user obviously need but didn't mention? (password reset, pagination, search, export, mobile responsiveness, error handling…)
- **Tech defaults** — if stack is flexible, pick pragmatic defaults that fit the platform and scale
- **Data entities** — what are the core models implied by the features?
- **Integration surface** — what external systems does this type of app typically connect to?
- **Security baseline** — what auth, RBAC, and data protection does this domain require by default?

Mark anything you assumed with `> ⚠️ Assumed: …` so the user can correct it.

## Step 3 — Output the Full SRD

Produce the complete document as one Markdown block. No preamble. Start immediately with the heading.

---

## Document Template

```markdown
# System Requirements Document — {Project Name}

**Version:** 1.0  
**Date:** {today}  
**Status:** Draft  
**Prepared by:** {author or "—"}

---

## 1. Overview

### 1.1 Purpose
{1-2 paragraphs: what problem this system solves and for whom}

### 1.2 Scope
{What is included. What is explicitly excluded (see §11).}

### 1.3 Definitions & Acronyms
| Term | Definition |
|------|------------|
| ...  | ...        |

---

## 2. Stakeholders & User Roles

| Role | Description | Key Needs |
|------|-------------|-----------|
| ...  | ...         | ...       |

---

## 3. Functional Requirements

> Requirements are grouped by module. Priority: **Must** (launch blocker) / **Should** (high value) / **Could** (nice to have).

### 3.1 {Module Name} (code: MOD)

**FR-MOD-001 — {Requirement Title}**  
**Priority:** Must  
**Description:** The system SHALL …  
**Acceptance Criteria:**
- [ ] …
- [ ] …

{Repeat per requirement and module}

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Response time: …
- Throughput: …
- Concurrent users: …

### 4.2 Security
- Authentication: …
- Authorisation: …
- Data at rest / in transit: …
- Audit trail: …

### 4.3 Scalability
- Expected growth: …
- Horizontal / vertical scaling approach: …

### 4.4 Reliability & Availability
- Uptime target: …
- Backup strategy: …
- Error handling: …

### 4.5 Usability & Accessibility
- Supported devices / browsers: …
- Accessibility standard: …

### 4.6 Maintainability
- Code standards: …
- Logging & monitoring: …

---

## 5. Tech Stack & Architecture

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | … | … |
| Backend | … | … |
| Database | … | … |
| Auth | … | … |
| Cache | … | … |
| Hosting | … | … |
| CI/CD | … | … |

**Architecture pattern:** {Monolith / Microservices / Serverless / MVC / …}

---

## 6. Module Breakdown

### 6.1 {Module Name}
**Purpose:** …  
**Key entities:** …  
**Core operations:** Create / Read / Update / Delete / {others}  
**Business rules:** …

{Repeat per module}

---

## 7. Data Models (high level)

> Entity-level overview only — no full schema.

### {Entity Name}
| Field | Type | Notes |
|-------|------|-------|
| id | UUID / ObjectId | Primary key |
| … | … | … |

{Repeat per entity}

---

## 8. API / Integration Surface

### Internal API
| Endpoint / Operation | Method | Description | Auth |
|----------------------|--------|-------------|------|
| … | … | … | … |

### External Integrations
| System | Purpose | Method |
|--------|---------|--------|
| … | … | REST / Webhook / SDK |

---

## 9. Security & Compliance

- **Authentication method:** …
- **Authorisation model:** RBAC / ABAC / …
- **Data residency:** …
- **Compliance requirements:** …
- **Sensitive data handling:** …
- **Rate limiting:** …

---

## 10. Constraints & Assumptions

| # | Type | Description |
|---|------|-------------|
| 1 | Constraint | … |
| 2 | Assumption | … |

---

## 11. Out of Scope (v1.0)

- …
- …

---

## 12. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | … | … | … |

---

## 13. What's Next

1. **Review** — go through the Open Questions and Assumed items; reply with corrections
2. **Architecture decision** — confirm tech stack (§5) before scaffolding
3. **First module to build** — suggested: {most foundational module, usually auth}
4. **Implementation reference** — {recommend a fitting standard or pattern based on stack}
```

---

## Requirement Writing Rules

- Use **SHALL** for mandatory, **SHOULD** for recommended, **MAY** for optional
- Every FR must be independently testable — if you can't write an acceptance criterion, rewrite it
- Number requirements sequentially within each module (FR-AUTH-001, FR-INV-002…)
- Infer obvious sub-requirements (e.g. "users" implies registration, login, password reset, profile)
- Flag every assumption with `> ⚠️ Assumed: …`

## NFR Defaults (apply unless user says otherwise)

- **Performance:** p95 API < 500ms; pages load < 2s on 4G
- **Security:** JWT or session auth; RBAC; HTTPS only; no PII in logs
- **Availability:** 99.5% uptime; graceful degradation
- **Accessibility:** WCAG 2.1 AA for web; screen-reader-friendly for mobile
- **Audit:** mutations log who did what and when

## Stack Defaults by Platform (if user says "flexible")

| Platform | Frontend | Backend | DB |
|----------|----------|---------|-----|
| Web app (full-stack) | Next.js + Tailwind | Next.js API routes | PostgreSQL or MongoDB |
| Web app (separate BE) | React / Next.js | Node + Express or NestJS | PostgreSQL |
| Mobile | React Native / Expo | REST or GraphQL API | — |
| API only | — | Node / Python / Go | PostgreSQL |
| Admin dashboard | Next.js + Ant Design | — (connects to existing API) | — |

Always include: TypeScript, env-based config, structured logging, Docker-ready.
