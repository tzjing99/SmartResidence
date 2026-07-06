# Business model & homepage positioning

> **Audience:** the product owner and anyone shaping pricing, packaging, and
> go-to-market for SmartResidence in the Malaysian market.
>
> **Scope:** this is a **proposal**. Pricing numbers are illustrative starting
> points for discussion, not committed prices. Feature availability is grounded
> in the actual repository as of this writing (see the "grounding" notes), with
> roadmap items clearly flagged.

---

## 1. Positioning in one line

> **SmartResidence is free to self-host and explore. Managed hosting is paid —
> for JMBs and property managers who'd rather run their building than run a
> server.**

The product is **AGPL-3.0 open source**. Anyone can clone it, run `pnpm dev`, and
stand up the whole stack on a cheap VPS for free. We make money by **operating it
for you** (managed cloud) and by **professional services** that get a Malaysian
condo live and compliant fast (MyInvois setup, payment-gateway onboarding, data
migration). This is the classic **open-core-adjacent "open source + managed
cloud"** model (à la GitLab, Sentry, Plausible) — with the honest twist that the
*whole app* is open, not a crippled community edition.

### Why this works for the Malaysian strata market

- **Trust through transparency.** JMB/MC committees are volunteers spending
  other owners' money. "The code is open, you can self-host, and every admin
  action is audited" is a uniquely strong pitch against closed incumbents.
- **Compliance is the wedge.** **MyInvois e-invoicing** (LHDN) and **SMA 2013**
  fund separation are becoming mandatory pain. Being **MyInvois-ready and
  PDPA-aware out of the box** is a concrete reason to switch — and a natural
  paid onboarding service.
- **Local payment rails.** Native **DuitNow QR** + Stripe/Fiuu/iPay88, with
  TNG/Boost/GrabPay reachable via aggregators, matches how Malaysians actually
  pay.

---

## 2. Free vs. paid — the boundary

The boundary is **who runs it and who's accountable**, not which features you
get. We do **not** paywall core management features in the open-source app.

| | **Free (self-host)** | **Paid (managed cloud)** |
| --- | --- | --- |
| Software | Full app, AGPL-3.0 | Same app, we operate it |
| Who runs infra | You (VPS, DB, backups, TLS, updates) | We do (managed Postgres/Redis/storage, backups, monitoring, upgrades) |
| Uptime / support | Community (GitHub) | SLA-backed support |
| Compliance setup | DIY (docs provided) | Guided / done-for-you add-ons |
| Cost | Your infra + your time | Subscription per condo/units |
| Best for | Tinkerers, tech-savvy JMBs, single buildings | JMBs/MCs and property managers who want it to "just work" |

> **Guardrail:** to keep goodwill and AGPL spirit, avoid moving *existing*
> open-source features behind the paywall. Monetize **operation, scale, support,
> and services** — plus genuinely new **platform/multi-condo** capabilities that
> mostly matter to larger paying operators.

---

## 3. Tiered pricing proposal

Four tiers. **Free** is self-host. **Starter / Pro / Enterprise** are managed
cloud, priced primarily **per building**, with unit-count bands as the main
scaling lever (condos naturally range from ~50 to ~1,000+ units).

> 💡 Numbers below (MYR/month) are **illustrative placeholders** to frame the
> shape of the model — validate against willingness-to-pay and incumbent pricing
> before publishing.

| | **Free — Self-host** | **Starter** | **Pro** | **Enterprise** |
| --- | --- | --- | --- | --- |
| **Who** | DIY JMB / developer | Small single condo | Growing condo / active JMB | Property manager / portfolio / large scheme |
| **Deployment** | You host | Managed cloud (shared) | Managed cloud (shared) | Managed (shared or **single-tenant**) |
| **Price (illustrative)** | RM 0 | ~RM 149/mo | ~RM 399/mo | Custom |
| **Condos** | Unlimited (your infra) | 1 | 1 | Multiple / portfolio |
| **Units** | Unlimited | up to ~150 | up to ~600 | Unlimited / banded |
| **Resident & guard mobile apps** | ✅ | ✅ | ✅ | ✅ |
| **Billing, deposits, receipts, ledger** | ✅ | ✅ | ✅ | ✅ |
| **Accounting reports + COB export pack** | ✅ | ✅ | ✅ | ✅ |
| **MyInvois e-invoice** | ✅ (self-configure) | Sandbox + self-serve | ✅ incl. guided setup add-on | ✅ managed setup |
| **Payment gateways** (Stripe/Fiuu/iPay88/DuitNow QR) | ✅ (your keys) | 1 gateway | Multiple gateways | Multiple + priority integration help |
| **Visitors (2-path, QR/access code, blacklist, recurring, delivery passes)** | ✅ | ✅ | ✅ | ✅ |
| **Defects, facilities, parcels, forms, documents, safety/SOS + patrol** | ✅ | ✅ | ✅ | ✅ |
| **Helpdesk threads + SLA engine + FAQ** | ✅ | ✅ | ✅ + auto-assignment tuning | ✅ + ML-assist (when data threshold met) |
| **Announcements + push/email notifications** | ✅ | ✅ | ✅ | ✅ |
| **WhatsApp notifications** | ✅ (your Twilio) | Metered add-on | Included allowance + metered overage | Volume pricing |
| **Governance-lite polls** | ✅ | ✅ | ✅ | ✅ |
| **Full AGM/EGM e-voting** *(roadmap)* | ✅ when shipped | — | add-on when shipped | ✅ when shipped |
| **Multi-condo / platform console** *(partial today)* | n/a | — | — | ✅ (as it matures) |
| **Support** | Community (GitHub) | Email, best-effort | Email + chat, next-business-day | Priority SLA, named contact, phone |
| **Backups & monitoring** | DIY | Daily backups | Daily backups + monitoring | HA options, custom RPO/RTO |
| **Custom domain** | DIY | — | ✅ | ✅ |
| **Data residency / single-tenant** | You choose | — | — | ✅ |

**Grounding:** every ✅ marked without "roadmap" reflects a module that exists in
the repo today (billing v2, deposits, ledger + COB exports, MyInvois seam,
DuitNow QR, 2-path visitors + blacklist/recurring/delivery passes, defects,
facilities, parcels, forms, documents vault, safety/patrol, helpdesk + SLA + FAQ,
announcements, push/email, WhatsApp seam, governance-lite polls). Items flagged
*(roadmap)* / *(partial today)* are **AGM/EGM e-voting** (not built) and the
**full multi-condo platform console** (role + `manage all` + partial UI exist;
full console is roadmap — see `docs/ROADMAP.md` §4.8, §4.14).

### Pricing levers to decide

- **Per-building vs per-unit vs per-active-resident** — recommend per-building
  with unit bands (simple for committees to reason about; predictable).
- **Annual discount** (e.g. 2 months free) to improve retention and cash flow.
- **JMB/non-profit or early-adopter discount** for the first cohort of reference
  customers.
- **WhatsApp** should be **metered pass-through + margin** (real per-message
  cost) rather than unlimited.

---

## 4. Managed services & add-ons (high-margin, low-commodity)

These are where an open-source project makes healthy revenue without paywalling
the software:

| Add-on | What it is | Rough pricing shape |
| ------ | ---------- | ------------------- |
| **Onboarding & setup** | White-glove condo bootstrap: blocks/units import, fee schedules, roles, resident invites | One-time per building |
| **MyInvois activation** | LHDN sandbox → production: TIN/MSIC config, credential setup, first-cycle validation | One-time + optional retainer |
| **Payment gateway integration** | Connect Stripe/Fiuu/iPay88/DuitNow QR, reconcile, test webhooks | One-time per gateway |
| **Data migration** | Import from spreadsheets / eCommunity / incumbent (units, owners, arrears, deposits) | Scoped project fee |
| **Custom domain + branding** | Vanity domain, logo/brand color, email sender | Setup + included in Pro/Enterprise |
| **Priority support / SLA** | Faster response, named contact, phone escalation | Monthly retainer / Enterprise tier |
| **Compliance assist** | COB filing pack help, SMA 2013 fund-separation review, PDPA data-handling checklist | Advisory engagement |
| **Training** | Committee & guard training, admin playbook | Per session |
| **Managed upgrades / dedicated hosting** | Single-tenant instance, custom RPO/RTO, maintenance windows | Enterprise |

> Note: consultants can also offer these against a **self-hosted** install — a
> healthy partner ecosystem, not a threat, since it drives adoption.

---

## 5. Target segments (Malaysia)

| Segment | Who they are | Primary jobs-to-be-done | Wedge |
| ------- | ------------ | ----------------------- | ----- |
| **JMB / MC committees** | Volunteer owner-committees running one building under SMA 2013 | Collect fees, stay compliant (fund separation, MyInvois, COB), keep owners informed, run AGMs | Transparency + compliance + affordable; self-host if tech-savvy, managed if not |
| **Property / building managers** | Firms managing multiple condos | Efficiency across a portfolio, standardized ops, professional reporting | Multi-condo (as platform console matures) + priority support + migration |
| **Developers / new launches** | Property developers handing over vacant possession | Defect/handover management, resident onboarding at VP, clean first impression | Handover/defect module + polished resident app + branding |
| **Guard/security companies** | Firms staffing guardhouses | Reliable gate flow, offline tolerance, visitor audit | Guard mobile app + 2-path visitors + offline queue |

**Buyer vs. user:** the **buyer** is usually the JMB chair/treasurer or the
property manager; the **users** are residents and guards. The mobile UX quality
is the retention/adoption engine; compliance + billing is the purchase trigger.

---

## 6. Revenue streams

1. **Managed cloud subscriptions** (Starter/Pro/Enterprise) — recurring, the core.
2. **Usage-based add-ons** — WhatsApp messaging, e-invoice volume, storage
   overage.
3. **Professional services** — onboarding, MyInvois activation, gateway
   integration, data migration, training (one-time / retainer).
4. **Enterprise / single-tenant hosting** — dedicated instances, data residency,
   custom SLAs.
5. **(Future) marketplace / partner referrals** — vetted contractors, insurers,
   payment partners — *only if it never becomes ads or resident-data sales*
   (explicit non-goal in the roadmap).

---

## 7. Go-to-market (rough)

**Phase 0 — Reference customers (now → next 1–2 quarters after mobile UX backlog)**
- Land **3–5 friendly JMBs** at steep/early-adopter discount; obsess over their
  success. Use them for testimonials, screenshots, and case studies.
- Publish the **self-hosting guide** and a **live demo** (seeded Acacia Heights).
- Content: "How to comply with MyInvois for your condo", "SMA 2013 fund
  separation explained" — SEO + credibility.

**Phase 1 — Product-led + compliance-led growth**
- Free self-host + free trial of managed cloud → convert on "we'll run it +
  MyInvois done-for-you".
- Partner with **property management firms** and **strata consultants** (they
  bring buildings; we bring software).
- Attend/table at strata management and JMB association events.

**Phase 2 — Portfolio expansion**
- Land property managers with multiple buildings once the **multi-condo platform
  console** matures; expand seat/units.

**Channels:** open-source community (GitHub, word of mouth), compliance content
marketing, property-manager partnerships, direct outreach to JMB committees.

---

## 8. Competitive angles

| Angle | The pitch |
| ----- | --------- |
| **MyInvois-ready** | LHDN e-invoice provider seam with sandbox → production; guided activation add-on. Compliance without a scramble. |
| **PDPA-aware & transparent** | RLS + CASL + immutable audit log; owners literally see *who viewed their unit's data*. Radical transparency is a feature, not a promise. |
| **e-wallet / DuitNow native** | DuitNow QR first-class + Stripe/Fiuu/iPay88; pay how Malaysians pay. |
| **SMA 2013-native** | Separate maintenance vs sinking fund in the ledger; arrears aging; COB-ready export pack; receipt register. |
| **AirBnB-grade UX** | Modern mobile apps for residents *and* guards vs. slow, ugly incumbents (e.g. eCommunity). |
| **Open source, no lock-in** | Self-host anytime; AGPL; export your data. Buyers aren't trapped — which paradoxically makes them more willing to buy the managed service. |
| **No ads, no data-selling** | The people who run the building pay for it; residents are never the product. |

**Honest gaps to acknowledge in sales** (from `docs/compliance/malaysia-strata-act.md`):
SmartResidence is **strata-native**, not a full chartered-accountant GL — no
double-entry chart of accounts depth, bank-rec worksheet, payroll, or asset
depreciation. Position against that honestly; integrate/export where needed.

---

## 9. Homepage messaging (draft copy — do NOT edit the live landing page)

> Copy only, for review. Voice: confident, plain-English, owner-empowerment.
> Matches the existing site's tone (transparency, AirBnB-grade UX, Malaysia-first).

### Hero

**Eyebrow:** Open-source condo & strata management — built for Malaysia

**Headline:** Run your building, not a spreadsheet.

**Subhead:** SmartResidence is a modern, transparent management platform for
condos and strata communities — billing, visitors, defects, facilities, and
governance in beautiful apps residents and guards actually like using.
**Free to self-host. Managed hosting when you'd rather we ran it.**

**Primary CTA:** Start free — self-host in minutes
**Secondary CTA:** See managed pricing

**Trust line (under CTAs):** MyInvois-ready · PDPA-aware · DuitNow QR &
e-wallets · AGPL open source

### Section — "Free to explore, paid when you're ready"

**Heading:** Two honest ways to run it

- **Self-host, free forever.** Clone it, run it on a $5 VPS, own your data. The
  whole app is open source — no crippled "community edition."
  *CTA: Read the self-hosting guide*
- **Let us run it.** Managed cloud with backups, monitoring, updates, and
  support. You focus on the building; we keep the lights on.
  *CTA: Compare plans*

### Section — Malaysia-first compliance

**Heading:** Compliance that isn't a scramble

**Body:** Separate maintenance and sinking funds the way SMA 2013 expects.
Generate COB-ready exports and receipt registers. Submit **MyInvois** e-invoices
to LHDN — sandbox first, production when you're ready. We'll even set it up for
you.

### Section — Owner empowerment / transparency

**Heading:** Radical transparency, by default

**Body:** Every consequential action is audited. Owners can see *who opened their
unit's record and when*. No hidden charges, no silent admin actions — because
it's your home and your money.

### Section — For residents & guards

**Heading:** Apps people actually like

**Body:** Residents pre-register visitors, pay fees with DuitNow QR, raise
defects, and book facilities from a fast, friendly mobile app. Guards check
guests in with a QR scan — even offline at the gate.

### Section — Pricing teaser

**Heading:** Simple pricing, per building

**Body:** Start free by self-hosting. Or go managed from **~RM149/mo** for a
small condo, scaling by units. Enterprise and single-tenant options for property
managers and portfolios. *(Illustrative — finalize before publishing.)*

**CTA:** View full pricing

### Final CTA band

**Heading:** Your community deserves better than eCommunity.

**Subhead:** Try it free today. Bring your JMB online this month.

**Buttons:** Start free (self-host) · Talk to us about managed hosting

---

## 10. Summary — what to decide next

1. **Confirm the free/paid boundary** (keep all core features open; monetize
   operation + services + platform-scale). ✅ recommended above.
2. **Validate price points** against willingness-to-pay and incumbents (these are
   placeholders).
3. **Pick the pricing lever** (per-building + unit bands recommended).
4. **Sequence paid-tier differentiators** to the roadmap — especially the
   **multi-condo platform console** and **AGM/EGM e-voting**, which are the most
   natural Pro/Enterprise upgrades but are **not fully built yet**.
5. **Stand up a public demo + self-host guide** as the top-of-funnel.
