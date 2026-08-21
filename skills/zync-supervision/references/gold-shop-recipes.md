# Gold-shop CCTV recipes

Each recipe: what it answers, cameras, zones, the rule, the ERP join, and what makes it wrong.

Every recipe assumes the spine: `detector → tracker → zone/line → timer → rule → sink`.
Classes marked **(custom)** need a small Roboflow dataset trained on the shop's own footage
(200–500 labelled frames is usually enough) — everything else runs on a stock COCO person
model or RF-DETR.

Priority for a first deployment: **1, 2, 6, 8.**

---

## 1. Door line count — footfall and walk-in conversion

**Answers:** how many people came in per hour/day/branch, and — joined to ERP — what share
of them bought.

- **Camera:** entrance, corner mount, full body visible for ~2 m inside the door.
- **Geometry:** `sv.LineZone` drawn **inside** the shop, ~1.5 m past the threshold, not across
  the doorway plane. `triggering_anchors=(BOTTOM_CENTER,)`, `minimum_crossing_threshold=2`.
- **Rule:** none — pure counter. Flush `in_count`/`out_count` deltas every 15 min.
- **ERP join:** `footfall(branch, hour)` vs `count(invoices where branch, hour)` →
  **walk-in conversion %**. Second join: footfall vs staff on shift (HR module) →
  customers-per-staff-hour.
- **Wrong when:** staff stepping out for lunch inflate footfall (subtract recipe 5's staff
  count, or drop counts during the staff-door window); delivery/courier traffic counted as
  customers; a group of four counted as four "opportunities" when it is one purchase decision
  — report both raw footfall and *entries* (groups) if the sales team reads it as leads.

---

## 2. Showcase dwell time per counter

**Answers:** which showcase actually holds attention — bridal vs daily-wear vs bangles vs
gents — and therefore which deserves the front of the shop.

- **Camera:** overhead or high-corner covering the counter run.
- **Geometry:** one `sv.PolygonZone` per showcase section, covering the **customer side** of
  the counter, not the staff side. `triggering_anchors=(sv.Position.CENTER,)` on overhead.
- **Timer:** `ClockBasedTimer` per zone (live) / `FPSBasedTimer` (recorded).
- **Rule:** emit a `ZONE_DWELL` event on zone exit with `duration_seconds`; ignore <5 s
  (pass-through). Aggregate p50/p90 per zone per hour.
- **ERP join:** dwell seconds per counter vs **sales value by category** for the same hour.
  High dwell + low sales = pricing/making-charge objection or an unmanned counter, not a
  layout problem. Low dwell + high sales = the display is doing its job; don't move it.
- **Wrong when:** the staff member standing behind the counter falls inside the zone (their
  dwell is 8 hours — it drowns everything). Exclude the staff side geometrically; it is
  cheaper and more reliable than classifying staff.

---

## 3. Counter → till funnel

**Answers:** which counters generate bills versus which only generate browsing.

- **Geometry:** zones from recipe 2 + one zone at the billing/till area.
- **Rule:** per `tracker_id`, record ordered zone visits; on till-zone entry, attribute the
  visit to the last counter with dwell > 20 s. Emit `JOURNEY` event with the zone path.
- **ERP join:** journey count per counter vs invoice lines by category. Gives a true
  counter-level conversion rate, not just attention.
- **Wrong when:** IDs break on occlusion — a customer re-identified as a new ID after passing
  behind a pillar loses their history. Use BoT-SORT / a higher `lost_track_buffer`, and treat
  the funnel as directional evidence, not accounting.

---

## 4. Queue length and wait time at billing / cashier

**Answers:** staffing at the till, and whether people leave without paying attention paid.

- **Geometry:** polygon covering the queueing floor in front of the till.
- **Rule:** `occupancy = zone.current_count`; per-person `wait = timer.tick()`. Alert when
  `occupancy >= 4` for `min_duration=90 s`, `cooldown=600 s`. Also emit p90 wait per hour.
- **ERP join:** p90 wait vs invoice count per hour → the staffing curve. Wait spikes that
  coincide with high-value invoices (old-gold exchange takes longer) are expected — segment
  by invoice type before blaming the cashier.
- **Wrong when:** the queue is not a line but a scrum around the counter — polygon must cover
  where people actually stand, drawn from real footage.

---

## 5. Staff coverage per counter

**Answers:** is a counter unmanned during trading hours.

- **Approach A (geometric, preferred):** staff-side polygon behind each counter; anyone in it
  is staff. Zero model work.
- **Approach B:** train a **(custom)** `staff` class on uniform colour / lanyard. Needed only
  where staff and customers share floor space.
- **Rule:** `staff_count_in_zone == 0` AND `customer_count_in_zone >= 1` for `min_duration=60 s`
  during business hours → `COUNTER_UNATTENDED` alert to floor manager.
- **ERP join:** unattended-minutes per counter per day vs that counter's sales. Also feeds
  recipe 6 (a tray out with nobody behind the counter is the real risk condition).
- **Wrong when:** staff crouching to open a drawer disappear from an overhead view — require
  60 s, not 5 s.

---

## 6. Tray-out count and unattended tray — shrinkage control

**Answers:** the single highest-value CCTV question in a gold shop: *is more stock out of the
showcase than policy allows, and is any of it sitting there with nobody watching it.*

- **Model:** **(custom)** class `tray` (and optionally `open_showcase`). Train on the shop's
  own trays from the actual camera angle — this is a small, easy dataset.
- **Geometry:** counter-top polygon per counter; showcase polygon (where trays live at rest).
- **Rules:**
  - `trays_on_counter > policy_max` (typically 2) for `min_duration=30 s` → `TRAY_POLICY_BREACH`.
  - `trays_on_counter >= 1` AND `staff_in_staff_zone == 0` for `min_duration=20 s` →
    `TRAY_UNATTENDED` — highest severity, notify immediately with a clip.
  - `trays_on_counter >= 1` after closing time → `TRAY_NOT_SECURED`.
- **ERP join:** tray-out episodes per counter per day vs invoices from that counter. Many
  tray-outs, no sales, one salesperson — that is a pattern worth a stock take, and it pairs
  with the inventory module's physical count variance.
- **Wrong when:** you present this as theft detection. It is **policy monitoring**. The event
  is "policy condition observed", the action is "supervisor looks at the clip". Never let a
  vision event alone accuse a person or auto-create an inventory adjustment.

---

## 7. Strongroom / safe two-person rule

**Answers:** is dual control on the safe actually being followed.

- **Geometry:** polygon covering the strongroom / safe approach.
- **Rule:** `person_count == 1` in zone for `min_duration=45 s` during **any** hour →
  `DUAL_CONTROL_BREACH`, notify owner + branch manager, attach clip. `person_count >= 1`
  outside business hours → severity critical.
- **ERP join:** breach timestamps vs stock-issue / stock-receipt vouchers in the inventory
  module — a safe entry with no corresponding voucher inside ±10 min is the exception report.
- **Wrong when:** the zone includes a walkway past the safe. Draw it tight.

---

## 8. After-hours intrusion

**Answers:** someone is in the shop when nobody should be.

- **Geometry:** whole-floor polygon per camera (or reuse existing zones).
- **Rule:** any `person` detection, `min_duration=3 s`, outside the branch's business-hours
  calendar → `AFTER_HOURS_MOTION`, severity critical, push notification + 30 s clip.
- **ERP join:** business hours come from the branch/company config in zyncg-server, not a
  hardcoded constant — public holidays and stock-take nights matter. Suppress during
  scheduled overtime approved in the HR module.
- **Wrong when:** cleaners and the security guard trigger it nightly and everyone mutes the
  channel. Whitelist a scheduled window; that is a config row, not a code change.

---

## 9. Helmet / full-face covering at the entrance

**Answers:** grab-and-run precursor. Standard practice in jewellery retail — the shop wants
helmets removed before entry.

- **Model:** **(custom)** classes `helmet`, `face_covered` — or an off-the-shelf helmet model
  from Roboflow Universe fine-tuned on the door camera.
- **Geometry:** entrance zone (recipe 1's camera).
- **Rule:** `helmet` inside entrance zone for `min_duration=2 s` → `HELMET_AT_ENTRANCE`,
  severity high, silent alert to staff terminal (a loud alarm is the wrong response).
  Cooldown 120 s.
- **Wrong when:** rider deliveries all day → whitelist the delivery window/door, or require
  `helmet AND crossing the inner line` so the pavement doesn't fire it. Never make this
  ethnic-, gender- or garment-based: religious head covering is **not** face covering and
  must not be in the training set as a positive.

---

## 10. Loitering outside the entrance

**Answers:** casing behaviour before an incident.

- **Geometry:** pavement/frontage polygon on the external camera.
- **Rule:** same `tracker_id` present > `min_duration=300 s`, or ≥3 re-entries in 15 min →
  `LOITERING`, severity medium, to the guard. Suppress during peak footfall hours (a queue
  outside on a festival day is not loitering).
- **Wrong when:** the neighbouring shop's customers stand in your polygon. Tune geometry, not
  the threshold.

---

## 11. Old-gold weighing clip capture — dispute evidence

**Answers:** "the scale said 22.4 g, not 21.8" — the most common counter dispute in old-gold
buying, and the one that costs goodwill.

- **Camera:** dedicated over-the-scale camera at the old-gold/exchange counter.
- **Mechanism:** this one is **ERP-triggered, not vision-triggered**. When a purchase/exchange
  voucher is saved in zyncg-server, the server calls the edge agent (or the agent subscribes)
  with `{voucherNo, timestamp, counterId}`; the agent cuts the clip `[t-90 s, t+30 s]` from
  the rolling buffer, blurs faces, uploads, and attaches the URL to the voucher.
- **Optional vision layer:** **(custom)** OCR/`sv.Detections.from_easyocr` on the scale display
  to log the displayed weight independently, and flag when the displayed weight and the
  voucher weight differ by more than a tolerance.
- **ERP join:** clip URL stored on the purchase voucher (`upload` module handles storage).
  Retention 90 days minimum, longer for disputed vouchers.
- **Wrong when:** the buffer is not actually rolling. Keep a 5-minute ring buffer per counter
  camera or the clip does not exist when you need it.

---

## 12. Showcase heatmap

**Answers:** where customers physically stand — merchandising layout, not counting.

- **Tool:** `sv.HeatMapAnnotator(position=sv.Position.BOTTOM_CENTER, opacity=0.4, radius=25)`
  accumulated across a full trading day, exported as one PNG per camera per day.
- **Rule:** none. It is a picture for a human, produced daily.
- **Wrong when:** compared across days with different camera positions. Freeze the camera.

---

## 13. Workshop / karigar door

**Answers:** material moving into or out of the workshop without an open job order.

- **Geometry:** line at the workshop door + tray class from recipe 6.
- **Rule:** `tray` crosses the workshop line → `WORKSHOP_MOVEMENT`; the ERP side checks for a
  job-order issue/receipt within ±15 min (the `job-order` module already models this) and
  raises an exception only when none exists.
- **Wrong when:** treated as real-time policing of karigars. It is a daily exception report.

---

## Choosing thresholds

Every `min_duration` and `cooldown` above is a **starting point measured in the shop's own
footage**, not a constant. Procedure: run the recipe over a recorded peak hour, list every
event it would have fired, and have the branch manager mark each one useful/noise. Raise
`min_duration` until noise is under ~1 event per day per camera. An alert stream nobody reads
is worth less than no alert stream, because it creates the belief that the shop is monitored.
