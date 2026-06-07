# MapBlock: Merchant information on POIs

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Editor extension shared between `apps/admin` (mx-core) and `apps/web` (Yohaku)

## Problem

`MapPoi` currently stores only `{lat, lon, title?, description?, icon?}`. When
a POI represents a real business (cafe, antique shop, bookstore), the author
has no way to capture its address, phone, hours, website, social handles,
or category. The renderer's popover, in turn, has nothing richer to display.

The personal-blog use case is "I visited this place; here's what it was."
The data should be self-contained in the post (no live external lookup at
render time), but as much as possible should be auto-filled by the editor
to keep authoring frictionless.

## Goal

Extend `MapPoi` with an optional `merchant` sub-object, auto-fill it from
OpenStreetMap (OSM) data when available, and let Yohaku render a richer
split-layout (map + detail panel) whenever any POI carries merchant info.

## Non-goals

- Live data refresh on render. The merchant fields are snapshotted at
  insert time, identical to the AfilmoryNode dims pattern. If the author
  wants to refresh, they re-open the insert dialog.
- Backend services or DB migrations. All data lives in the lexical node.
- Server-side cron / periodic refresh. Out of scope and conflicts with
  the snapshot semantics.
- Paid place APIs (Google Places, Foursquare). OSM Nominatim is sufficient
  for personal-blog volumes and matches the existing geocode dependency.
- Admin (editor) renderer changes beyond the dialog. The on-canvas POI
  popover in the admin editor stays as-is — only the insert dialog grows
  the new form section, and only Yohaku gets the split layout.

## Data model

### Schema (both packages, kept in sync)

Add `MapMerchant` and an optional `merchant` field on `MapPoi`. The shape
lives in both:

- `apps/admin/src/vendor/rich-editor/extensions/map/types.ts`
- `apps/web/src/components/ui/rich-content/map/...` (mirror — verify exact
  path during implementation; Yohaku has a parallel `MapPoi` type)

```ts
export interface MapMerchant {
  address?: string
  phone?: string
  website?: string
  openingHours?: string // OSM-style raw string, e.g. "Mo-Fr 09:00-19:00"
  category?: string // e.g. "cafe", "antique_shop" (OSM class+type when available)
  priceRange?: string // free-form, e.g. "$", "$$", "$$$"
  socialHandles?: { instagram?: string; twitter?: string }
  tags?: string[] // author-supplied freeform descriptors
}

export interface MapPoi {
  lat: number
  lon: number
  icon?: 'pin'
  title?: string
  description?: string
  merchant?: MapMerchant
}
```

A POI is treated as "a merchant" iff `poi.merchant != null`. Absence falls
back to the existing simple POI behavior end-to-end.

`priceRange` and `tags` have no OSM equivalent and are pure manual fields.
Everything else can be auto-filled by OSM when present.

## OSM auto-fill (admin dialog only)

### Search request

`apps/admin/src/vendor/rich-editor/extensions/map/geocode.ts` currently
calls Nominatim with `format=jsonv2`. Extend the query string with:

- `extratags=1`
- `addressdetails=1`

One request returns geocoding + business tags + structured address. No
extra round-trips, no API key, no GCP project, no billing. Free public
endpoint with a `User-Agent: mx-space-admin/<version>` header (already
required by Nominatim ToS — verify present and add if missing).

### Mapping (OSM → MapMerchant)

| OSM field | MapMerchant field |
|---|---|
| `extratags.phone` ∥ `extratags["contact:phone"]` | `phone` |
| `extratags.website` ∥ `extratags["contact:website"]` | `website` |
| `extratags.opening_hours` | `openingHours` |
| `class` + `type` (e.g. `amenity=cafe` → `"cafe"`) | `category` |
| `extratags["contact:instagram"]` | `socialHandles.instagram` |
| `extratags["contact:twitter"]` ∥ `["contact:x"]` | `socialHandles.twitter` |
| `address` fields joined (`road`, `house_number`, `city`) | `address` |

A `GeocodeResult` is now:

```ts
export interface GeocodeResult {
  displayName: string
  lat: number
  lon: number
  type?: string // OSM class+type, used for category
  merchantSuggestion?: MapMerchant // built from extratags + address
}
```

A helper `buildMerchantFromOsm(raw): MapMerchant | undefined` lives next
to `geocode.ts` and returns `undefined` when no merchant-shaped tags are
present (so the dialog can decide whether to default-open the merchant
form section).

### Dialog UX (InsertLocationDialog)

`apps/admin/src/vendor/rich-editor/extensions/map/InsertLocationDialog.tsx`
grows one collapsible section: **Merchant info**.

- Collapsed by default unless the picked result carries
  `merchantSuggestion`, in which case it auto-expands with prefilled
  fields and a small "Auto-filled from OSM" label.
- A toggle (`[ ] Mark as merchant`) lets the author opt in when OSM did
  not classify the place as a business. Toggling on opens an empty form.
- Fields: address, phone, website, openingHours, category, priceRange,
  socialHandles.instagram, socialHandles.twitter, tags (chip input).
- Toggling off clears all fields and drops `merchant` from the payload.
- A "🔄 Refresh from OSM" button appears next to the section title once
  the section is populated. It re-runs the Nominatim search for the
  current pick and overwrites the form (with a confirmation toast).

The dialog's existing `MapNodePayload.pois[0]` shape gains the new
optional `merchant` field. Existing dialog flow (title, map pick, view)
is untouched.

## Yohaku renderer (split layout)

### Activation rule

`apps/web/src/components/ui/map-block/MapBlock.tsx` (and the rich-content
wrapper `YohakuMapRenderer.tsx`) detects:

```ts
const hasAnyMerchant = pois.some((p) => p.merchant)
```

When `hasAnyMerchant === true`, render the split layout. Otherwise keep
the existing single-pane map + popover behavior unchanged.

### Layout

- **Desktop (≥768px):** CSS grid two columns, `minmax(0,1.4fr)` for map
  and `minmax(0,1fr)` for the detail panel. Min height matches current
  MapBlock `height` prop (default 460px).
- **Phone (<768px):** grid collapses to a single column. Map stacks
  above the panel. Panel grows to fit content.
- Existing track rendering (route, stops) continues inside the map pane.
  The split is purely an additional right-rail; the map keeps all its
  current layers and interactions.

### Detail panel (new component `MapDetailPanel.tsx`)

Inputs: `pois: MapPoi[]`, `activeIndex: number`, `onActiveChange: (i) => void`.

- **Single POI** (`pois.length === 1`): panel renders the merchant
  directly, no pager.
- **Multi POI** (`pois.length > 1`): panel shows a pager strip at the
  top — `N / M` + prev/next arrows. The shown POI is `pois[activeIndex]`.
  Keyboard `←`/`→` while focus is inside the panel changes the index.
- Field rows: address → phone → website → openingHours → tags → socials.
  Empty fields collapse (no empty row). Phone and website are clickable
  `tel:` / `https:` anchors. Each row has a 16px leading glyph column.
- Category and priceRange render as small chips under the merchant
  title, not inline rows.
- Title falls back to `poi.title`, then `poi.merchant.address`, then
  `id`-style coords.

### Map ↔ panel sync

- The active merchant POI's pin renders in a darker tone (active state).
- Changing `activeIndex` via pager triggers `map.flyTo([lon, lat], zoom)`
  with `duration: 600`. `activeIndex` only counts merchant POIs — i.e.
  `merchantPois = pois.filter(p => p.merchant)` is the pager source.
  Plain non-merchant POIs are still drawn on the map but excluded from
  the pager.
- Clicking a merchant pin on the map sets it active (bidirectional).
- Clicking a non-merchant pin opens the existing classic popover and
  does not touch `activeIndex`.
- Track or stop popovers (existing behavior) coexist; they do not
  change `activeIndex`.

### What does NOT change

- `MapPoi` POIs without `merchant` still appear as pins on the map and
  open their classic popover when clicked (when split layout is active,
  the popover behavior is suppressed for merchant POIs because the panel
  shows the same content).
- Track rendering, export, exif, and all other MapBlock features.
- Admin editor's on-canvas POI popover (the in-editor block view).

## Files touched

**mx-core (admin):**
- `apps/admin/src/vendor/rich-editor/extensions/map/types.ts` — add `MapMerchant`, extend `MapPoi`
- `apps/admin/src/vendor/rich-editor/extensions/map/geocode.ts` — `extratags=1&addressdetails=1`, return `merchantSuggestion`
- `apps/admin/src/vendor/rich-editor/extensions/map/InsertLocationDialog.tsx` — merchant form section, refresh button

**Yohaku (apps/web):**
- `apps/web/src/components/ui/map-block/types.ts` — mirror `MapMerchant` and `MapPoi.merchant`
- `apps/web/src/components/ui/map-block/MapBlock.tsx` — split layout activation, `activeIndex` state, fly-to wiring, suppress merchant popover when panel is active
- `apps/web/src/components/ui/map-block/MapDetailPanel.tsx` — new component (panel + pager)
- `apps/web/src/components/ui/rich-content/map/YohakuMapRenderer.tsx` — forward `merchant` through `MapSlotProps` (if applicable; verify)
- `apps/web/src/components/ui/rich-content/map/map-augment.ts` — `MapPoi` type sync

## Testing

**Admin:**
- `geocode.ts` — given a Nominatim raw response with `extratags`, returns
  `merchantSuggestion` with the mapped fields. Empty extratags → undefined.
- `InsertLocationDialog` onSubmit:
  - OSM result with merchant tags → emits `pois[0].merchant` prefilled.
  - Author toggles off → no `merchant` key in payload.
  - Empty social handles trimmed (no `socialHandles: {}`).

**Yohaku:**
- `MapBlock` — given a single POI with `merchant`, renders split layout
  with no pager.
- `MapBlock` — given 3 POIs (mixed merchant + plain), renders split
  layout (because any merchant present), pager `1 / 3`, pressing → flies
  to next pin.
- `MapBlock` — given POIs with no merchant key, falls back to existing
  popover behavior (no split, no panel).
- `MapDetailPanel` — empty fields don't render rows.

## Dependencies

- **No new npm dependencies.** OSM Nominatim is already used by
  `geocode.ts`. `thumbhash`, `maplibre-gl`, motion/react, and floating-ui
  are all already present.
- **No new env vars.** No API keys.

## Open implementation questions (resolve during writing-plans)

- Exact path of the Yohaku-side `MapPoi` type. The renderer imports
  `types.ts` from `map-block/`, but `map-augment.ts` in
  `rich-content/map/` may also declare a parallel type. Verify during
  implementation.
- Whether `MapDetailPanel` should also accept the (optional) `track`
  prop for a small "track summary" row at the panel top (distance,
  duration) when track + merchants coexist. Defer unless requested.
- Pager keyboard scope — current plan: keys only when focus is inside
  the panel. Confirm this matches the existing keyboard model.
