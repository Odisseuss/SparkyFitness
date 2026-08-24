# Mobile Check-In 4-Tab Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the mobile "Add Measurements" screen into a 4-tab "Check-In" screen (Measurements, Fasting & Mood, Sleep, Photos), implementing issue #1634 (progress photos) plus new mood and manual-sleep entry.

**Architecture:** `MeasurementsAddScreen.tsx` is rewritten into `CheckInScreen.tsx`, which owns a shared date picker and a `SegmentedControl` over four tab components under `src/components/checkin/`. Three new API-client/hook pairs (mood, sleep, check-in photos) talk to existing server endpoints — no backend work. Measurements' existing form logic moves into `MeasurementsTab.tsx` unchanged in behavior except that saving no longer auto-dismisses the screen (the screen now serves four purposes, not one).

**Tech Stack:** React Native 0.85, Expo SDK 56, TypeScript 6, TanStack Query 5, `expo-image-picker` + `expo-image-manipulator` (via existing `utils/pickImage.ts`), `expo-file-system` (`File`, for multipart upload), Jest + `@testing-library/react-native`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-24-mobile-checkin-tabs-design.md`. Read it first if anything here is ambiguous.
- All work happens in `SparkyFitnessMobile/`. Run every command from that directory.
- **No `any`.** Define explicit types/interfaces or import from `@workspace/shared`. Hard project rule (`AGENTS.md`).
- No backend changes. `POST/GET /api/mood`, `POST/GET/PUT/DELETE /api/sleep*`, and every `/api/measurements/check-in-photos/*` route already exist.
- Mobile has no family/acting-user switching — no API call in this plan takes a `userId` param.
- Sleep entries: **bedtime + wake time only**, no `stage_events` — that's an explicit scope cut, not an oversight.
- Mood entries: **built-in moods only** (`BUILT_IN_MOODS` from `@workspace/shared`), no custom-mood create/hide/delete — explicit scope cut.
- The `MeasurementsAdd` route name, its `{ date?: string } | undefined` param shape, and the `onAddMeasurements` callback name in `useAddSheetActions.ts` all stay unchanged — only the rendered screen content and visible copy change.
- Keep `YYYY-MM-DD` values as plain calendar-day strings.
- Per `CONTRIBUTING.md`: the finished PR needs `pnpm test && pnpm run validate` passing in `SparkyFitnessMobile/`, plus before/after screenshots (a UI change).

---

### Task 1: Extract `MeasurementsTab.tsx` from `MeasurementsAddScreen.tsx`

**Files:**
- Read first: `SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx` (full file — this task moves its body, so read it completely before starting)
- Create: `SparkyFitnessMobile/src/components/checkin/MeasurementsTab.tsx`
- Test: `SparkyFitnessMobile/__tests__/components/checkin/MeasurementsTab.test.tsx` (move from `__tests__/screens/MeasurementsAddScreen.test.tsx` if that file exists — check with `ls SparkyFitnessMobile/__tests__/screens/MeasurementsAddScreen.test.tsx` first and read it in full before moving it)

**Interfaces:**
- Produces: `MeasurementsTab` (default export), props:
  ```ts
  interface MeasurementsTabProps {
    selectedDate: string;
    /** Called on mount with the tab's save function, and with `null` on unmount — lets the parent screen's header Save button trigger this tab's save without lifting all of its form state. */
    registerSaveHandler: (fn: (() => void) | null) => void;
    /** Called whenever isSaving/isSaveDisabled change, so the parent header can reflect them reactively. */
    onStateChange: (state: { isSaving: boolean; isSaveDisabled: boolean }) => void;
  }
  ```
- Consumes: everything `MeasurementsAddScreen.tsx` already imports and uses today (`useMeasurements`, `useUpsertCheckIn`, `usePreferences`, `useCustomCategories`, `useCustomMeasurementsByDate`, `useSaveCustomMeasurement`, `useDeleteCustomMeasurement`, all the unit-conversion/parsing utils, `FormInput`, `YesNoClearControl`, `Button`, `Icon`).

This task is a mechanical extraction with three specific behavior changes — do not change anything else about the existing logic (field validation, dirty-field tracking, custom-category reconciliation, save-then-clear-confirmation dialog) beyond what is listed below.

- [ ] **Step 1: Read the full source file**

Read `SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx` completely. Note its structure: state (`selectedDate`, `form`, `prefilledKeys`, `customForm`, dirty-tracking refs), the reconciliation `useEffect`s, `handleSave`, and the render body (date row + form fields + custom categories).

- [ ] **Step 2: Create `MeasurementsTab.tsx` with the extracted logic**

Create `SparkyFitnessMobile/src/components/checkin/MeasurementsTab.tsx` containing the **entire component body** of `MeasurementsAddScreen.tsx`, with these specific changes:

1. **Props**: replace the component's props (currently `{ navigation, route }: Props`) with the `MeasurementsTabProps` interface above. Remove the `Props`/`RootStackScreenProps<'MeasurementsAdd'>` type and its import.
2. **Date ownership**: remove the `const [selectedDate, setSelectedDate] = useState<string>(initialDate);` line, the `initialDate` computation (`route.params?.date ?? useDiaryDateStore.getState().selectedDate`), the `calendarSheetRef`, the `handleSelectDate` callback, the date-row `<TouchableOpacity>` JSX block, and the `<CalendarSheet ref={calendarSheetRef} .../>` element at the bottom. `selectedDate` now comes from props; every internal reference to `selectedDate` in the existing effects/handlers stays as-is (they already just read the variable, and the variable is now a prop instead of local state).
3. **Header/footer removal**: remove the `useScreenHeader` import, the `header` construction, the `{header}` JSX, the `useNativeIOSHeadersActive` import/call, the `FooterSaveBar` import and its conditional render block. The parent `CheckInScreen` now owns all of this.
4. **Dismiss removal**: remove `handleClose` and everything related to `navigation`/`isDismissDisabled` (the prop no longer exists). In `handleSave`'s `doSave` inner function, replace `navigation.goBack();` with nothing — after a successful save, show the `Toast.show({ type: 'success', text1: 'Saved' })` exactly as today, but do **not** navigate away. This is a deliberate behavior change: the screen now serves four purposes, so a Measurements save no longer closes the whole Check-In screen (matches web, where `CheckIn.tsx` is a persistent page, not a dismiss-on-save modal).
5. **State reporting**: add a `useEffect` that calls `onStateChange({ isSaving, isSaveDisabled })` whenever either value changes (both already exist in the current file as `const isSaving = ...` / `const isSaveDisabled = ...`).
6. **Save handler registration**: add a `useEffect` that calls `registerSaveHandler(handleSave)` on mount/whenever `handleSave` changes, and calls `registerSaveHandler(null)` in its cleanup function.
7. **Outer wrapper**: the returned JSX's outer `<View className="flex-1 bg-background" style={...}>` and its `Platform.OS === 'android' ? { paddingTop: insets.top } : undefined` style stay, but drop the `{header}` line inside it (removed in point 3) — the `<KeyboardAwareScrollView>` becomes the first child.
8. Everything else — field validation (`evaluateField`, `apply`), the weight/height mode branching, `renderCustomCategory`, the custom-category primary/more partitioning, the save confirmation `Alert.alert` for clearing fields, all `FormInput`/`YesNoClearControl` JSX for weight/body-fat/height/neck/waist/hips/steps/custom-categories — moves verbatim, unchanged.

- [ ] **Step 3: Move the test file**

Check whether `SparkyFitnessMobile/__tests__/screens/MeasurementsAddScreen.test.tsx` exists (`ls` it). If it does, read it in full, then create `SparkyFitnessMobile/__tests__/components/checkin/MeasurementsTab.test.tsx` with the same test cases, adjusted for:
- Import path: `../../../src/components/checkin/MeasurementsTab` instead of `../../src/screens/MeasurementsAddScreen`.
- Props: pass `selectedDate` (a fixed test date instead of a `route` param), `registerSaveHandler={jest.fn()}`, `onStateChange={jest.fn()}` instead of `navigation`/`route`.
- Remove any test assertions about `navigation.goBack()` being called after a successful save (that behavior no longer exists per Step 2.4) — replace with an assertion that the success toast fires and the component is still mounted/rendered.
- Remove any test assertions about the date-row `CalendarSheet` (that UI moved out of this component per Step 2.2).
- Keep every other assertion (field validation, dirty-field tracking, custom-category save/delete, the clear-confirmation dialog) unchanged in substance.

Delete the old `__tests__/screens/MeasurementsAddScreen.test.tsx` file once its content has been moved.

If no such test file exists today, write a new `MeasurementsTab.test.tsx` covering at minimum: renders with prefilled values from `useMeasurements`, saving with a valid weight calls the upsert mutation, `registerSaveHandler` is called with a function on mount and with `null` on unmount, `onStateChange` reflects `isSaving` while the mutation is pending.

- [ ] **Step 4: Run the tests**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/MeasurementsTab.test.tsx`
Expected: PASS, same coverage as before the move.

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: no errors. `MeasurementsAddScreen.tsx` still exists and still exports the old component at this point in the plan (it is rewritten into `CheckInScreen.tsx` in Task 12) — this task's typecheck only needs `MeasurementsTab.tsx` itself to be clean; a stale `MeasurementsAddScreen.tsx` importing removed-now-duplicated logic is fine since nothing in this task deletes it yet.

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/components/checkin/MeasurementsTab.tsx SparkyFitnessMobile/__tests__/components/checkin/MeasurementsTab.test.tsx
git rm SparkyFitnessMobile/__tests__/screens/MeasurementsAddScreen.test.tsx 2>/dev/null || true
git commit -m "feat(mobile): extract MeasurementsTab from MeasurementsAddScreen"
```

---

### Task 2: `moodApi.ts` — mood API client

**Files:**
- Create: `SparkyFitnessMobile/src/services/api/moodApi.ts`
- Test: `SparkyFitnessMobile/__tests__/services/moodApi.test.ts`

**Interfaces:**
- Produces: `MoodEntry` interface, `fetchMoodForDate(date: string): Promise<MoodEntry | null>`, `saveMood(entry: { mood_value: number; mood_tags: string[]; notes: string; entry_date: string }): Promise<MoodEntry>`.
- Consumes: `apiFetch` from `./apiClient`.

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/services/moodApi.test.ts
import { fetchMoodForDate, saveMood } from '../../src/services/api/moodApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('moodApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  describe('fetchMoodForDate', () => {
    test('sends GET request to /api/mood/date/:entryDate', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' }) });

      await fetchMoodForDate('2026-08-24');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/mood/date/2026-08-24',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    test('returns null on a 404 (no entry for that date)', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Not found') });

      const result = await fetchMoodForDate('2026-08-24');

      expect(result).toBeNull();
    });

    test('rethrows a non-404 server error', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Internal Server Error') });

      await expect(fetchMoodForDate('2026-08-24')).rejects.toThrow('Server error: 500 - Internal Server Error');
    });
  });

  describe('saveMood', () => {
    test('sends POST request to /api/mood with the entry body', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      const responseData = { id: 'm1', mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(responseData) });

      const result = await saveMood({ mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/mood',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' }),
        }),
      );
      expect(result).toEqual(responseData);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/moodApi.test.ts`
Expected: FAIL — cannot find module `../../src/services/api/moodApi`

- [ ] **Step 3: Implement `moodApi.ts`**

```ts
// SparkyFitnessMobile/src/services/api/moodApi.ts
import { apiFetch } from './apiClient';
import { ApiError } from './errors';

export interface MoodEntry {
  id: string;
  mood_value: number;
  mood_tags: string[];
  notes: string;
  entry_date: string;
}

export interface SaveMoodPayload {
  mood_value: number;
  mood_tags: string[];
  notes: string;
  entry_date: string;
}

/** Returns null when the user has no mood entry for that date (server 404), rethrows any other error. */
export const fetchMoodForDate = async (date: string): Promise<MoodEntry | null> => {
  try {
    return await apiFetch<MoodEntry>({
      endpoint: `/api/mood/date/${encodeURIComponent(date)}`,
      serviceName: 'Mood API',
      operation: 'fetch mood for date',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

/** Upserts (create-or-update by entry_date) the user's mood entry for a day. */
export const saveMood = (payload: SaveMoodPayload): Promise<MoodEntry> =>
  apiFetch<MoodEntry>({
    endpoint: '/api/mood',
    serviceName: 'Mood API',
    operation: 'save mood',
    method: 'POST',
    body: payload,
  });
```

Before writing this, check `SparkyFitnessMobile/src/services/api/errors.ts` for the exact `ApiError` shape (`status` field name) — it is already used the same way by other API clients in this codebase (e.g. `dailySummaryApi.ts`'s 401 handling in `apiClient.ts` itself constructs `new ApiError(message, response.status, errorText)`), so `error.status` is correct, but confirm before relying on it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/moodApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add SparkyFitnessMobile/src/services/api/moodApi.ts SparkyFitnessMobile/__tests__/services/moodApi.test.ts
git commit -m "feat(mobile): add mood API client"
```

---

### Task 3: `sleepApi.ts` — sleep API client

**Files:**
- Create: `SparkyFitnessMobile/src/services/api/sleepApi.ts`
- Test: `SparkyFitnessMobile/__tests__/services/sleepApi.test.ts`

**Interfaces:**
- Produces: `SleepEntry` interface, `fetchSleepEntries(startDate: string, endDate: string): Promise<SleepEntry[]>`, `saveSleepEntry(entry: { entry_date: string; bedtime: string; wake_time: string; duration_in_seconds: number; record_timezone: string }): Promise<SleepEntry>`, `updateSleepEntry(id: string, entry: { bedtime: string; wake_time: string; duration_in_seconds: number; record_timezone: string }): Promise<SleepEntry>`, `deleteSleepEntry(id: string): Promise<void>`.
- Consumes: `apiFetch` from `./apiClient`.

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/services/sleepApi.test.ts
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../src/services/api/sleepApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('sleepApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  test('fetchSleepEntries sends GET to /api/sleep with startDate/endDate', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await fetchSleepEntries('2026-08-24', '2026-08-24');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep?startDate=2026-08-24&endDate=2026-08-24',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('saveSleepEntry sends POST to /api/sleep/manual_entry with the payload', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const payload = {
      entry_date: '2026-08-24',
      bedtime: '2026-08-23T22:30:00.000Z',
      wake_time: '2026-08-24T06:30:00.000Z',
      duration_in_seconds: 28800,
      record_timezone: 'America/New_York',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 's1', ...payload, source: 'manual' }) });

    await saveSleepEntry(payload);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/manual_entry',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
  });

  test('updateSleepEntry sends PUT to /api/sleep/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const payload = {
      bedtime: '2026-08-23T22:00:00.000Z',
      wake_time: '2026-08-24T06:00:00.000Z',
      duration_in_seconds: 28800,
      record_timezone: 'America/New_York',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 's1', entry_date: '2026-08-24', source: 'manual', ...payload }) });

    await updateSleepEntry('s1', payload);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/s1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
    );
  });

  test('deleteSleepEntry sends DELETE to /api/sleep/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, status: 204, headers: { get: () => '0' } });

    await deleteSleepEntry('s1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/s1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/sleepApi.test.ts`
Expected: FAIL — cannot find module `../../src/services/api/sleepApi`

- [ ] **Step 3: Implement `sleepApi.ts`**

```ts
// SparkyFitnessMobile/src/services/api/sleepApi.ts
import { apiFetch } from './apiClient';

/** Fields the mobile Sleep tab reads/writes. The server row carries many more
 * health-sync-only fields (stage seconds, SpO2, HRV, etc.) that this client
 * intentionally does not model — manual entries never populate them. */
export interface SleepEntry {
  id: string;
  entry_date: string;
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  source: string;
}

export interface SaveSleepEntryPayload {
  entry_date: string;
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  record_timezone: string;
}

export interface UpdateSleepEntryPayload {
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  record_timezone: string;
}

export const fetchSleepEntries = (startDate: string, endDate: string): Promise<SleepEntry[]> =>
  apiFetch<SleepEntry[]>({
    endpoint: `/api/sleep?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    serviceName: 'Sleep API',
    operation: 'fetch sleep entries',
  });

/** No `stage_events` field — mobile v1 only collects bedtime/wake time. */
export const saveSleepEntry = (payload: SaveSleepEntryPayload): Promise<SleepEntry> =>
  apiFetch<SleepEntry>({
    endpoint: '/api/sleep/manual_entry',
    serviceName: 'Sleep API',
    operation: 'save sleep entry',
    method: 'POST',
    body: payload,
  });

export const updateSleepEntry = (id: string, payload: UpdateSleepEntryPayload): Promise<SleepEntry> =>
  apiFetch<SleepEntry>({
    endpoint: `/api/sleep/${encodeURIComponent(id)}`,
    serviceName: 'Sleep API',
    operation: 'update sleep entry',
    method: 'PUT',
    body: payload,
  });

export const deleteSleepEntry = (id: string): Promise<void> =>
  apiFetch<void>({
    endpoint: `/api/sleep/${encodeURIComponent(id)}`,
    serviceName: 'Sleep API',
    operation: 'delete sleep entry',
    method: 'DELETE',
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/sleepApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add SparkyFitnessMobile/src/services/api/sleepApi.ts SparkyFitnessMobile/__tests__/services/sleepApi.test.ts
git commit -m "feat(mobile): add sleep API client"
```

---

### Task 4: `checkInPhotosApi.ts` — progress photos API client

**Files:**
- Create: `SparkyFitnessMobile/src/services/api/checkInPhotosApi.ts`
- Test: `SparkyFitnessMobile/__tests__/services/checkInPhotosApi.test.ts`

**Interfaces:**
- Produces: `PhotoType = 'front' | 'back' | 'side'`, `CheckInPhoto` interface, `fetchPhotoDates(): Promise<string[]>`, `fetchPhotosForDate(date: string): Promise<CheckInPhoto[]>`, `uploadPhoto(date: string, type: PhotoType, uri: string): Promise<CheckInPhoto>`, `deletePhoto(id: string): Promise<void>`, `buildPhotoImageSource(photoId: string): Promise<{ uri: string; headers: Record<string, string> } | null>`.
- Consumes: `apiFetch`, `normalizeUrl` from `./apiClient`; `File` from `expo-file-system`; `getActiveServerConfig`, `proxyHeadersToRecord` from `../storage`; `getAuthHeaders`, `notifySessionExpired` from `./authService`; `ApiError` from `./errors`; `fetchWithTimeout`, `UPLOAD_TIMEOUT_MS` from `../../utils/concurrency`; `addLog` from `../LogService`.

`uploadPhoto` follows the exact multipart pattern in `pregnancyPhotosApi.ts` (already in this codebase — read it before writing this task if you have not already) — same `File(uri)` wrapping, same header handling, same 401 detection. The one difference: this endpoint's `date`/`type` are URL path segments, not form fields, so there are no `form.append('...')` calls for them — only `form.append('photo', new File(uri))`.

`buildPhotoImageSource` is new: check-in photos are served through the authenticated `GET /api/measurements/check-in-photos/file/:id` route (private, not a public static mount), so `<SafeImage>` needs a `{ uri, headers }` source with the same auth headers `apiFetch` sends — build it the same way `apiFetch` builds its own headers (`proxyHeadersToRecord(config.proxyHeaders)` + `getAuthHeaders(config)`), returning `null` when there is no active server config.

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/services/checkInPhotosApi.test.ts
import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
} from '../../src/services/api/checkInPhotosApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri })),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('checkInPhotosApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  test('fetchPhotoDates sends GET to /api/measurements/check-in-photos/dates', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(['2026-08-24', '2026-08-01']) });

    const result = await fetchPhotoDates();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/dates',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(['2026-08-24', '2026-08-01']);
  });

  test('fetchPhotosForDate sends GET to /api/measurements/check-in-photos/:date', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await fetchPhotosForDate('2026-08-24');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/2026-08-24',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('uploadPhoto sends multipart POST to /api/measurements/check-in-photos/:date/:type', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const responseData = { id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(responseData) });

    const result = await uploadPhoto('2026-08-24', 'front', 'file:///tmp/photo.jpg');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/2026-08-24/front',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(result).toEqual(responseData);
  });

  test('deletePhoto sends DELETE to /api/measurements/check-in-photos/photo/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, status: 204, headers: { get: () => '0' } });

    await deletePhoto('p1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/photo/p1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  describe('buildPhotoImageSource', () => {
    test('returns a uri with Authorization header when a server is configured', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);

      const source = await buildPhotoImageSource('p1');

      expect(source).toEqual({
        uri: 'https://example.com/api/measurements/check-in-photos/file/p1',
        headers: { Authorization: 'Bearer test-api-key-12345' },
      });
    });

    test('returns null when there is no active server config', async () => {
      mockGetActiveServerConfig.mockResolvedValue(null);

      const source = await buildPhotoImageSource('p1');

      expect(source).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/checkInPhotosApi.test.ts`
Expected: FAIL — cannot find module `../../src/services/api/checkInPhotosApi`

- [ ] **Step 3: Implement `checkInPhotosApi.ts`**

Read `SparkyFitnessMobile/src/services/api/pregnancyPhotosApi.ts` first (it exists already) — mirror its `uploadPhoto` structure exactly, including the try/catch around the network call and the 401 handling.

```ts
// SparkyFitnessMobile/src/services/api/checkInPhotosApi.ts
import { File } from 'expo-file-system';
import { apiFetch, normalizeUrl } from './apiClient';
import { ApiError } from './errors';
import { getActiveServerConfig, proxyHeadersToRecord } from '../storage';
import { getAuthHeaders, notifySessionExpired } from './authService';
import { addLog } from '../LogService';
import { UPLOAD_TIMEOUT_MS, fetchWithTimeout } from '../../utils/concurrency';

export type PhotoType = 'front' | 'back' | 'side';

export interface CheckInPhoto {
  id: string;
  user_id: string;
  check_in_measurement_id: string | null;
  entry_date: string;
  photo_type: PhotoType;
  file_path: string;
  created_at: string;
}

export const fetchPhotoDates = (): Promise<string[]> =>
  apiFetch<string[]>({
    endpoint: '/api/measurements/check-in-photos/dates',
    serviceName: 'Check-In Photos API',
    operation: 'fetch photo dates',
  });

export const fetchPhotosForDate = (date: string): Promise<CheckInPhoto[]> =>
  apiFetch<CheckInPhoto[]>({
    endpoint: `/api/measurements/check-in-photos/${encodeURIComponent(date)}`,
    serviceName: 'Check-In Photos API',
    operation: 'fetch photos for date',
  });

export async function uploadPhoto(date: string, type: PhotoType, uri: string): Promise<CheckInPhoto> {
  const config = await getActiveServerConfig();
  if (!config) throw new Error('Server configuration not found.');
  const baseUrl = normalizeUrl(config.url);

  const form = new FormData();
  // Global fetch is expo/fetch (WinterCG) under Expo's winter runtime, which
  // rejects React Native's `{uri, name, type}` FormData parts with
  // "Unsupported FormDataPart implementation". expo-file-system's File
  // implements Blob, which expo/fetch serializes correctly.
  form.append('photo', new File(uri));

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/api/measurements/check-in-photos/${encodeURIComponent(date)}/${type}`,
      {
        method: 'POST',
        headers: {
          ...proxyHeadersToRecord(config.proxyHeaders),
          ...getAuthHeaders(config),
          // Multer sets the multipart boundary itself — do NOT set Content-Type manually.
        },
        body: form,
      },
      UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    addLog('[Check-In Photos API] Photo upload failed without a response', 'ERROR', [String(err)]);
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && config.authType === 'session') {
      notifySessionExpired(config.id);
    }
    const text = await response.text();
    addLog('[Check-In Photos API] Failed to upload photo', 'ERROR', [text]);
    throw new ApiError(`Server error: ${response.status} - ${text}`, response.status, text);
  }

  return response.json();
}

export const deletePhoto = (id: string): Promise<void> =>
  apiFetch<void>({
    endpoint: `/api/measurements/check-in-photos/photo/${encodeURIComponent(id)}`,
    serviceName: 'Check-In Photos API',
    operation: 'delete photo',
    method: 'DELETE',
  });

/**
 * Builds an authenticated `<SafeImage>` source for a photo id. Check-in
 * photos are private and served through the authenticated
 * `GET .../file/:id` route (unlike public-static food/exercise images), so
 * the source needs the same Authorization/proxy headers `apiFetch` sends.
 */
export async function buildPhotoImageSource(
  photoId: string,
): Promise<{ uri: string; headers: Record<string, string> } | null> {
  const config = await getActiveServerConfig();
  if (!config) return null;
  const baseUrl = normalizeUrl(config.url);
  return {
    uri: `${baseUrl}/api/measurements/check-in-photos/file/${encodeURIComponent(photoId)}`,
    headers: {
      ...proxyHeadersToRecord(config.proxyHeaders),
      ...getAuthHeaders(config),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/services/checkInPhotosApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add SparkyFitnessMobile/src/services/api/checkInPhotosApi.ts SparkyFitnessMobile/__tests__/services/checkInPhotosApi.test.ts
git commit -m "feat(mobile): add check-in photos API client"
```

---

### Task 5: `useMood` hook

**Files:**
- Modify: `SparkyFitnessMobile/src/hooks/queryKeys.ts`
- Create: `SparkyFitnessMobile/src/hooks/useMood.ts`
- Test: `SparkyFitnessMobile/__tests__/hooks/useMood.test.ts`

**Interfaces:**
- Produces: `moodQueryKey(date: string)` query key; `useMoodForDate(date: string)` → `{ data: MoodEntry | null | undefined, isLoading, ... }`; `useSaveMoodMutation()` → mutation invalidating `moodQueryKey(entry_date)` on success.
- Consumes: `fetchMoodForDate`, `saveMood`, `MoodEntry` (Task 2).

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/hooks/useMood.test.ts
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMoodForDate, useSaveMoodMutation } from '../../src/hooks/useMood';
import { fetchMoodForDate, saveMood } from '../../src/services/api/moodApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/moodApi', () => ({
  fetchMoodForDate: jest.fn(),
  saveMood: jest.fn(),
}));

const mockFetchMoodForDate = fetchMoodForDate as jest.MockedFunction<typeof fetchMoodForDate>;
const mockSaveMood = saveMood as jest.MockedFunction<typeof saveMood>;

describe('useMoodForDate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns the fetched mood entry', async () => {
    mockFetchMoodForDate.mockResolvedValue({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' });

    const { result } = renderHook(() => useMoodForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' });
    expect(mockFetchMoodForDate).toHaveBeenCalledWith('2026-08-24');
  });

  test('returns null data when there is no entry for the date', async () => {
    mockFetchMoodForDate.mockResolvedValue(null);

    const { result } = renderHook(() => useMoodForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });
});

describe('useSaveMoodMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('calls saveMood and invalidates the date query on success', async () => {
    const savedEntry = { id: 'm1', mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' };
    mockSaveMood.mockResolvedValue(savedEntry);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveMoodMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' });
    });

    expect(mockSaveMood).toHaveBeenCalledWith({ mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['mood', '2026-08-24'] }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useMood.test.ts`
Expected: FAIL — cannot find module `../../src/hooks/useMood`

- [ ] **Step 3: Add the query key**

Append to `src/hooks/queryKeys.ts`:

```ts
export const moodQueryKey = (date: string) => ['mood', date] as const;
```

- [ ] **Step 4: Implement `useMood.ts`**

```ts
// SparkyFitnessMobile/src/hooks/useMood.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMoodForDate, saveMood, type MoodEntry, type SaveMoodPayload } from '../services/api/moodApi';
import { moodQueryKey } from './queryKeys';

export function useMoodForDate(date: string) {
  return useQuery({
    queryKey: moodQueryKey(date),
    queryFn: () => fetchMoodForDate(date),
    enabled: Boolean(date),
  });
}

export function useSaveMoodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveMoodPayload): Promise<MoodEntry> => saveMood(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: moodQueryKey(variables.entry_date) });
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useMood.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/hooks/queryKeys.ts SparkyFitnessMobile/src/hooks/useMood.ts SparkyFitnessMobile/__tests__/hooks/useMood.test.ts
git commit -m "feat(mobile): add useMood hook"
```

---

### Task 6: `useSleep` hook

**Files:**
- Modify: `SparkyFitnessMobile/src/hooks/queryKeys.ts`
- Create: `SparkyFitnessMobile/src/hooks/useSleep.ts`
- Test: `SparkyFitnessMobile/__tests__/hooks/useSleep.test.ts`

**Interfaces:**
- Produces: `sleepEntriesQueryKey(startDate, endDate)`; `useSleepEntries(startDate: string, endDate: string)`; `useSaveSleepEntryMutation()`, `useUpdateSleepEntryMutation()`, `useDeleteSleepEntryMutation()` — all three invalidate `sleepEntriesQueryKey` on success.
- Consumes: `fetchSleepEntries`, `saveSleepEntry`, `updateSleepEntry`, `deleteSleepEntry`, `SleepEntry` (Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/hooks/useSleep.test.ts
import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useSleepEntries,
  useSaveSleepEntryMutation,
  useUpdateSleepEntryMutation,
  useDeleteSleepEntryMutation,
} from '../../src/hooks/useSleep';
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../src/services/api/sleepApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/sleepApi', () => ({
  fetchSleepEntries: jest.fn(),
  saveSleepEntry: jest.fn(),
  updateSleepEntry: jest.fn(),
  deleteSleepEntry: jest.fn(),
}));

const mockFetchSleepEntries = fetchSleepEntries as jest.MockedFunction<typeof fetchSleepEntries>;
const mockSaveSleepEntry = saveSleepEntry as jest.MockedFunction<typeof saveSleepEntry>;
const mockUpdateSleepEntry = updateSleepEntry as jest.MockedFunction<typeof updateSleepEntry>;
const mockDeleteSleepEntry = deleteSleepEntry as jest.MockedFunction<typeof deleteSleepEntry>;

describe('useSleepEntries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns the fetched entries', async () => {
    const entries = [{ id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' }];
    mockFetchSleepEntries.mockResolvedValue(entries);

    const { result } = renderHook(() => useSleepEntries('2026-08-24', '2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(entries);
  });
});

describe('sleep mutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('useSaveSleepEntryMutation invalidates sleep entries on success', async () => {
    mockSaveSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, source: 'manual' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['sleepEntries'] }));
  });

  test('useUpdateSleepEntryMutation calls updateSleepEntry with id and payload', async () => {
    mockUpdateSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, source: 'manual' });

    const { result } = renderHook(() => useUpdateSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1', payload: { bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' } });
    });

    expect(mockUpdateSleepEntry).toHaveBeenCalledWith('s1', { bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' });
  });

  test('useDeleteSleepEntryMutation calls deleteSleepEntry with id', async () => {
    mockDeleteSleepEntry.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync('s1');
    });

    expect(mockDeleteSleepEntry).toHaveBeenCalledWith('s1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useSleep.test.ts`
Expected: FAIL — cannot find module `../../src/hooks/useSleep`

- [ ] **Step 3: Add the query key**

Append to `src/hooks/queryKeys.ts`:

```ts
export const sleepEntriesQueryKeyRoot = ['sleepEntries'] as const;
export const sleepEntriesQueryKey = (startDate: string, endDate: string) =>
  [...sleepEntriesQueryKeyRoot, startDate, endDate] as const;
```

- [ ] **Step 4: Implement `useSleep.ts`**

```ts
// SparkyFitnessMobile/src/hooks/useSleep.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSleepEntries,
  saveSleepEntry,
  updateSleepEntry,
  deleteSleepEntry,
  type SleepEntry,
  type SaveSleepEntryPayload,
  type UpdateSleepEntryPayload,
} from '../services/api/sleepApi';
import { sleepEntriesQueryKey, sleepEntriesQueryKeyRoot } from './queryKeys';

export function useSleepEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: sleepEntriesQueryKey(startDate, endDate),
    queryFn: () => fetchSleepEntries(startDate, endDate),
    enabled: Boolean(startDate) && Boolean(endDate),
  });
}

export function useSaveSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSleepEntryPayload): Promise<SleepEntry> => saveSleepEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}

export function useUpdateSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSleepEntryPayload }): Promise<SleepEntry> =>
      updateSleepEntry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}

export function useDeleteSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<void> => deleteSleepEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useSleep.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/hooks/queryKeys.ts SparkyFitnessMobile/src/hooks/useSleep.ts SparkyFitnessMobile/__tests__/hooks/useSleep.test.ts
git commit -m "feat(mobile): add useSleep hook"
```

---

### Task 7: `useCheckInPhotos` hook

**Files:**
- Modify: `SparkyFitnessMobile/src/hooks/queryKeys.ts`
- Create: `SparkyFitnessMobile/src/hooks/useCheckInPhotos.ts`
- Test: `SparkyFitnessMobile/__tests__/hooks/useCheckInPhotos.test.ts`

**Interfaces:**
- Produces: `checkInPhotoDatesQueryKey`, `checkInPhotosQueryKey(date)`; `useCheckInPhotoDates()`; `useCheckInPhotosForDate(date: string)`; `useUploadCheckInPhotoMutation()` (invalidates both keys for the affected date on success), `useDeleteCheckInPhotoMutation()` (needs the photo's `entry_date` to know which query to invalidate, so its mutate function takes `{ id, entryDate }`); `useCheckInPhotoImageSource(photoId: string | undefined)` → `{ source: { uri, headers } | null, isLoading }`.
- Consumes: `fetchPhotoDates`, `fetchPhotosForDate`, `uploadPhoto`, `deletePhoto`, `buildPhotoImageSource`, `CheckInPhoto`, `PhotoType` (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// SparkyFitnessMobile/__tests__/hooks/useCheckInPhotos.test.ts
import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useCheckInPhotoDates,
  useCheckInPhotosForDate,
  useUploadCheckInPhotoMutation,
  useDeleteCheckInPhotoMutation,
  useCheckInPhotoImageSource,
} from '../../src/hooks/useCheckInPhotos';
import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
} from '../../src/services/api/checkInPhotosApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/checkInPhotosApi', () => ({
  fetchPhotoDates: jest.fn(),
  fetchPhotosForDate: jest.fn(),
  uploadPhoto: jest.fn(),
  deletePhoto: jest.fn(),
  buildPhotoImageSource: jest.fn(),
}));

const mockFetchPhotoDates = fetchPhotoDates as jest.MockedFunction<typeof fetchPhotoDates>;
const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockUploadPhoto = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;
const mockDeletePhoto = deletePhoto as jest.MockedFunction<typeof deletePhoto>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;

describe('useCheckInPhotoDates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns fetched dates', async () => {
    mockFetchPhotoDates.mockResolvedValue(['2026-08-24']);

    const { result } = renderHook(() => useCheckInPhotoDates(), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(['2026-08-24']);
  });
});

describe('useCheckInPhotosForDate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns fetched photos for the date', async () => {
    const photos = [{ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front' as const, file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' }];
    mockFetchPhotosForDate.mockResolvedValue(photos);

    const { result } = renderHook(() => useCheckInPhotosForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(photos);
  });
});

describe('photo mutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('useUploadCheckInPhotoMutation calls uploadPhoto and invalidates both photo queries', async () => {
    mockUploadPhoto.mockResolvedValue({ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUploadCheckInPhotoMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ date: '2026-08-24', type: 'front', uri: 'file:///tmp/x.jpg' });
    });

    expect(mockUploadPhoto).toHaveBeenCalledWith('2026-08-24', 'front', 'file:///tmp/x.jpg');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotos', '2026-08-24'] }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotoDates'] }));
  });

  test('useDeleteCheckInPhotoMutation calls deletePhoto and invalidates the entry date', async () => {
    mockDeletePhoto.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCheckInPhotoMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', entryDate: '2026-08-24' });
    });

    expect(mockDeletePhoto).toHaveBeenCalledWith('p1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotos', '2026-08-24'] }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotoDates'] }));
  });
});

describe('useCheckInPhotoImageSource', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('resolves the built source for a given photo id', async () => {
    mockBuildPhotoImageSource.mockResolvedValue({ uri: 'https://example.com/api/measurements/check-in-photos/file/p1', headers: { Authorization: 'Bearer x' } });

    const { result } = renderHook(() => useCheckInPhotoImageSource('p1'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.source).toEqual({ uri: 'https://example.com/api/measurements/check-in-photos/file/p1', headers: { Authorization: 'Bearer x' } });
  });

  test('returns a null source without calling the API when photoId is undefined', () => {
    const { result } = renderHook(() => useCheckInPhotoImageSource(undefined), { wrapper: createQueryWrapper(queryClient) });

    expect(mockBuildPhotoImageSource).not.toHaveBeenCalled();
    expect(result.current.source).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useCheckInPhotos.test.ts`
Expected: FAIL — cannot find module `../../src/hooks/useCheckInPhotos`

- [ ] **Step 3: Add the query keys**

Append to `src/hooks/queryKeys.ts`:

```ts
export const checkInPhotoDatesQueryKey = ['checkInPhotoDates'] as const;
export const checkInPhotosQueryKey = (date: string) => ['checkInPhotos', date] as const;
```

- [ ] **Step 4: Implement `useCheckInPhotos.ts`**

```ts
// SparkyFitnessMobile/src/hooks/useCheckInPhotos.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
  type CheckInPhoto,
  type PhotoType,
} from '../services/api/checkInPhotosApi';
import { checkInPhotoDatesQueryKey, checkInPhotosQueryKey } from './queryKeys';

export function useCheckInPhotoDates() {
  return useQuery({
    queryKey: checkInPhotoDatesQueryKey,
    queryFn: fetchPhotoDates,
  });
}

export function useCheckInPhotosForDate(date: string) {
  return useQuery({
    queryKey: checkInPhotosQueryKey(date),
    queryFn: () => fetchPhotosForDate(date),
    enabled: Boolean(date),
  });
}

function invalidatePhotoQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
): void {
  queryClient.invalidateQueries({ queryKey: checkInPhotosQueryKey(date) });
  queryClient.invalidateQueries({ queryKey: checkInPhotoDatesQueryKey });
}

export function useUploadCheckInPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, type, uri }: { date: string; type: PhotoType; uri: string }): Promise<CheckInPhoto> =>
      uploadPhoto(date, type, uri),
    onSuccess: (_data, variables) => {
      invalidatePhotoQueries(queryClient, variables.date);
    },
  });
}

export function useDeleteCheckInPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; entryDate: string }): Promise<void> => deletePhoto(id),
    onSuccess: (_data, variables) => {
      invalidatePhotoQueries(queryClient, variables.entryDate);
    },
  });
}

/** Resolves an authenticated `<SafeImage>` source for a photo id, or a null source while there is no id. */
export function useCheckInPhotoImageSource(photoId: string | undefined) {
  const query = useQuery({
    queryKey: ['checkInPhotoImageSource', photoId] as const,
    queryFn: () => buildPhotoImageSource(photoId as string),
    enabled: Boolean(photoId),
  });

  return {
    source: query.data ?? null,
    isLoading: Boolean(photoId) && query.isLoading,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/hooks/useCheckInPhotos.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/hooks/queryKeys.ts SparkyFitnessMobile/src/hooks/useCheckInPhotos.ts SparkyFitnessMobile/__tests__/hooks/useCheckInPhotos.test.ts
git commit -m "feat(mobile): add useCheckInPhotos hook"
```

---

### Task 8: `FastingMoodTab.tsx` component

**Files:**
- Create: `SparkyFitnessMobile/src/components/checkin/FastingMoodTab.tsx`
- Test: `SparkyFitnessMobile/__tests__/components/checkin/FastingMoodTab.test.tsx`

**Interfaces:**
- Produces: `FastingMoodTab` (default export), props `{ selectedDate: string; navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'] }` (the `navigation` prop is forwarded straight to `FastingCard`, which requires it).
- Consumes: `FastingCard` (`../FastingCard`, existing, unchanged), `useMoodForDate`, `useSaveMoodMutation` (Task 5), `BUILT_IN_MOODS`, `moodValueToTag` from `@workspace/shared`.

- [ ] **Step 1: Write the failing test**

```tsx
// SparkyFitnessMobile/__tests__/components/checkin/FastingMoodTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FastingMoodTab from '../../../src/components/checkin/FastingMoodTab';
import { fetchMoodForDate, saveMood } from '../../../src/services/api/moodApi';

jest.mock('../../../src/services/api/moodApi');
jest.mock('../../../src/components/FastingCard', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="fasting-card" /> };
});

const mockFetchMoodForDate = fetchMoodForDate as jest.MockedFunction<typeof fetchMoodForDate>;
const mockSaveMood = saveMood as jest.MockedFunction<typeof saveMood>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FastingMoodTab selectedDate="2026-08-24" navigation={{} as never} />
    </QueryClientProvider>,
  );
}

describe('FastingMoodTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMoodForDate.mockResolvedValue(null);
    mockSaveMood.mockResolvedValue({ id: 'm1', mood_value: 50, mood_tags: [], notes: '', entry_date: '2026-08-24' });
  });

  test('renders the FastingCard and the mood form', async () => {
    renderTab();

    expect(screen.getByTestId('fasting-card')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('How are you feeling today?')).toBeTruthy();
    });
  });

  test('toggling a mood chip and saving calls saveMood with the tag included', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Calm')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Calm'));
    fireEvent.press(screen.getByText('Save Mood'));

    await waitFor(() => {
      expect(mockSaveMood).toHaveBeenCalledWith(
        expect.objectContaining({ mood_tags: expect.arrayContaining(['calm']), entry_date: '2026-08-24' }),
      );
    });
  });

  test('pre-fills the slider and tags from an existing entry for the date', async () => {
    mockFetchMoodForDate.mockResolvedValue({ id: 'm1', mood_value: 80, mood_tags: ['happy'], notes: 'Great workout', entry_date: '2026-08-24' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Great workout')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/FastingMoodTab.test.tsx`
Expected: FAIL — cannot find module `../../../src/components/checkin/FastingMoodTab`

- [ ] **Step 3: Read `FastingCard.tsx` and `BUILT_IN_MOODS`**

Read `SparkyFitnessMobile/src/components/FastingCard.tsx` (confirm its only prop is `navigation`) and `shared/src/mood/index.ts` (confirm `BUILT_IN_MOODS: readonly MoodDef[]` shape: `{ name, displayName, emoji, icon, color, band? }`, and `moodValueToTag(value: number): string`).

- [ ] **Step 4: Implement `FastingMoodTab.tsx`**

```tsx
// SparkyFitnessMobile/src/components/checkin/FastingMoodTab.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import Toast from 'react-native-toast-message';
import { BUILT_IN_MOODS, moodValueToTag } from '@workspace/shared';
import { useCSSVariable } from 'uniwind';
import FastingCard from '../FastingCard';
import Button from '../ui/Button';
import { useMoodForDate, useSaveMoodMutation } from '../../hooks/useMood';
import type { RootStackScreenProps } from '../../types/navigation';

interface FastingMoodTabProps {
  selectedDate: string;
  navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'];
}

const FastingMoodTab: React.FC<FastingMoodTabProps> = ({ selectedDate, navigation }) => {
  const [accentColor, mutedColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];

  const { data: existingMood, isLoading } = useMoodForDate(selectedDate);
  const saveMoodMutation = useSaveMoodMutation();

  const [mood, setMood] = useState(50);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Re-seed the form whenever the loaded entry for this date changes (date
  // switch, or the query settling after a save). A dirty-tracking guard is
  // unnecessary here: unlike Measurements, this form has no server-refetch
  // race to protect against — it only ever loads once per date on mount.
  useEffect(() => {
    if (existingMood) {
      setMood(existingMood.mood_value);
      setMoodTags(existingMood.mood_tags);
      setNotes(existingMood.notes);
    } else {
      setMood(50);
      setMoodTags([]);
      setNotes('');
    }
  }, [existingMood]);

  const toggleTag = (name: string) => {
    setMoodTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  };

  const handleSave = async () => {
    try {
      await saveMoodMutation.mutateAsync({ mood_value: mood, mood_tags: moodTags, notes, entry_date: selectedDate });
      Toast.show({ type: 'success', text1: 'Mood saved' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save mood' });
    }
  };

  const currentBandName = moodValueToTag(mood);
  const currentBandMood = BUILT_IN_MOODS.find((m) => m.name === currentBandName);

  return (
    <View className="gap-4">
      <FastingCard navigation={navigation} />

      <View className="bg-surface rounded-xl p-4">
        <Text className="text-text-primary text-base font-semibold mb-3">How are you feeling today?</Text>

        {isLoading ? (
          <ActivityIndicator color={accentColor} />
        ) : (
          <>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-text-secondary text-sm">Overall mood</Text>
              <Text className="text-text-primary text-sm font-medium">
                {currentBandMood?.emoji} {currentBandMood?.displayName}
              </Text>
            </View>
            <Slider
              value={mood}
              minimumValue={10}
              maximumValue={100}
              step={5}
              onValueChange={setMood}
              minimumTrackTintColor={accentColor}
              accessibilityLabel="Overall mood"
            />

            <View className="flex-row flex-wrap gap-2 mt-4 mb-4">
              {BUILT_IN_MOODS.map((m) => {
                const active = moodTags.includes(m.name);
                return (
                  <TouchableOpacity
                    key={m.name}
                    onPress={() => toggleTag(m.name)}
                    className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${active ? 'bg-accent-primary' : 'bg-raised'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text>{m.emoji}</Text>
                    <Text className={`text-sm ${active ? 'text-white font-semibold' : 'text-text-muted'}`}>
                      {m.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any thoughts or feelings you'd like to add?"
              placeholderTextColor={mutedColor}
              multiline
              className="text-text-primary border border-border-subtle rounded-lg p-3 min-h-20 mb-4"
              textAlignVertical="top"
            />

            <Button variant="primary" onPress={handleSave} loading={saveMoodMutation.isPending}>
              Save Mood
            </Button>
          </>
        )}
      </View>
    </View>
  );
};

export default FastingMoodTab;
```

Before finalizing, confirm `@react-native-community/slider` is already a dependency (`grep '"@react-native-community/slider"' SparkyFitnessMobile/package.json`) — if it is not installed, use whatever slider primitive is already used elsewhere in this codebase instead (search for existing `Slider` usage first); do not add a new native dependency without checking for an existing equivalent.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/FastingMoodTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/components/checkin/FastingMoodTab.tsx SparkyFitnessMobile/__tests__/components/checkin/FastingMoodTab.test.tsx
git commit -m "feat(mobile): add FastingMoodTab component"
```

---

### Task 9: `SleepTab.tsx` component

**Files:**
- Create: `SparkyFitnessMobile/src/components/checkin/SleepTab.tsx`
- Test: `SparkyFitnessMobile/__tests__/components/checkin/SleepTab.test.tsx`

**Interfaces:**
- Produces: `SleepTab` (default export), props `{ selectedDate: string }`.
- Consumes: `useSleepEntries`, `useSaveSleepEntryMutation`, `useUpdateSleepEntryMutation`, `useDeleteSleepEntryMutation` (Task 6), `TimeSheet`/`TimeSheetRef` (`../TimeSheet`, existing), `formatTimeInZone`-equivalent formatting (use `toLocaleTimeString` directly — this tab does not need timezone-aware formatting beyond what the device clock already provides, since entries are always same-device-recorded).

Per the spec, existing entries need both **edit** (re-open bedtime/wake time pre-filled, save routes to `useUpdateSleepEntryMutation` instead of create) and delete — this is not optional polish, write both.

Also produces: `SparkyFitnessMobile/src/utils/sleepCalculations.ts` — `toBedtimeWakeTimeDates(selectedDate: string, bedtimeHHMM: string, wakeTimeHHMM: string): { bed: Date; wake: Date }`, a pure function extracted so the overnight-wraparound rule (bedtime rolls back a day when it is chronologically after wake time on the same calendar day, matching web's `SleepEntrySection` logic verbatim) is unit-testable directly rather than only through the full component with a stubbed time picker.

- [ ] **Step 1: Write the failing test**

```tsx
// SparkyFitnessMobile/__tests__/utils/sleepCalculations.test.ts
import { toBedtimeWakeTimeDates } from '../../src/utils/sleepCalculations';

describe('toBedtimeWakeTimeDates', () => {
  test('same-day bedtime/wake (e.g. a nap) needs no rollover', () => {
    const { bed, wake } = toBedtimeWakeTimeDates('2026-08-24', '13:00', '14:30');
    expect(wake.getTime() - bed.getTime()).toBe(90 * 60 * 1000);
  });

  test('rolls bedtime back a day when it is chronologically after wake time (overnight sleep)', () => {
    const { bed, wake } = toBedtimeWakeTimeDates('2026-08-24', '22:30', '06:30');
    // bed lands on 2026-08-23T22:30, wake stays 2026-08-24T06:30 -> 8h apart.
    expect(wake.getTime() - bed.getTime()).toBe(8 * 60 * 60 * 1000);
    expect(bed.toISOString().slice(0, 10)).toBe('2026-08-23');
    expect(wake.toISOString().slice(0, 10)).toBe('2026-08-24');
  });
});
```

```tsx
// SparkyFitnessMobile/__tests__/components/checkin/SleepTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SleepTab from '../../../src/components/checkin/SleepTab';
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../../src/services/api/sleepApi';

jest.mock('../../../src/services/api/sleepApi');

// TimeSheet is a bottom-sheet time wheel; stub it as a button that reports a
// fixed time distinguishable per test-id, so bedtime/wake time can be set
// independently without driving the real wheel UI.
jest.mock('../../../src/components/TimeSheet', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        { onSelectTime, testID }: { onSelectTime: (t: string) => void; testID?: string },
        ref: React.Ref<unknown>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          present: () => onSelectTime(testID === 'bedtime-sheet' ? '22:00' : '06:00'),
          dismiss: jest.fn(),
        }));
        return <TouchableOpacity testID={testID}><Text>TimeSheet</Text></TouchableOpacity>;
      },
    ),
  };
});

const mockFetchSleepEntries = fetchSleepEntries as jest.MockedFunction<typeof fetchSleepEntries>;
const mockSaveSleepEntry = saveSleepEntry as jest.MockedFunction<typeof saveSleepEntry>;
const mockUpdateSleepEntry = updateSleepEntry as jest.MockedFunction<typeof updateSleepEntry>;
const mockDeleteSleepEntry = deleteSleepEntry as jest.MockedFunction<typeof deleteSleepEntry>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SleepTab selectedDate="2026-08-24" />
    </QueryClientProvider>,
  );
}

describe('SleepTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSleepEntries.mockResolvedValue([]);
  });

  test('renders bedtime/wake time pickers and a save button', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Bedtime')).toBeTruthy();
    });
    expect(screen.getByText('Wake Time')).toBeTruthy();
    expect(screen.getByText('Save Sleep')).toBeTruthy();
  });

  test('entering bedtime and wake time then saving calls saveSleepEntry with a computed duration', async () => {
    mockSaveSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 28800, source: 'manual' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('bedtime-sheet')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('bedtime-sheet'));
    fireEvent.press(screen.getByTestId('waketime-sheet'));
    fireEvent.press(screen.getByText('Save Sleep'));

    await waitFor(() => {
      expect(mockSaveSleepEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entry_date: '2026-08-24', duration_in_seconds: 8 * 60 * 60 }),
      );
    });
  });

  test('lists an existing entry for the date with edit and delete actions', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('delete-sleep-s1')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-sleep-s1')).toBeTruthy();
  });

  test('tapping edit then Save Sleep calls updateSleepEntry (not saveSleepEntry) for that entry', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);
    mockUpdateSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 28800, source: 'manual' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('edit-sleep-s1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('edit-sleep-s1'));
    // Editing pre-fills bedtime/wake from the entry, so Save Sleep is
    // pressable immediately without re-selecting either time.
    fireEvent.press(screen.getByText('Save Sleep'));

    await waitFor(() => {
      expect(mockUpdateSleepEntry).toHaveBeenCalledWith('s1', expect.objectContaining({ record_timezone: expect.any(String) }));
    });
    expect(mockSaveSleepEntry).not.toHaveBeenCalled();
  });

  test('deleting an entry calls deleteSleepEntry with its id', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);
    mockDeleteSleepEntry.mockResolvedValue(undefined);

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('delete-sleep-s1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('delete-sleep-s1'));

    await waitFor(() => {
      expect(mockDeleteSleepEntry).toHaveBeenCalledWith('s1');
    });
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/utils/sleepCalculations.test.ts __tests__/components/checkin/SleepTab.test.tsx`
Expected: FAIL — cannot find module `../../src/utils/sleepCalculations`, and cannot find module `../../../src/components/checkin/SleepTab`

- [ ] **Step 3: Read `TimeSheet.tsx`**

Read `SparkyFitnessMobile/src/components/TimeSheet.tsx` in full — confirm the `TimeSheetRef` shape (`present()`/`dismiss()`, following the same `forwardRef` pattern as `CalendarSheet`/`DateRangeSheet`) and how `value`/`onSelectTime` (`'HH:MM'` strings) round-trip. Note the test's `TimeSheet` mock (Step 1) calls `onSelectTime` from inside its mocked `present()`, so make sure `SleepTab.tsx` passes `testID="bedtime-sheet"` / `testID="waketime-sheet"` to the two `<TimeSheet>` elements — the mock switches on that prop to report a distinct time per picker.

- [ ] **Step 4: Implement `sleepCalculations.ts`**

```ts
// SparkyFitnessMobile/src/utils/sleepCalculations.ts

/**
 * HH:MM (device clock) -> a Date on selectedDate, rolling bedtime back a day
 * when it is chronologically after wake time on the same calendar day —
 * matches web's exact overnight-wraparound handling in SleepEntrySection.
 */
export function toBedtimeWakeTimeDates(
  selectedDate: string,
  bedtimeHHMM: string,
  wakeTimeHHMM: string,
): { bed: Date; wake: Date } {
  const wake = new Date(`${selectedDate}T${wakeTimeHHMM}:00`);
  let bed = new Date(`${selectedDate}T${bedtimeHHMM}:00`);
  if (bed > wake) {
    bed = new Date(bed.getTime() - 24 * 60 * 60 * 1000);
  }
  return { bed, wake };
}
```

- [ ] **Step 5: Run the utility test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/utils/sleepCalculations.test.ts`
Expected: PASS

- [ ] **Step 6: Implement `SleepTab.tsx`**

```tsx
// SparkyFitnessMobile/src/components/checkin/SleepTab.tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import TimeSheet, { type TimeSheetRef } from '../TimeSheet';
import Button from '../ui/Button';
import Icon from '../Icon';
import { toBedtimeWakeTimeDates } from '../../utils/sleepCalculations';
import {
  useSleepEntries,
  useSaveSleepEntryMutation,
  useUpdateSleepEntryMutation,
  useDeleteSleepEntryMutation,
} from '../../hooks/useSleep';
import type { SleepEntry } from '../../services/api/sleepApi';

interface SleepTabProps {
  selectedDate: string;
}

const formatClockTime = (isoString: string) =>
  new Date(isoString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** '2026-08-24T22:00:00.000Z' -> '22:00' for pre-filling the time pickers on edit. */
const toHHMM = (isoString: string) => new Date(isoString).toISOString().slice(11, 16);

const SleepTab: React.FC<SleepTabProps> = ({ selectedDate }) => {
  const [accentColor, dangerColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-danger',
  ]) as [string, string];

  const bedtimeSheetRef = useRef<TimeSheetRef>(null);
  const wakeTimeSheetRef = useRef<TimeSheetRef>(null);

  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  // Non-null while editing an existing entry; save routes to the update
  // mutation and clears back to the create form on success.
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useSleepEntries(selectedDate, selectedDate);
  const saveMutation = useSaveSleepEntryMutation();
  const updateMutation = useUpdateSleepEntryMutation();
  const deleteMutation = useDeleteSleepEntryMutation();

  const isSaving = saveMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditingId(null);
    setBedtime('');
    setWakeTime('');
  };

  const handleEdit = (entry: SleepEntry) => {
    setEditingId(entry.id);
    setBedtime(toHHMM(entry.bedtime));
    setWakeTime(toHHMM(entry.wake_time));
  };

  const handleSave = async () => {
    if (!bedtime || !wakeTime) {
      Toast.show({ type: 'error', text1: 'Enter both bedtime and wake time' });
      return;
    }
    const { bed, wake } = toBedtimeWakeTimeDates(selectedDate, bedtime, wakeTime);
    const durationInSeconds = Math.round((wake.getTime() - bed.getTime()) / 1000);
    const record_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          payload: { bedtime: bed.toISOString(), wake_time: wake.toISOString(), duration_in_seconds: durationInSeconds, record_timezone },
        });
        Toast.show({ type: 'success', text1: 'Sleep entry updated' });
      } else {
        await saveMutation.mutateAsync({
          entry_date: selectedDate,
          bedtime: bed.toISOString(),
          wake_time: wake.toISOString(),
          duration_in_seconds: durationInSeconds,
          record_timezone,
        });
        Toast.show({ type: 'success', text1: 'Sleep entry saved' });
      }
      resetForm();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save sleep entry' });
    }
  };

  const handleDelete = async (entry: SleepEntry) => {
    try {
      await deleteMutation.mutateAsync(entry.id);
      if (editingId === entry.id) resetForm();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete sleep entry' });
    }
  };

  return (
    <View className="gap-4">
      <View className="bg-surface rounded-xl p-4">
        <Text className="text-text-primary text-base font-semibold mb-3">
          {editingId ? 'Edit Sleep Entry' : 'Sleep Tracking'}
        </Text>

        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity className="flex-1" onPress={() => bedtimeSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Bedtime</Text>
            <Text className="text-text-primary text-base">{bedtime || 'Select time'}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1" onPress={() => wakeTimeSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Wake Time</Text>
            <Text className="text-text-primary text-base">{wakeTime || 'Select time'}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          <Button variant="primary" onPress={handleSave} loading={isSaving} className="flex-1">
            Save Sleep
          </Button>
          {editingId && (
            <Button variant="secondary" onPress={resetForm} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={accentColor} />
      ) : (
        entries.map((entry) => (
          <View key={entry.id} className="bg-surface rounded-xl p-4 flex-row items-center justify-between">
            <Text className="text-text-primary text-sm">
              {formatClockTime(entry.bedtime)} – {formatClockTime(entry.wake_time)}
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => handleEdit(entry)}
                hitSlop={8}
                accessibilityLabel="Edit sleep entry"
                testID={`edit-sleep-${entry.id}`}
              >
                <Icon name="pencil" size={18} color={accentColor} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(entry)}
                hitSlop={8}
                accessibilityLabel="Delete sleep entry"
                testID={`delete-sleep-${entry.id}`}
              >
                <Icon name="trash" size={18} color={dangerColor} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TimeSheet ref={bedtimeSheetRef} value={bedtime} onSelectTime={setBedtime} testID="bedtime-sheet" />
      <TimeSheet ref={wakeTimeSheetRef} value={wakeTime} onSelectTime={setWakeTime} testID="waketime-sheet" />
    </View>
  );
};

export default SleepTab;
```

`TimeSheet`'s current props (per Step 3) are only `{ value, onSelectTime }` — it does not accept a `testID` today. Add `testID?: string` to `TimeSheetProps` in `SparkyFitnessMobile/src/components/TimeSheet.tsx` and forward it onto the component's outer element (or onto the `BottomSheetModal`, whichever the existing component structure makes natural — read the file first) as part of this task, since `SleepTab` is this component's first caller that needs to distinguish two instances in tests. This is a small, additive, backward-compatible prop addition (existing callers omit it and get `undefined`, unchanged from today).

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/SleepTab.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add SparkyFitnessMobile/src/utils/sleepCalculations.ts SparkyFitnessMobile/__tests__/utils/sleepCalculations.test.ts SparkyFitnessMobile/src/components/checkin/SleepTab.tsx SparkyFitnessMobile/__tests__/components/checkin/SleepTab.test.tsx SparkyFitnessMobile/src/components/TimeSheet.tsx
git commit -m "feat(mobile): add SleepTab component with edit/delete"
```

---

### Task 10: `PhotosTab.tsx` component

**Files:**
- Create: `SparkyFitnessMobile/src/components/checkin/PhotosTab.tsx`
- Test: `SparkyFitnessMobile/__tests__/components/checkin/PhotosTab.test.tsx`

**Interfaces:**
- Produces: `PhotosTab` (default export), props `{ selectedDate: string; navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'] }` (navigation is needed to push `ProgressPhotosCompareScreen`, built in Task 11 — this task can be implemented and tested before Task 11 exists; the "Compare" button's `onPress` calls `navigation.navigate('ProgressPhotosCompare')`, which will not resolve until Task 12 registers the route, but that does not block this task's own tests since they mock `navigation`).
- Consumes: `useCheckInPhotosForDate`, `useUploadCheckInPhotoMutation`, `useDeleteCheckInPhotoMutation`, `useCheckInPhotoImageSource` (Task 7), `pickImageFromCamera`, `pickImagesFromLibrary` (`../../utils/pickImage`, existing), `ActionSheet`/`ActionSheetRef` (`../ActionSheet`, existing), `SafeImage` (`../SafeImage`, existing).

- [ ] **Step 1: Write the failing test**

```tsx
// SparkyFitnessMobile/__tests__/components/checkin/PhotosTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PhotosTab from '../../../src/components/checkin/PhotosTab';
import { fetchPhotosForDate, uploadPhoto, buildPhotoImageSource } from '../../../src/services/api/checkInPhotosApi';
import { pickImageFromCamera } from '../../../src/utils/pickImage';

jest.mock('../../../src/services/api/checkInPhotosApi');
jest.mock('../../../src/utils/pickImage');

const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockUploadPhoto = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;
const mockPickImageFromCamera = pickImageFromCamera as jest.MockedFunction<typeof pickImageFromCamera>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PhotosTab selectedDate="2026-08-24" navigation={{ navigate: jest.fn() } as never} />
    </QueryClientProvider>,
  );
}

describe('PhotosTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPhotosForDate.mockResolvedValue([]);
    mockBuildPhotoImageSource.mockResolvedValue(null);
  });

  test('renders three empty slots (front, back, side) with no photos', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Front')).toBeTruthy();
    });
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Side')).toBeTruthy();
  });

  test('tapping an empty slot opens the camera/library action sheet, and picking a camera photo uploads it', async () => {
    mockPickImageFromCamera.mockResolvedValue({ status: 'ok', image: { uri: 'file:///tmp/front.jpg' } });
    mockUploadPhoto.mockResolvedValue({ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Front')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('photo-slot-front'));
    fireEvent.press(await screen.findByText('Take Photo'));

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith('2026-08-24', 'front', 'file:///tmp/front.jpg');
    });
  });

  test('renders a Compare button that navigates to the comparison screen', async () => {
    const navigate = jest.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PhotosTab selectedDate="2026-08-24" navigation={{ navigate } as never} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Compare')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Compare'));

    expect(navigate).toHaveBeenCalledWith('ProgressPhotosCompare');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/PhotosTab.test.tsx`
Expected: FAIL — cannot find module `../../../src/components/checkin/PhotosTab`

- [ ] **Step 3: Read `BumpPhotoJournal.tsx` and `pickImage.ts`**

Read `SparkyFitnessMobile/src/components/wellness/pregnancy/BumpPhotoJournal.tsx` and `SparkyFitnessMobile/src/utils/pickImage.ts` in full — this task follows their exact shape (`ActionSheet` for camera/library choice, `pickerLock` ref to prevent double-taps, upload-in-flight state) but through `pickImageFromCamera`/`pickImagesFromLibrary` (which `BumpPhotoJournal` does not use — it calls `expo-image-picker` directly; this task should use the shared, already-downscaling utility instead, since it is the more current pattern used by `FoodPhotoImproveScreen`/`FoodScanScreen`).

- [ ] **Step 4: Implement `PhotosTab.tsx`**

```tsx
// SparkyFitnessMobile/src/components/checkin/PhotosTab.tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import ActionSheet, { type ActionSheetRef } from '../ActionSheet';
import SafeImage from '../SafeImage';
import Icon from '../Icon';
import { pickImageFromCamera, pickImagesFromLibrary } from '../../utils/pickImage';
import {
  useCheckInPhotosForDate,
  useUploadCheckInPhotoMutation,
  useDeleteCheckInPhotoMutation,
  useCheckInPhotoImageSource,
} from '../../hooks/useCheckInPhotos';
import type { CheckInPhoto, PhotoType } from '../../services/api/checkInPhotosApi';
import type { RootStackScreenProps } from '../../types/navigation';

interface PhotosTabProps {
  selectedDate: string;
  navigation: RootStackScreenProps<'MeasurementsAdd'>['navigation'];
}

const PHOTO_TYPES: { type: PhotoType; label: string }[] = [
  { type: 'front', label: 'Front' },
  { type: 'back', label: 'Back' },
  { type: 'side', label: 'Side' },
];

const PhotoSlot: React.FC<{
  type: PhotoType;
  label: string;
  photo: CheckInPhoto | undefined;
  onPick: (type: PhotoType) => void;
  onDelete: (photo: CheckInPhoto) => void;
  isUploading: boolean;
  disabled: boolean;
}> = ({ type, label, photo, onPick, onDelete, isUploading, disabled }) => {
  const { source } = useCheckInPhotoImageSource(photo?.id);
  const [accentColor] = useCSSVariable(['--color-accent-primary']) as [string];

  return (
    <View className="flex-1 items-center gap-2">
      <Text className="text-text-secondary text-sm font-medium">{label}</Text>
      <TouchableOpacity
        onPress={() => !disabled && onPick(type)}
        disabled={disabled}
        testID={`photo-slot-${type}`}
        className="w-full aspect-[3/4] rounded-lg bg-raised items-center justify-center overflow-hidden"
      >
        {isUploading ? (
          <ActivityIndicator color={accentColor} />
        ) : source ? (
          <SafeImage source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Icon name="camera" size={28} color={accentColor} />
        )}
      </TouchableOpacity>
      {photo && (
        <TouchableOpacity onPress={() => onDelete(photo)} disabled={disabled} testID={`delete-photo-${type}`}>
          <Text className="text-text-secondary text-xs">Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const PhotosTab: React.FC<PhotosTabProps> = ({ selectedDate, navigation }) => {
  const { data: photos = [], isLoading } = useCheckInPhotosForDate(selectedDate);
  const uploadMutation = useUploadCheckInPhotoMutation();
  const deleteMutation = useDeleteCheckInPhotoMutation();

  const actionSheetRef = useRef<ActionSheetRef>(null);
  const pendingType = useRef<PhotoType | null>(null);
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);

  const photoByType = new Map(photos.map((p) => [p.photo_type, p]));

  const openPicker = (type: PhotoType) => {
    pendingType.current = type;
    actionSheetRef.current?.present();
  };

  const handlePick = async (source: 'camera' | 'library') => {
    const type = pendingType.current;
    if (!type) return;

    const result = source === 'camera' ? await pickImageFromCamera() : { status: 'ok' as const, image: (await pickImagesFromLibrary(1))[0] };
    if (result.status === 'denied') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }
    if (result.status === 'cancelled' || !('image' in result) || !result.image) return;

    setUploadingType(type);
    try {
      await uploadMutation.mutateAsync({ date: selectedDate, type, uri: result.image.uri });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not upload photo' });
    } finally {
      setUploadingType(null);
    }
  };

  const handleDelete = async (photo: CheckInPhoto) => {
    try {
      await deleteMutation.mutateAsync({ id: photo.id, entryDate: photo.entry_date });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete photo' });
    }
  };

  const anyUploading = uploadingType !== null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary text-base font-semibold">Progress Photos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ProgressPhotosCompare')}>
          <Text className="text-accent-primary text-sm font-semibold">Compare</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <View className="flex-row gap-3">
          {PHOTO_TYPES.map(({ type, label }) => (
            <PhotoSlot
              key={type}
              type={type}
              label={label}
              photo={photoByType.get(type)}
              onPick={openPicker}
              onDelete={handleDelete}
              isUploading={uploadingType === type}
              disabled={anyUploading || deleteMutation.isPending}
            />
          ))}
        </View>
      )}

      <ActionSheet
        ref={actionSheetRef}
        title="Add Progress Photo"
        items={[
          { key: 'camera', label: 'Take Photo', onPress: () => handlePick('camera') },
          { key: 'library', label: 'Choose from Library', onPress: () => handlePick('library') },
        ]}
      />
    </View>
  );
};

export default PhotosTab;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/components/checkin/PhotosTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add SparkyFitnessMobile/src/components/checkin/PhotosTab.tsx SparkyFitnessMobile/__tests__/components/checkin/PhotosTab.test.tsx
git commit -m "feat(mobile): add PhotosTab component"
```

---

### Task 11: `ProgressPhotosCompareScreen.tsx`

**Files:**
- Create: `SparkyFitnessMobile/src/screens/ProgressPhotosCompareScreen.tsx`
- Test: `SparkyFitnessMobile/__tests__/screens/ProgressPhotosCompareScreen.test.tsx`

**Interfaces:**
- Produces: `ProgressPhotosCompareScreen` (default export, no props — a root-stack push screen with no route params).
- Consumes: `useCheckInPhotoDates`, `useCheckInPhotosForDate`, `useCheckInPhotoImageSource` (Task 7), `CalendarSheet`/`CalendarSheetRef` (existing), `SafeImage` (existing), `useScreenHeader` (existing — this is a root-stack push screen, so the tab-root restriction from the Reports feature's Task 1 does not apply; use `useScreenHeader({ title: 'Compare Photos', left: { kind: 'back' } })` as-is).

- [ ] **Step 1: Write the failing test**

```tsx
// SparkyFitnessMobile/__tests__/screens/ProgressPhotosCompareScreen.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProgressPhotosCompareScreen from '../../src/screens/ProgressPhotosCompareScreen';
import { fetchPhotoDates, fetchPhotosForDate, buildPhotoImageSource } from '../../src/services/api/checkInPhotosApi';

jest.mock('../../src/services/api/checkInPhotosApi');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));

const mockFetchPhotoDates = fetchPhotoDates as jest.MockedFunction<typeof fetchPhotoDates>;
const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProgressPhotosCompareScreen />
    </QueryClientProvider>,
  );
}

describe('ProgressPhotosCompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPhotoDates.mockResolvedValue(['2026-08-01', '2026-08-24']);
    mockFetchPhotosForDate.mockResolvedValue([]);
    mockBuildPhotoImageSource.mockResolvedValue(null);
  });

  test('renders the title and two date pickers', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Compare Photos')).toBeTruthy();
    });
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Side')).toBeTruthy();
  });

  test('shows a "No photo" placeholder for a type missing on one side', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByText('No photo').length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/screens/ProgressPhotosCompareScreen.test.tsx`
Expected: FAIL — cannot find module `../../src/screens/ProgressPhotosCompareScreen`

- [ ] **Step 3: Implement `ProgressPhotosCompareScreen.tsx`**

```tsx
// SparkyFitnessMobile/src/screens/ProgressPhotosCompareScreen.tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenHeader } from '../hooks/useScreenHeader';
import CalendarSheet, { type CalendarSheetRef } from '../components/CalendarSheet';
import SafeImage from '../components/SafeImage';
import { useCheckInPhotoDates, useCheckInPhotosForDate, useCheckInPhotoImageSource } from '../hooks/useCheckInPhotos';
import type { PhotoType } from '../services/api/checkInPhotosApi';
import { getTodayDate } from '../utils/dateUtils';

const PHOTO_TYPES: { type: PhotoType; label: string }[] = [
  { type: 'front', label: 'Front' },
  { type: 'back', label: 'Back' },
  { type: 'side', label: 'Side' },
];

const PhotoCell: React.FC<{ photoId: string | undefined }> = ({ photoId }) => {
  const { source } = useCheckInPhotoImageSource(photoId);
  return (
    <View className="flex-1 aspect-[3/4] rounded-lg bg-raised items-center justify-center overflow-hidden">
      {source ? (
        <SafeImage source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text className="text-text-muted text-xs">No photo</Text>
      )}
    </View>
  );
};

const ProgressPhotosCompareScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const header = useScreenHeader({ title: 'Compare Photos', left: { kind: 'back' } });

  const { data: photoDates = [] } = useCheckInPhotoDates();
  const today = getTodayDate();
  const [leftDate, setLeftDate] = useState(photoDates[1] ?? today);
  const [rightDate, setRightDate] = useState(photoDates[0] ?? today);

  const leftSheetRef = useRef<CalendarSheetRef>(null);
  const rightSheetRef = useRef<CalendarSheetRef>(null);

  const { data: leftPhotos = [] } = useCheckInPhotosForDate(leftDate);
  const { data: rightPhotos = [] } = useCheckInPhotosForDate(rightDate);

  const leftByType = new Map(leftPhotos.map((p) => [p.photo_type, p]));
  const rightByType = new Map(rightPhotos.map((p) => [p.photo_type, p]));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}
      <ScrollView contentContainerClassName="px-4 py-4 gap-4">
        <View className="flex-row gap-3">
          <TouchableOpacity className="flex-1" onPress={() => leftSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Date A</Text>
            <Text className="text-text-primary text-base font-medium">{leftDate}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1" onPress={() => rightSheetRef.current?.present()}>
            <Text className="text-text-secondary text-sm mb-1">Date B</Text>
            <Text className="text-text-primary text-base font-medium">{rightDate}</Text>
          </TouchableOpacity>
        </View>

        {PHOTO_TYPES.map(({ type, label }) => (
          <View key={type} className="gap-2">
            <Text className="text-text-primary text-sm font-semibold">{label}</Text>
            <View className="flex-row gap-3">
              <PhotoCell photoId={leftByType.get(type)?.id} />
              <PhotoCell photoId={rightByType.get(type)?.id} />
            </View>
          </View>
        ))}
      </ScrollView>

      <CalendarSheet ref={leftSheetRef} selectedDate={leftDate} onSelectDate={setLeftDate} />
      <CalendarSheet ref={rightSheetRef} selectedDate={rightDate} onSelectDate={setRightDate} />
    </View>
  );
};

export default ProgressPhotosCompareScreen;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/screens/ProgressPhotosCompareScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add SparkyFitnessMobile/src/screens/ProgressPhotosCompareScreen.tsx SparkyFitnessMobile/__tests__/screens/ProgressPhotosCompareScreen.test.tsx
git commit -m "feat(mobile): add ProgressPhotosCompareScreen"
```

---

### Task 12: `CheckInScreen.tsx` full assembly + navigation wiring

**Files:**
- Read first: `SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx` (the file this task deletes and replaces)
- Create: `SparkyFitnessMobile/src/screens/CheckInScreen.tsx`
- Delete: `SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx`
- Modify: `SparkyFitnessMobile/App.tsx`
- Modify: `SparkyFitnessMobile/src/navigation/safeScreens.tsx`
- Modify: `SparkyFitnessMobile/src/types/navigation.ts`
- Modify: `SparkyFitnessMobile/src/components/AddSheet.tsx`
- Test: `SparkyFitnessMobile/__tests__/screens/CheckInScreen.test.tsx`

**Interfaces:**
- Produces: the finished `CheckInScreen` — date picker + `SegmentedControl` (4 segments) + active-tab content, rendered at the existing `MeasurementsAdd` route.
- Consumes: `MeasurementsTab` (Task 1), `FastingMoodTab` (Task 8), `SleepTab` (Task 9), `PhotosTab` (Task 10), `SegmentedControl`/`Segment` (existing), `CalendarSheet`/`CalendarSheetRef` (existing), `useScreenHeader`/`SAVE_LABEL`/`SAVING_LABEL` (existing), `FooterSaveBar` (`../components/FormScreenChrome`, existing), `useNativeIOSHeadersActive` (existing), `useDiaryDateStore` (existing).

- [ ] **Step 1: Write the failing test**

```tsx
// SparkyFitnessMobile/__tests__/screens/CheckInScreen.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CheckInScreen from '../../src/screens/CheckInScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));

jest.mock('../../src/components/checkin/MeasurementsTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Measurements content</Text></View> };
});
jest.mock('../../src/components/checkin/FastingMoodTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Fasting content</Text></View> };
});
jest.mock('../../src/components/checkin/SleepTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Sleep content</Text></View> };
});
jest.mock('../../src/components/checkin/PhotosTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Photos content</Text></View> };
});

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <CheckInScreen navigation={{} as never} route={{ params: undefined } as never} />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe('CheckInScreen', () => {
  test('renders all four segment labels and defaults to Measurements', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Measurements content')).toBeTruthy();
    });
    expect(screen.getByText('Measurements')).toBeTruthy();
    expect(screen.getByText('Fasting & Mood')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
  });

  test('switching segments swaps the rendered tab content', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Measurements content')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sleep'));

    expect(screen.getByText('Sleep content')).toBeTruthy();
    expect(screen.queryByText('Measurements content')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/screens/CheckInScreen.test.tsx`
Expected: FAIL — cannot find module `../../src/screens/CheckInScreen`

- [ ] **Step 3: Implement `CheckInScreen.tsx`**

```tsx
// SparkyFitnessMobile/src/screens/CheckInScreen.tsx
import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import Icon from '../components/Icon';
import SegmentedControl, { type Segment } from '../components/SegmentedControl';
import CalendarSheet, { type CalendarSheetRef } from '../components/CalendarSheet';
import { FooterSaveBar } from '../components/FormScreenChrome';
import MeasurementsTab from '../components/checkin/MeasurementsTab';
import FastingMoodTab from '../components/checkin/FastingMoodTab';
import SleepTab from '../components/checkin/SleepTab';
import PhotosTab from '../components/checkin/PhotosTab';
import { formatDateLabel } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader, SAVE_LABEL, SAVING_LABEL } from '../hooks/useScreenHeader';
import { useDiaryDateStore } from '../stores/diaryDateStore';

type Props = RootStackScreenProps<'MeasurementsAdd'>;

type CheckInTab = 'measurements' | 'fastingMood' | 'sleep' | 'photos';

const SEGMENTS: Segment<CheckInTab>[] = [
  { key: 'measurements', label: 'Measurements' },
  { key: 'fastingMood', label: 'Fasting & Mood' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'photos', label: 'Photos' },
];

const CheckInScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const calendarSheetRef = useRef<CalendarSheetRef>(null);

  const [accentPrimary] = useCSSVariable(['--color-accent-primary']) as [string];

  const initialDate = route.params?.date ?? useDiaryDateStore.getState().selectedDate;
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [activeTab, setActiveTab] = useState<CheckInTab>('measurements');

  // Only the Measurements tab routes through the shared header/footer Save —
  // Mood, Sleep, and Photos each own their own inline save/upload action
  // (matching web's CheckIn.tsx, where each section has its own submit
  // control rather than one page-level Save).
  const measurementsSaveRef = useRef<(() => void) | null>(null);
  const [measurementsState, setMeasurementsState] = useState({ isSaving: false, isSaveDisabled: false });

  const handleClose = () => navigation.goBack();
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    useDiaryDateStore.getState().setSelectedDate(date);
  };

  const isMeasurementsTab = activeTab === 'measurements';

  const header = useScreenHeader({
    title: 'Check-In',
    left: { kind: 'dismiss', onPress: handleClose, disabled: isMeasurementsTab && measurementsState.isSaving },
    right: isMeasurementsTab
      ? {
          kind: 'primary',
          label: SAVE_LABEL,
          busyLabel: SAVING_LABEL,
          busy: measurementsState.isSaving,
          disabled: measurementsState.isSaveDisabled,
          placement: 'native-only',
          onPress: () => measurementsSaveRef.current?.(),
          identifier: 'checkin-save',
        }
      : undefined,
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <TouchableOpacity
        onPress={() => calendarSheetRef.current?.present()}
        activeOpacity={0.7}
        className="flex-row items-center px-4 pt-2 pb-1"
      >
        <Text className="text-text-primary text-base">Date</Text>
        <Text className="text-accent-primary text-base font-medium mx-1.5">{formatDateLabel(selectedDate)}</Text>
        <Icon name="chevron-down" size={12} color={accentPrimary} weight="medium" />
      </TouchableOpacity>

      <View className="px-4 pb-2">
        <SegmentedControl segments={SEGMENTS} activeKey={activeTab} onSelect={setActiveTab} />
      </View>

      <View className="flex-1 px-4">
        {activeTab === 'measurements' && (
          <MeasurementsTab
            selectedDate={selectedDate}
            registerSaveHandler={(fn) => {
              measurementsSaveRef.current = fn;
            }}
            onStateChange={setMeasurementsState}
          />
        )}
        {activeTab === 'fastingMood' && <FastingMoodTab selectedDate={selectedDate} navigation={navigation} />}
        {activeTab === 'sleep' && <SleepTab selectedDate={selectedDate} />}
        {activeTab === 'photos' && <PhotosTab selectedDate={selectedDate} navigation={navigation} />}
      </View>

      {!usesNativeHeader && isMeasurementsTab && (
        <FooterSaveBar
          onPress={() => measurementsSaveRef.current?.()}
          disabled={measurementsState.isSaveDisabled}
          busy={measurementsState.isSaving}
        />
      )}

      <CalendarSheet ref={calendarSheetRef} selectedDate={selectedDate} onSelectDate={handleSelectDate} />
    </View>
  );
};

export default CheckInScreen;
```

- [ ] **Step 4: Run the screen test**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/screens/CheckInScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Delete the old screen and wire navigation**

1. Delete `SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx` (its logic now lives in `MeasurementsTab.tsx` + `CheckInScreen.tsx`).
2. In `SparkyFitnessMobile/src/navigation/safeScreens.tsx`: replace the `MeasurementsAddScreen` import and `SafeMeasurementsAdd` export with `CheckInScreen` / `SafeCheckIn = withErrorBoundary(CheckInScreen, 'MeasurementsAdd')` (keep the route-name string argument `'MeasurementsAdd'` unchanged — that is what the error boundary reports against, and other tooling like `nativeHeaderContract.test.ts` keys off the route name, not the component name). Also add an import + `SafeProgressPhotosCompare = withErrorBoundary(ProgressPhotosCompareScreen, 'ProgressPhotosCompare')` for Task 11's screen.
3. In `SparkyFitnessMobile/App.tsx`:
   - Update the `SafeMeasurementsAdd` import name to `SafeCheckIn` (or keep the import alias `SafeMeasurementsAdd` if you prefer minimal diff — either is fine, just be consistent with what `safeScreens.tsx` exports).
   - Change `options={createStackScreenOptions('Measurements', {...})}` to `createStackScreenOptions('Check-In', {...})` on the existing `<Stack.Screen name="MeasurementsAdd" .../>` (route name unchanged, only the title string changes).
   - Add a new `<Stack.Screen name="ProgressPhotosCompare" component={SafeProgressPhotosCompare} options={createStackScreenOptions('Compare Photos', { headerBackTitle: 'Check-In' })} />` next to it.
4. In `SparkyFitnessMobile/src/types/navigation.ts`: add `ProgressPhotosCompare: undefined;` to `RootStackParamList` (the existing `MeasurementsAdd: { date?: string } | undefined;` line stays unchanged).
5. In `SparkyFitnessMobile/src/components/AddSheet.tsx`: change `{ label: 'Measurements', icon: 'measurements', onPress: onAddMeasurements }` to `{ label: 'Check-In', icon: 'measurements', onPress: onAddMeasurements }` (label text only — icon name and callback prop name unchanged).
6. In `SparkyFitnessMobile/__tests__/navigation/nativeHeaderContract.test.ts`'s `NATIVE_TABS_ROUTE_EXCLUSIONS` object: add an entry for `ProgressPhotosCompare: 'Root-stack detail route presented above the tab host.'` (matching the existing entries' phrasing for similar detail screens like `ExerciseDetail`). `MeasurementsAdd`'s existing exclusion entry (if present) needs no change since the route name is unchanged — check whether `MeasurementsAdd` already has an entry in that object before assuming; if it does not, leave it as-is (its absence means it was already covered some other way, and this task does not change that route's registration shape).

- [ ] **Step 6: Run the full navigation + screen test suite**

Run: `pnpm exec jest --watchman=false --runInBand __tests__/navigation/nativeHeaderContract.test.ts __tests__/screens/CheckInScreen.test.tsx __tests__/screens/ProgressPhotosCompareScreen.test.tsx __tests__/components/checkin`
Expected: PASS across all of them.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: no errors, no unused-import warnings (in particular, confirm nothing still imports the deleted `MeasurementsAddScreen.tsx`).

- [ ] **Step 8: Commit**

```bash
git add SparkyFitnessMobile/src/screens/CheckInScreen.tsx SparkyFitnessMobile/src/navigation/safeScreens.tsx SparkyFitnessMobile/App.tsx SparkyFitnessMobile/src/types/navigation.ts SparkyFitnessMobile/src/components/AddSheet.tsx SparkyFitnessMobile/__tests__/screens/CheckInScreen.test.tsx SparkyFitnessMobile/__tests__/navigation/nativeHeaderContract.test.ts
git rm SparkyFitnessMobile/src/screens/MeasurementsAddScreen.tsx
git commit -m "feat(mobile): assemble CheckInScreen and wire navigation"
```

---

### Task 13: Full validation pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run the full mobile test suite**

Run: `cd SparkyFitnessMobile && pnpm exec jest --watchman=false --runInBand`
Expected: PASS, including every file created/modified in Tasks 1-12.

- [ ] **Step 2: Run typecheck, lint, and format check together**

Run: `pnpm run validate`
Expected: PASS (typecheck + Expo lint with no errors).

- [ ] **Step 3: Fix any failures found in Steps 1-2**

If `pnpm run validate` reports unused imports, missing types, or `any` usage introduced anywhere in Tasks 1-12, fix them directly in the offending file (no suppression comments, no lint-config weakening) and re-run Step 2 until clean.

- [ ] **Step 4: Manual smoke check**

Run: `pnpm start` from `SparkyFitnessMobile/`, launch on iOS simulator, and confirm:
- `AddSheet`'s "Check-In" button opens `CheckInScreen` with all four segments visible.
- Measurements tab behaves exactly as the old screen did (values prefill, Save works, header/footer Save reflects pending state) — except a successful save no longer closes the screen.
- Fasting & Mood tab shows the existing `FastingCard` plus the new mood form; saving mood persists and reloads correctly on revisiting the date.
- Sleep tab: entering bedtime/wake time and saving creates an entry; the overnight case (bedtime PM, wake AM) computes a sane duration; deleting an entry removes it.
- Photos tab: capturing/picking a photo for each of front/back/side uploads and displays it; deleting removes it; "Compare" opens `ProgressPhotosCompareScreen` with two working date pickers and correct side-by-side rendering (including "No photo" placeholders).
- Switching segments preserves the selected date across all four tabs.

This manual pass is what the PR's before/after screenshots (required by `CONTRIBUTING.md`) should come from.

- [ ] **Step 5: Final commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address validate findings in Check-In feature"
```

If Step 3 required no fixes, skip this step.
