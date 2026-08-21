# ERP integration — vision events in zyncg-server

The edge agent is dumb on purpose: it detects conditions and posts events. All aggregation,
alerting policy, retention and reporting lives in the ERP, where tenancy, permissions and
audit already work.

Scaffold the module with the **`zync-be-standard` skill** — this file is the contract, not a
substitute for the standard. Layering stays `Resolver → Service → Repository → Schema`.

## Module: `src/modules/vision/`

```
vision/
  camera/            camera registry (branch, rtsp ref, zones JSON, health)
  event/             raw vision events (ingest + query)
  aggregate/         hourly/daily rollups (footfall, dwell, occupancy)
  vision.module.ts
```

Reuse what exists rather than inventing: `device` for the edge box identity (a camera is a
device with `properties`), `branch` for tenancy, `notification` for alert delivery,
`upload` for clip storage, `audit-trail` for who acknowledged which alert.

## Event schema (sketch — follow `BaseSchema` + `mongoose-delete` as in `device.schema.ts`)

```ts
export enum VisionEventType {
  LINE_CROSS = "LINE_CROSS",              // recipe 1
  ZONE_DWELL = "ZONE_DWELL",              // recipe 2
  JOURNEY = "JOURNEY",                    // recipe 3
  QUEUE_OCCUPANCY = "QUEUE_OCCUPANCY",    // recipe 4
  COUNTER_UNATTENDED = "COUNTER_UNATTENDED",
  TRAY_POLICY_BREACH = "TRAY_POLICY_BREACH",
  TRAY_UNATTENDED = "TRAY_UNATTENDED",
  TRAY_NOT_SECURED = "TRAY_NOT_SECURED",
  DUAL_CONTROL_BREACH = "DUAL_CONTROL_BREACH",
  AFTER_HOURS_MOTION = "AFTER_HOURS_MOTION",
  HELMET_AT_ENTRANCE = "HELMET_AT_ENTRANCE",
  LOITERING = "LOITERING",
  WORKSHOP_MOVEMENT = "WORKSHOP_MOVEMENT",
  CAMERA_HEALTH = "CAMERA_HEALTH",
}

export enum VisionSeverity { INFO, LOW, MEDIUM, HIGH, CRITICAL }

@Schema({ collection: "vision_events", timestamps: true })
export class VisionEvent extends BaseSchema {
  @Prop({ required: true, unique: true }) eventKey: string;   // idempotency — see below
  @Prop({ required: true, enum: VisionEventType }) type: VisionEventType;
  @Prop({ enum: VisionSeverity, default: VisionSeverity.INFO }) severity: VisionSeverity;
  @Prop({ required: true }) cameraId: string;                  // device.deviceId
  @Prop() zoneKey: string;                                     // "counter.bridal"
  @Prop({ required: true }) occurredAt: Date;                  // edge clock (UTC)
  @Prop() endedAt: Date;
  @Prop() durationSeconds: number;
  @Prop() count: number;                                       // occupancy / crossings
  @Prop({ type: Object }) meta: Record<string, any>;           // trackerRef, classCounts…
  @Prop() clipUrl: string;
  @Prop({ default: false }) acknowledged: boolean;
  // companyId / branchId come from BaseSchema tenancy — never from the request body
}
```

Rules that matter:

- **`eventKey` is the idempotency key**, generated on the edge as
  `sha1(cameraId|type|zoneKey|startedAtEpoch)`. Replay after a network outage must not double
  the footfall. Unique index, upsert on ingest.
- **Never persist `tracker_id` as an identity.** Store it hashed per day inside `meta` if the
  journey report needs it, and expire it. It is a session artefact, not a person.
- **`companyId` / `branchId` from `contextSvc`** (or from the device record on the REST path),
  never from the payload. Standard rule, and here it is also a security boundary — the edge
  box must not be able to write into another branch.

## Ingest — REST, not GraphQL

The edge agent is a machine, not a logged-in user. Add `vision.controller.ts` with an API-key
guard resolving to a `Device`, mirroring the existing `device.controller.ts` pattern.

```
POST /vision/events        x-device-key: <key>     body: { events: VisionEventInput[] }  # batch, ≤500
POST /vision/heartbeat     x-device-key: <key>     body: { cameraId, fps, lastFrameAt, dropped }
GET  /vision/config        x-device-key: <key>     → zones, business hours, thresholds, policy_max
```

`GET /vision/config` is what makes the deployment maintainable: zone polygons, business hours
and thresholds are ERP config rows, so the branch manager changes a threshold in the admin
app instead of someone SSHing into the shop box. The agent polls it every 5 min.

Batch ingest returns `{ accepted, duplicates, rejected }` — the agent only clears its local
buffer for accepted + duplicate keys.

## Read side — GraphQL, standard resolvers

```
visionEventPage(input: VisionEventPageInput): VisionEventPageResult
visionFootfall(input: { branchId, fromDate, toDate, granularity }): [FootfallBucket]
visionZoneDwell(input: { branchId, zoneKey, fromDate, toDate }): [ZoneDwellBucket]
visionAlertFeed(input: { branchId, severity, acknowledged }): [VisionEvent]
acknowledgeVisionEvent(id: ID!, note: String): VisionEvent     # @AuditMeta()
```

Aggregates are precomputed hourly by a cron in the aggregate service — never scan raw events
for a dashboard. Raw events TTL out (e.g. 90 days); aggregates are kept.

## The joins that make this worth building

| Report | Vision side | ERP side |
|---|---|---|
| **Walk-in conversion** | `LINE_CROSS` in-count per branch-hour | invoice count, same branch-hour |
| **Revenue per visitor** | in-count | invoice net total ÷ in-count |
| **Counter ROI** | `ZONE_DWELL` p50 + visit count per counter | sales value by category, same hour |
| **Staffing curve** | footfall + queue p90 wait | HR shift roster, invoices per staff-hour |
| **Shrinkage watch** | `TRAY_*` episodes per counter/day | inventory physical-count variance, sales from that counter |
| **Safe discipline** | `DUAL_CONTROL_BREACH` | stock issue/receipt vouchers ±10 min |
| **Old-gold dispute pack** | clip URL from recipe 11 | purchase/exchange voucher (`upload` module) |
| **Workshop exceptions** | `WORKSHOP_MOVEMENT` | open job orders ±15 min (`job-order` module) |

Conversion is the headline number. It is also the one most likely to be wrong — staff and
couriers inflate footfall, groups deflate conversion. Publish the definition next to the
number, and let the branch manager hand-count one hour a month to keep everyone honest.

## Alerting

Vision events raise notifications through the existing `notification` module. Severity maps to
channel (INFO → dashboard only, HIGH/CRITICAL → push). Recipients per branch, configurable.

**A vision event never mutates business data.** It does not adjust stock, does not block a
transaction, does not write to the ledger, does not create an HR case. It creates a *task for
a human*, and the human's decision is what gets audited.

## Admin UI (zyncg-admin, zync-nextjs standard)

Module `modules/vision/` with the usual `context.tsx` + `use<Feature>State()` split:
live alert feed, camera health strip, footfall/conversion chart, dwell-by-counter bars, daily
heatmap image, zone editor (upload a frame, draw polygons, save to `GET /vision/config`).
Follow `trial-balance/page.tsx` for report layout conventions.
