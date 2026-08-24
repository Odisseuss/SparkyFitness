# Mobile Check-In: 4-Tab Restructure + Progress Photos

*Date: 2026-08-24*
*Issue: [CodeWithCJ/SparkyFitness#1634](https://github.com/CodeWithCJ/SparkyFitness/issues/1634) (Progress photos in mobile app)*

## Problem

Issue #1634 asks for progress-photo tracking in the mobile app: store and
display photos timestamped against weight measurements, plus a page for
side-by-side comparison. Separately, the user wants the existing "Add
Measurements" screen restructured into a tabbed "Check-In" screen matching
the web app's `CheckIn.tsx`, with four tabs: Measurements, Fasting & Mood,
Sleep, and Photos.

## Scope

This spec covers all four tabs in one phase, per explicit direction. Two
tabs (Fasting & Mood, Sleep) have no existing mobile UI to reuse and are
scoped down from full web parity:

- **Sleep**: bedtime + wake time only (duration auto-calculated). No
  drag-based sleep-stage timeline editor — that is a substantial native
  gesture-UI build with no existing mobile pattern, deferred indefinitely
  unless requested.
- **Mood**: slider + built-in mood chips + notes, using `BUILT_IN_MOODS`
  from `@workspace/shared`. No custom-mood create/hide/delete management —
  that is a settings-like feature orthogonal to "log today's mood",
  deferred indefinitely unless requested.

The side-by-side photo comparison page has no web equivalent — it is
designed fresh here, backed entirely by endpoints the Photos tab already
needs (no additional backend work).

No backend changes anywhere in this spec. Every endpoint used already
exists: `/api/mood`, `/api/sleep`, and
`/api/measurements/check-in-photos/*`.

## Architecture

### Screen restructure

`SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx` (1023 lines
today) is rewritten into a tabbed Check-In screen. The **route name stays
`MeasurementsAdd`** (`{ date?: string } | undefined`, unchanged) to avoid
touching its five existing callers (`DiaryScreen.tsx`, `ActiveWorkoutBar.tsx`,
`useAddSheetActions.ts`, `App.tsx`'s `RootStackParamList`/`<Stack.Screen>`
registration, `safeScreens.tsx`) — only the screen's rendered content and
header title change. `AddSheet.tsx`'s "Measurements" button label becomes
"Check-In" (copy only; the `onAddMeasurements` callback name is unchanged).

The rewritten screen owns:
- The existing date-picker row (`CalendarSheet`, unchanged), now sitting
  above the tabs and applying to all four.
- A `SegmentedControl` with four segments: Measurements, Fasting & Mood,
  Sleep, Photos — mirroring web's `CheckIn.tsx` tab list exactly.
- Per-tab content, each extracted into its own component under
  `src/components/checkin/` (see Components below) — the existing
  1023-line file is already large enough to warrant this split, and Diary
  and other flows navigate straight to specific tabs via existing
  `date`-only params (no per-tab deep link needed for this phase).

### Data

No backend changes. Three new mobile API-client + hook pairs, following
the codebase's existing `services/api/*.ts` + `hooks/*.ts` pattern:

- **Mood** — `POST /api/mood` (upsert-by-`entry_date`, body
  `{ mood_value, mood_tags, notes, entry_date }`) and
  `GET /api/mood/date/:entryDate` (pre-fill today's entry if one exists).
- **Sleep** — `POST /api/sleep/manual_entry` (body
  `{ entry_date, bedtime, wake_time, duration_in_seconds, record_timezone }`,
  omitting `stage_events` entirely per the scope trim above),
  `GET /api/sleep?startDate=&endDate=` (list the day's entries),
  `PUT /api/sleep/:id` and `DELETE /api/sleep/:id` (edit/delete an
  existing manual entry).
- **Progress photos** — `GET /api/measurements/check-in-photos/dates`
  (calendar marking + the compare screen's date pickers),
  `GET /api/measurements/check-in-photos/:date` (the day's up-to-3
  photos), `POST /api/measurements/check-in-photos/:date/:type` (multipart
  upload, upsert-by-type — `type` is `front | back | side`),
  `DELETE /api/measurements/check-in-photos/photo/:id`. Photo bytes are
  served through the authenticated `GET /api/measurements/check-in-photos/file/:id`
  route (private, not a public static mount), so display requires the same
  auth-header construction `apiFetch` already does — not a bare `<Image
  uri>`.

Measurements (the first tab) uses entirely existing hooks/services
(`useMeasurements`, `useUpsertCheckIn`, `useCustomMeasurements*`) — no new
data-layer work for that tab.

## Components

- **`CheckInScreen.tsx`** (rewrite of `MeasurementsAddScreen.tsx`) — date
  picker + `SegmentedControl` + active-tab content. Keeps the existing
  native-header save/dismiss wiring (`useScreenHeader`, since this is a
  root-stack push screen, not a tab root — the Task-1-established
  tab-root restriction from the Reports feature does not apply here).
  Because each tab has its own save action, the header's primary action
  and the footer `FooterSaveBar` route to whichever tab is active.
- **`src/components/checkin/MeasurementsTab.tsx`** — the entire existing
  `MeasurementsAddScreen` body (weight, height, body-fat %, neck, waist,
  hips, steps, custom categories), moved verbatim. No behavior change.
- **`src/components/checkin/FastingMoodTab.tsx`** — top: the existing
  `FastingCard` component reused as-is (self-contained, takes only a
  `navigation` prop, already reads fasting state and pushes
  `FastingDetailScreen` — exactly web's `HomeDashboardFasting` role, no
  new fasting UI needed). Below: a new mood form — a 10-100 slider (using
  `BUILT_IN_MOODS`' `band` thresholds for the live emoji/label, mirroring
  web's `getMoodLabel` bucketing), a horizontal row of built-in mood
  chips (multi-select, toggled the same way web's `toggleTag` works), and
  a notes text field. Save button posts to the mood API (single upsert
  call, no separate create/update branch needed).
- **`src/components/checkin/SleepTab.tsx`** — two `TimeSheet` pickers
  (bedtime/wake, reused as-is — `value: 'HH:MM'` / `onSelectTime`), a save
  button that computes `duration_in_seconds` client-side (handling the
  overnight case: if wake time is earlier in the day than bedtime, treat
  bedtime as the previous day, matching web's exact `addDays(bedtime, -1)`
  logic), and a list of the day's existing entries with inline edit
  (re-open the two `TimeSheet`s pre-filled) and delete. Multiple sessions
  per day are allowed (nap + overnight) — the server does not upsert
  sleep entries by date the way it does mood.
- **`src/components/checkin/PhotosTab.tsx`** — 3 fixed slots (front,
  back, side), modeled directly on
  `src/components/wellness/pregnancy/BumpPhotoJournal.tsx` (near-identical
  shape already in the codebase): an `ActionSheet` offering
  camera/library, an upload-in-flight spinner per slot, tap-to-select
  then delete. Uses the shared `src/utils/pickImage.ts` helpers
  (`pickImageFromCamera` / `pickImagesFromLibrary`, which already handle
  permission denial, downscaling, and HEIC normalization) rather than
  calling `expo-image-picker` directly. Photos render through
  `src/components/SafeImage.tsx` (`source: { uri, headers } | null`) with
  headers built the same way `apiFetch` builds them (`getAuthHeaders` +
  `proxyHeadersToRecord`) — required specifically because check-in photos
  are served through an authenticated route, unlike `BumpPhotoJournal`'s
  bare-URI pregnancy photos. Includes a "Compare" button that pushes
  `ProgressPhotosCompareScreen`.

## Photo Comparison Page (net-new — no web equivalent)

**`src/screens/ProgressPhotosCompareScreen.tsx`** — a root-stack push
screen. Two independent date pickers (`CalendarSheet`, reused), each
constrained to dates returned by
`GET /api/measurements/check-in-photos/dates` (the same endpoint the
Photos tab and web's calendar-marking already use — no new backend work).
Below the pickers: 3 rows (front, back, side), each showing the two
selected dates' photos side by side via `SafeImage`, with a "No photo"
placeholder for whichever side is missing a photo of that type. No
comparison-specific data model — this is pure client-side composition of
two independent per-date fetches.

## Error Handling & Edge Cases

- **Mood save with nothing changed**: no special-case guard needed — the
  slider defaults to neutral (50) and chips default empty, so saving an
  untouched form just upserts that neutral state, which is coherent
  (unlike Measurements, mood has no "was this field ever filled"
  distinction to preserve).
- **Sleep overnight wraparound**: if wake time is earlier in the day than
  bedtime, subtract a day from bedtime before computing duration — ports
  web's exact logic verbatim.
- **Multiple sleep entries per day**: intentionally allowed (nap +
  overnight), matching web's "Add Another Sleep Session" — the manual
  entry endpoint does not upsert by date the way mood's endpoint does.
- **Photo upload failure**: toast error, slot reverts to its pre-upload
  state — no optimistic photo left dangling, matching
  `BumpPhotoJournal`'s existing failure handling.
- **Compare screen with a date missing one or more photo types**: render
  a "No photo" placeholder for that slot rather than blocking date
  selection or hiding the row.
- **Camera/library permission denied**: `pickImage.ts`'s existing
  `{ status: 'denied' }` result surfaces a toast, matching
  `FoodPhotoImproveScreen`/`FoodScanScreen`'s existing handling — no new
  permission-handling code.
- **Offline/request failure**: covered by the existing `apiFetch`
  timeout/session-expiry handling across all three new API clients — no
  new error-handling code required.
- **Route/label change risk**: the `MeasurementsAdd` route name and the
  `onAddMeasurements` callback name are both unchanged — only the
  `AddSheet` button's visible label ("Measurements" → "Check-In") and the
  screen's rendered content change, so none of the five existing callers
  need code changes, only the copy edit in `AddSheet.tsx`.

## Testing

- **API clients** (`moodApi`, `sleepApi`, `checkInPhotosApi`):
  endpoint/query-string/method/body construction, following
  `__tests__/services/goalsApi.test.ts`'s mocked-`fetch` template.
- **Hooks** (`useMood`, `useSleep`, `useCheckInPhotos`): query-key shape
  and mutation-success cache invalidation, following
  `__tests__/hooks/useNutritionTrends.test.ts`'s `renderHook` +
  `createTestQueryClient`/`createQueryWrapper` template.
- **`FastingMoodTab`**: slider/chip/notes state, save wiring;
  `FastingCard` itself needs no new tests (unchanged, reused as-is).
- **`SleepTab`**: bedtime/wake selection, duration calculation including
  the overnight-wraparound case, edit and delete of an existing entry.
- **`PhotosTab`**: per-slot upload-in-flight state, delete flow, the
  `SafeImage` auth-header source construction.
- **`ProgressPhotosCompareScreen`**: two independent date selections,
  per-type side-by-side rendering, missing-photo placeholder.
- **`MeasurementsTab`**: the existing `MeasurementsAddScreen` test suite
  moves with the extracted component — same assertions, new file/import
  path.
- **`CheckInScreen`**: segmented control switches tabs, the date picker
  applies across all tabs, header/footer save action routes to whichever
  tab is active.
- Per `CONTRIBUTING.md`: `pnpm test && pnpm run validate` in
  `SparkyFitnessMobile/` before this is done, plus before/after
  screenshots for the PR (a UI change).

## Explicitly Out of Scope

- Sleep-stage timeline editing (deep/light/REM/awake segment dragging).
- Custom mood creation, hiding, and deletion (built-in moods only).
- Any backend/API changes — every endpoint this spec needs already
  exists.
- Family/acting-user support for check-in data — mobile has no
  family/acting-user concept in any domain yet (same conclusion as the
  Reports feature spec).
