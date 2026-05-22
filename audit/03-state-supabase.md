# Zone 3: State Management / Supabase SDK Compliance Audit
**SDKs:** zustand@^5.0.9, @supabase/supabase-js@^2.49.0 | **Audited:** 2026-05-22 | **Files audited:** `src/stores/authStore.ts`, `src/stores/buildStore.ts`, `src/stores/interestDiscoveryStore.ts`, `src/stores/interestsStore.ts`, `src/stores/navigationStore.ts`, `src/stores/onboardingStore.ts`, `src/stores/orchestrationStore.ts`, `src/stores/orchestrationSync.ts`, `src/stores/previewStore.ts`, `src/stores/projectsStore.ts`, `src/stores/searchStore.ts`, `src/stores/tabStore.ts`, `src/stores/taskStore.ts`, `src/stores/userPreferencesStore.ts`, `src/api/supabase.ts`, `src/context/AgentUiContext.tsx`, `supabase/migrations/*.sql`

## Executive Summary

The highest-risk issue is Supabase Auth session persistence: the client uses `persistSession: true` with no custom storage adapter, so Supabase stores access/refresh tokens in the renderer's default browser storage even though `authStore` also attempts to copy tokens into Electron IPC-backed storage. OAuth is also incomplete for Electron because it uses normal browser redirect behavior, omits `skipBrowserRedirect`, and does not exchange a deep-link callback with PKCE. On the Zustand side, most persisted stores use the v5 TypeScript curried pattern, but four stores still use the single-call generic form. Several persisted stores save sensitive or high-volume user content to localStorage without explicit storage choices, versions, or migrations. Supabase migrations mostly enable RLS, but migration `001`/`003` conflict on `projects`, `001` alters an external `tasks` table with RLS status UNVERIFIED, and project data reads rely almost entirely on RLS instead of scoped client queries.

## Severity Legend
- 🔴 CRITICAL (token/session exposure, data isolation break, likely runtime auth break)
- 🟠 HIGH (SDK mismatch, Electron OAuth breakage, migration/schema risk)
- 🟡 MEDIUM (best-practice violation, scalability/performance risk)
- 🟢 LOW (cleanup, maintainability, UNVERIFIED follow-up)

## Audit Coverage Matrix

| Area | Files/lines reviewed | Result |
| --- | --- | --- |
| Zustand v5 `create<T>()(...)` | All 14 store files | 10 compliant, 4 non-compliant single-call generic stores |
| Persist middleware | `authStore`, `buildStore`, `interestsStore`, `navigationStore`, `onboardingStore`, `projectsStore`, `tabStore`, `userPreferencesStore` | Names present; several lack `version`/`migrate`; several persist sensitive/high-volume user data to default localStorage |
| Subscriptions/selectors | Store exports plus grep of `/src` consumers | Store selectors exist in some files, but many consumers subscribe to whole stores |
| Supabase client/auth | `src/api/supabase.ts`, `authStore.ts`, `AgentUiContext.tsx` | Session storage and OAuth handling are not Electron-compliant |
| Supabase DB queries | `authStore.ts`, `projectsStore.ts`, `src/api/supabase.ts` | Errors usually handled; project child-table queries rely on RLS and several writes are fire-and-forget |
| Migrations/RLS | `supabase/migrations/001` through `005` | Most created tables have RLS; `tasks` RLS is UNVERIFIED; duplicate `projects` migration shape risk |
| Realtime/Storage | Grep in audited scope | No `.channel()` realtime subscriptions or Supabase Storage calls found |

## Findings

### [STATE-SUPA-001] Supabase Auth tokens are persisted to renderer localStorage by default — 🔴 CRITICAL
- **File:** `src/api/supabase.ts:39-44`; `src/stores/authStore.ts:230-237`, `291-298`, `314-321`, `651-657`
- **Current code:**
```ts
return {
  url: url || 'https://placeholder.supabase.co',
  anonKey: anonKey || 'placeholder-anon-key',
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Electron doesn't use URL-based auth
    }
  }
}
```
```ts
// Store tokens in Electron's secure storage
if (window.electron?.auth) {
  await window.electron.auth.storeTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at || 0,
  })
}
```
- **What's wrong:** With `persistSession: true` and no `auth.storage`, `@supabase/supabase-js` uses the browser storage provider. In Electron renderer code, that means the Supabase session, including refresh token, is still persisted outside the IPC storage path. The Electron token copy does not prevent the original Supabase session from being written to renderer storage. `authStore` also persists `user` and `isAuthenticated` to `auth-storage`, which can become inconsistent with Supabase's real session.
- **SDK citation:** Supabase client options define `persistSession` as whether to persist a logged-in session and `storage` as the provider used to store the logged-in session. They also define `autoRefreshToken` and `detectSessionInUrl` as auth options. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts. Supabase sessions consist of an access token JWT and a refresh token, and refresh tokens are unique strings that can be exchanged for a new token pair. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx.
- **Required fix:** Provide an explicit Electron storage adapter that delegates `getItem`/`setItem`/`removeItem` to the secure main-process auth API, or set `persistSession: false` and fully own session restoration/refresh in main-process-backed storage. Do not persist derived `isAuthenticated` without validating the real Supabase session.
- **Fixed code:**
```ts
const electronAuthStorage = {
  async getItem(key: string) {
    return window.electron?.auth?.getItem?.(key) ?? null
  },
  async setItem(key: string, value: string) {
    await window.electron?.auth?.setItem?.(key, value)
  },
  async removeItem(key: string) {
    await window.electron?.auth?.removeItem?.(key)
  },
}

supabaseInstance = createClient(config.url, config.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: electronAuthStorage,
  },
})
```
- **Why this scales/lasts:** There is one source of truth for session persistence, token refresh uses the SDK's storage contract, and future auth features cannot accidentally reintroduce renderer-local token persistence.

### [STATE-SUPA-002] Electron OAuth flow omits PKCE, `skipBrowserRedirect`, and callback exchange — 🔴 CRITICAL
- **File:** `src/api/supabase.ts:17-23`, `39-44`; `src/stores/authStore.ts:412-437`
- **Current code:**
```ts
options?: {
  auth?: {
    autoRefreshToken?: boolean
    persistSession?: boolean
    detectSessionInUrl?: boolean
  }
}
```
```ts
const { error } = await supabase.auth.signInWithOAuth({
  provider: supabaseProvider,
  options: {
    // For Electron, OAuth needs special handling
    // This is a placeholder for when OAuth is implemented
    redirectTo: 'ron://auth/callback',
  }
})
```
- **What's wrong:** The local config type does not include `flowType` or `storage`, so the app cannot express the SDK options needed for native/Electron-style auth. `signInWithOAuth` is called without `skipBrowserRedirect: true`; in an Electron renderer this can navigate the app window instead of returning a URL for `shell.openExternal`/system-browser auth. There is no handler shown in this scope that receives `ron://auth/callback` and calls `setSession` or `exchangeCodeForSession`. With `detectSessionInUrl: false`, the SDK will not auto-consume URL callbacks, which is correct for Electron only if the app does manual deep-link handling.
- **SDK citation:** Supabase's native deep-linking guide shows OAuth with `redirectTo`, `skipBrowserRedirect: true`, opening the returned `data.url` in an auth browser session, then creating the session from the callback URL. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/native-mobile-deep-linking.mdx. Supabase client options document `flowType`, with PKCE recommended for mobile and server-side applications. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts. The Auth types document `skipBrowserRedirect` as preventing immediate browser-context redirect. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts.
- **Required fix:** Extend the config type to include `storage` and `flowType`, set `flowType: 'pkce'`, call OAuth with `skipBrowserRedirect: true`, open `data.url` externally, and complete the deep-link callback by exchanging the returned code/session through Supabase Auth.
- **Fixed code:**
```ts
supabase.auth.signInWithOAuth({
  provider: supabaseProvider,
  options: {
    redirectTo: 'ron://auth/callback',
    skipBrowserRedirect: true,
  },
})
// main/deep-link handler: open data.url externally, then pass ron:// callback
// to renderer/main auth code and call supabase.auth.exchangeCodeForSession(callbackUrl)
```
- **Why this scales/lasts:** PKCE and explicit deep-link exchange work for all configured providers and avoid renderer-window navigation side effects.

### [STATE-SUPA-003] Four Zustand stores still use the non-curried generic `create<T>(...)` TypeScript form — 🟠 HIGH
- **File:** `src/stores/interestDiscoveryStore.ts:229`; `src/stores/orchestrationStore.ts:150`; `src/stores/searchStore.ts:73`; `src/stores/taskStore.ts:194`
- **Current code:**
```ts
export const useSearchStore = create<SearchState>((set, get) => ({
```
```ts
export const useOrchestrationStore = create<OrchestrationStoreState>((set, get) => ({
```
```ts
export const useInterestDiscoveryStore = create<InterestDiscoveryState>((set, get) => ({
```
```ts
export const useTaskStore = create<TaskState>((set, get) => ({
```
- **What's wrong:** Zustand's TypeScript guide says the TypeScript form is `create<T>()(...)`, with the extra call. This code may run, but it does not follow the SDK's v5 TypeScript pattern and weakens type inference around `set`, `get`, and middleware composition.
- **SDK citation:** Zustand's Advanced TypeScript guide: “instead of writing `create(...)`, you have to write `create<T>()(...)` (notice the extra parentheses `()` too along with the type parameter).” Source: https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/advanced-typescript.md.
- **Required fix:** Convert all generic store declarations to the curried form. The other 10 stores already use this correctly.
- **Fixed code:**
```ts
export const useSearchStore = create<SearchState>()((set, get) => ({
  // unchanged body
}))
```
- **Why this scales/lasts:** Every store follows one v5-compatible TypeScript pattern, making future middleware additions and refactors safer.

### [STATE-SUPA-004] Persisted stores lack explicit storage/version/migration strategy for sensitive and evolving state — 🟠 HIGH
- **File:** `src/stores/authStore.ts:651-658`; `src/stores/onboardingStore.ts:173-175`; `src/stores/projectsStore.ts:1109-1118`; `src/stores/interestsStore.ts:422-430`; `src/stores/tabStore.ts:141-149`; `src/stores/userPreferencesStore.ts:143-162`
- **Current code:**
```ts
{
  name: 'auth-storage',
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }),
}
```
```ts
{
  name: 'onboarding-storage'
}
```
```ts
{
  name: 'projects-storage',
  partialize: (state) => ({
    projects: state.projects,
    issues: state.issues,
    issueLinks: state.issueLinks,
    activity: state.activity,
    people: state.people,
  }),
}
```
- **What's wrong:** These stores default to localStorage because no `storage` is provided. `onboarding-storage` persists questionnaire answers, reasoning, and possible system prompt without `partialize`. `projects-storage` persists all project issues and activity, duplicating Supabase-backed data locally. Most persisted stores lack `version` and `migrate`, so breaking shape changes will silently shallow-merge stale state or be dropped only when a future version is added.
- **SDK citation:** Zustand persist docs state `name` is required, `storage` defaults to `createJSONStorage(() => localStorage)`, `partialize` filters persisted fields, `version` handles breaking storage changes, and `migrate` upgrades persisted state. Source: https://github.com/pmndrs/zustand/blob/main/docs/reference/integrations/persisting-store-data.md.
- **Required fix:** For each persisted store, declare explicit storage intent, add `version`, and add `migrate` when the persisted shape is non-trivial. Keep auth persistence derived from the real Supabase session; persist only non-sensitive UI state locally.
- **Fixed code:**
```ts
persist(
  (set, get) => ({ /* state */ }),
  {
    name: 'onboarding-storage',
    version: 1,
    partialize: (state) => ({
      mode: state.mode,
      currentStep: state.currentStep,
      currentQuestionIndex: state.currentQuestionIndex,
      isComplete: state.isComplete,
      answers: state.answers,
    }),
    migrate: (persisted) => persisted as Partial<OnboardingState>,
  },
)
```
- **Why this scales/lasts:** Explicit persisted schemas prevent stale local data from corrupting new app versions and reduce accidental local retention of sensitive user content.

### [STATE-SUPA-005] Many components subscribe to whole Zustand stores instead of selectors — 🟡 MEDIUM
- **File:** `src/stores/orchestrationStore.ts:392-400`; observed consumers include `src/App.tsx:38-42`, `src/pages/ProjectHomePage.tsx:31`, `src/pages/ExecutePage.tsx:25`, `src/components/superagent/SuperAgentInterface.tsx:216`, `src/components/interests/InterestsWidget.tsx:51`, `src/components/chrome/TabBar.tsx:8`
- **Current code:**
```ts
export const selectGraphState = (state: OrchestrationStoreState) => state.graphState;
export const selectWorkflowState = (state: OrchestrationStoreState) => state.workflowState;
export const selectSwarmState = (state: OrchestrationStoreState) => state.swarmState;
export const selectActiveAgents = (state: OrchestrationStoreState) => state.activeAgentIds;
export const selectStreamingData = (state: OrchestrationStoreState) => state.agentStreamingData;
```
```ts
const { graphNodes, workflowTasks, swarmNodes } = useOrchestrationStore()
```
- **What's wrong:** Some stores export selectors, but many consumers call `useStore()` and destructure the whole state. Whole-state subscriptions re-render on any store update, which is especially costly for `projectsStore`, `taskStore`, `buildStore`, `searchStore`, and streaming orchestration state.
- **SDK citation:** Zustand's `useShallow` docs show that selectors returning derived objects/arrays can re-render unnecessarily, and recommend `useShallow` from `zustand/react/shallow` to optimize re-renders. Source: https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md.
- **Required fix:** Export and use narrow selectors for every high-traffic store. Use `useShallow` for multi-field object/array picks.
- **Fixed code:**
```ts
import { useShallow } from 'zustand/react/shallow'

const { graphNodes, workflowTasks, swarmNodes } = useOrchestrationStore(
  useShallow((state) => ({
    graphNodes: state.graphNodes,
    workflowTasks: state.workflowTasks,
    swarmNodes: state.swarmNodes,
  })),
)
```
- **Why this scales/lasts:** Streaming, drag/drop, and task updates can grow quickly; narrow subscriptions keep unrelated UI from re-rendering on every state change.

### [STATE-SUPA-006] `projectsStore` performs broad child-table reads and relies on RLS as the only data filter — 🟠 HIGH
- **File:** `src/stores/projectsStore.ts:529-536`
- **Current code:**
```ts
const [projectsRes, issuesRes, linksRes, activityRes] = await Promise.all([
  shouldQueryTable('projects')
    ? supabase.from('projects').select('*').eq('user_id', user.id)
    : Promise.resolve(null),
  shouldQueryTable('issues') ? supabase.from('issues').select('*') : Promise.resolve(null),
  shouldQueryTable('issue_links') ? supabase.from('issue_links').select('*') : Promise.resolve(null),
  shouldQueryTable('activity_log') ? supabase.from('activity_log').select('*') : Promise.resolve(null),
])
```
- **What's wrong:** `projects` is scoped by `user_id`, but `issues`, `issue_links`, and `activity_log` select all rows visible to the JWT and rely solely on RLS to filter. RLS is mandatory and should remain enabled, but client-side queries should still scope by project IDs for performance, predictability, and least data returned.
- **SDK citation:** Supabase RLS docs state RLS is required for exposed schemas and works as defense in depth; they also explain policies are effectively added as `WHERE` clauses. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx.
- **Required fix:** Load projects first, then query child tables with project filters (`in('project_id', ids)`), link filters based on visible issue IDs, and activity filters based on visible project IDs. Keep RLS policies as the authoritative server-side guard.
- **Fixed code:**
```ts
const { data: projectRows, error: projectsError } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', user.id)

const projectIds = (projectRows ?? []).map((project) => project.id)
const [{ data: issueRows }, { data: activityRows }] = await Promise.all([
  projectIds.length
    ? supabase.from('issues').select('*').in('project_id', projectIds)
    : Promise.resolve({ data: [] }),
  projectIds.length
    ? supabase.from('activity_log').select('*').in('project_id', projectIds)
    : Promise.resolve({ data: [] }),
])
```
- **Why this scales/lasts:** RLS remains the security boundary, while scoped queries reduce response sizes and make multi-tenant behavior easier to reason about.

### [STATE-SUPA-007] `projectsStore` writes are fire-and-forget, so UI reports success before Supabase confirms persistence — 🟡 MEDIUM
- **File:** `src/stores/projectsStore.ts:637-645`, `708-716`, `779-787`, `849-857`, `929-937`, `980-988`, `1040-1048`, `1058-1066`, `1097-1105`
- **Current code:**
```ts
supabase.from('projects').upsert(row, { onConflict: 'id' }).then(({ error }) => {
  if (error) {
    if (!handleTableError('projects', error)) {
      console.error('Failed to sync project:', error)
    }
  } else {
    markTableAvailable('projects')
  }
})
```
- **What's wrong:** Store actions mutate local state and return success immediately. If Supabase rejects the write because of RLS, schema drift, network failure, or validation, the caller cannot know or roll back. This is not a missing `await` bug in syntax, but it is a persistence correctness bug.
- **SDK citation:** Supabase JavaScript query methods are Promise-returning APIs that resolve with `{ data, error }`; the client types expose `PostgrestError` and query result helpers for handling results. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts.
- **Required fix:** Make Supabase-backed write actions async or return a sync optimistic result plus an explicit `syncPromise`. Surface errors in store state and roll back or mark unsynced items.
- **Fixed code:**
```ts
createProject: async (input) => {
  // optimistic local insert...
  const { error } = await supabase.from('projects').upsert(row, { onConflict: 'id' })
  if (error) {
    set({ /* mark project unsynced or rollback */ })
    return { project: newProject, error: error.message }
  }
  return { project: newProject }
}
```
- **Why this scales/lasts:** Sync state becomes observable and recoverable instead of silently diverging between localStorage and Supabase.

### [STATE-SUPA-008] `authStore` keeps a module-level auth subscription with no exported cleanup path — 🟡 MEDIUM
- **File:** `src/stores/authStore.ts:89-90`, `150-156`, `666-672`; `src/api/supabase.ts:86-92`
- **Current code:**
```ts
let authSubscription: { unsubscribe: () => void } | null = null
let initializePromise: Promise<void> | null = null
```
```ts
authSubscription = onAuthStateChange((event, session) => {
  get().handleAuthStateChange(event, session)
})
```
```ts
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useAuthStore.getState().initialize()
  }, 0)
}
```
- **What's wrong:** The code guards against duplicate listeners by unsubscribing before re-subscribing, but there is no public cleanup/dispose path for app teardown, tests, or hot-module replacement. The module auto-initializes on import, so importing the store has side effects and starts auth IO.
- **SDK citation:** Supabase's `onAuthStateChange` returns a subscription with `unsubscribe`, as represented in this repository's wrapper and SDK usage. Source for auth option/session lifecycle context: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts and https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx.
- **Required fix:** Export a `disposeAuthStore` or include an action that unsubscribes and clears `authSubscription`; call it from app teardown/HMR/test cleanup. Prefer initializing from `App` effect instead of module import side effect.
- **Fixed code:**
```ts
export function disposeAuthStore() {
  authSubscription?.unsubscribe()
  authSubscription = null
  initializePromise = null
}
```
- **Why this scales/lasts:** Auth listeners remain deterministic under HMR, tests, and future multi-window Electron scenarios.

### [STATE-SUPA-009] Migration `001` and `003` define incompatible `projects` shapes — 🟠 HIGH
- **File:** `supabase/migrations/001_add_projects.sql:3-18`; `supabase/migrations/003_projects_work_management.sql:6-38`; `src/stores/projectsStore.ts:623-636`
- **Current code:**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  project_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```
```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid references auth.users(id),
  key text not null,
  name text not null,
  type text not null,
  summary text,
  settings jsonb not null default '{"allowCrossProjectParents": false}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
```
```ts
const row = {
  id: newProject.id,
  user_id: user.id,
  owner_id: newProject.ownerId || user.id,
  key: newProject.key,
  project_key: newProject.key,
  name: newProject.name,
  type: newProject.type,
  summary: newProject.summary,
  description: newProject.summary,
  settings: newProject.settings,
  created_at: new Date(newProject.createdAt).toISOString(),
  updated_at: new Date(newProject.updatedAt).toISOString(),
}
```
- **What's wrong:** Migration `001` creates `projects` with `project_key` and no `type/settings/owner_id/key`. Migration `003` uses `create table if not exists`, so on a database where `001` already ran it will not recreate the table with the new constraints; it then adds columns but does not make `key`, `type`, or `user_id` non-null if legacy rows exist. The client writes both `key` and legacy `project_key`, which is a compatibility workaround but also confirms schema drift.
- **SDK citation:** Supabase RLS docs emphasize raw SQL-created tables must explicitly enable RLS and grant only needed permissions; migrations should leave exposed-schema tables in a consistent policy-protected state. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx.
- **Required fix:** Add a corrective migration that normalizes `public.projects`: backfill `key/type/settings/owner_id`, add `not null` constraints only after backfill, reconcile `project_key` vs `key`, and replace duplicate/conflicting policies idempotently.
- **Fixed code:**
```sql
alter table public.projects add column if not exists key text;
update public.projects set key = coalesce(key, project_key) where key is null;
alter table public.projects alter column key set not null;
alter table public.projects add column if not exists type text;
update public.projects set type = 'software-development' where type is null;
alter table public.projects alter column type set not null;
```
- **Why this scales/lasts:** A single canonical project schema removes client compatibility hacks and prevents migration order from changing runtime behavior.

### [STATE-SUPA-010] Migration `001` alters `tasks` but task table RLS is UNVERIFIED in audited migrations — 🟠 HIGH
- **File:** `supabase/migrations/001_add_projects.sql:21-23`; `src/stores/taskStore.ts:194-417`
- **Current code:**
```sql
-- Extend tasks table
ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
```
```ts
export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: sampleTasks,
  // local-only task actions...
}))
```
- **What's wrong:** The audited migrations do not create `tasks`, enable RLS on `tasks`, or add task policies. If `tasks` is in the exposed `public` schema from an earlier unscoped migration, `001` extends it without verifying row-level security. If it does not exist, `001` fails at apply time. Because `taskStore` is currently local-only, this may be dead schema; status is UNVERIFIED.
- **SDK citation:** Supabase RLS docs: “RLS must always be enabled on any tables stored in an exposed schema. By default, this is the `public` schema.” They also state raw SQL-created tables need manual `alter table ... enable row level security`. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx.
- **Required fix:** Either remove/replace the legacy `tasks` alteration, or add a migration that creates/verifies `public.tasks`, enables RLS, and adds policies keyed by owner/project access.
- **Fixed code:**
```sql
alter table if exists public.tasks enable row level security;
create policy "Tasks readable by owner"
  on public.tasks for select
  using (auth.uid() is not null and user_id = auth.uid());
```
- **Why this scales/lasts:** Every exposed table has an auditable access model and migrations do not fail depending on undocumented pre-existing schema.

### [STATE-SUPA-011] RLS policies mostly omit explicit `auth.uid() is not null` guards — 🟡 MEDIUM
- **File:** `supabase/migrations/001_add_projects.sql:15-17`; `002_create_users_and_preferences.sql:37-61`; `003_projects_work_management.sql:117-309`; `005_interests_onboarding_conversations.sql:97-297`
- **Current code:**
```sql
create policy "Users read own profile"
  on public.users for select
  using (auth.uid() = id);
```
```sql
create policy "Interests select own" on public.interests
  for select using (user_id = auth.uid());
```
- **What's wrong:** These policies are generally safe because `null = id` evaluates false, but Supabase docs recommend explicitly checking authentication to make policy intent clear and avoid confusion. Some policies already use `auth.uid() is not null` for global lookup tables in `004`; owner-specific policies should follow the same clarity.
- **SDK citation:** Supabase RLS docs caution that `auth.uid()` returns `null` when unauthenticated and recommend `USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)`. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx.
- **Required fix:** Update owner policies to include `auth.uid() is not null` in `using` and `with check` expressions.
- **Fixed code:**
```sql
create policy "Users read own profile"
  on public.users for select
  using (auth.uid() is not null and auth.uid() = id);
```
- **Why this scales/lasts:** Policy intent remains obvious during future edits and avoids accidental permissive rewrites.

### [STATE-SUPA-012] Global lookup tables in migration `004` are read-only to clients but not documented as service-managed — 🟢 LOW
- **File:** `supabase/migrations/004_project_type_schemes.sql:38-49`, `98-135`
- **Current code:**
```sql
alter table public.project_type_schemes enable row level security;
alter table public.issue_types enable row level security;

create policy "Project type schemes readable by authenticated"
  on public.project_type_schemes for select
  using (auth.uid() is not null);

create policy "Issue types readable by authenticated"
  on public.issue_types for select
  using (auth.uid() is not null);
```
- **What's wrong:** This is probably intentional: app users can read seeded type metadata and cannot mutate it. The migrations do not explicitly document that inserts/updates happen only through migrations/service role. Marked LOW/UNVERIFIED because it is not an SDK violation if service-managed.
- **SDK citation:** Supabase RLS docs say once RLS is enabled, no data is accessible via the API with a publishable key until policies are created, and grants/policies should provide only needed permissions. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx.
- **Required fix:** Add a comment or migration note that `project_type_schemes` and `issue_types` are migration-managed reference tables. If client mutation is required later, add explicit insert/update policies.
- **Fixed code:**
```sql
-- Reference data is migration/service-role managed. Clients may only read.
```
- **Why this scales/lasts:** Future contributors will not accidentally add broad write policies to reference data.

### [STATE-SUPA-013] Supabase helper `db` exposes tables not currently used by stores and without typed Database schema — 🟡 MEDIUM
- **File:** `src/api/supabase.ts:57-73`, `165-173`
- **Current code:**
```ts
let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const config = getSupabaseConfig()
    supabaseInstance = createClient(config.url, config.anonKey, config.options)
  }
  return supabaseInstance
}
```
```ts
export const db = {
  users: () => supabase.from('users'),
  userPreferences: () => supabase.from('user_preferences'),
  interests: () => supabase.from('interests'),
  interestConnections: () => supabase.from('interest_connections'),
  onboardingAnswers: () => supabase.from('onboarding_answers'),
  conversations: () => supabase.from('conversations'),
  messages: () => supabase.from('messages'),
}
```
- **What's wrong:** The client is untyped (`SupabaseClient` without a generated `Database` type), so `.from()` calls are stringly typed and row shapes in stores use `any`/`Record<string, unknown>`. The `db` helper exposes tables that are not actually synced by the audited stores (`interests`, `interest_connections`, `onboarding_answers`, `conversations`, `messages`), making it easy to add untyped queries later.
- **SDK citation:** Supabase JavaScript exposes generic `SupabaseClientOptions` and query result helper types for typed clients. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts.
- **Required fix:** Generate and import a `Database` type from Supabase and instantiate `createClient<Database>()`. Keep table helpers typed or remove unused helper entries until implemented.
- **Fixed code:**
```ts
import type { Database } from '@/types/supabase'

let supabaseInstance: SupabaseClient<Database> | null = null
supabaseInstance = createClient<Database>(config.url, config.anonKey, config.options)
```
- **Why this scales/lasts:** Query/insert/update payloads fail at compile time when migrations and app code drift.

### [STATE-SUPA-014] `AgentUiContext` fetches an access token from local session state and sends it to a non-Supabase backend — 🟡 MEDIUM
- **File:** `src/context/AgentUiContext.tsx:120-136`; `src/api/supabase.ts:98-108`
- **Current code:**
```ts
const token = await getAccessToken()
```
```ts
const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.agent.chat}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({
    message: prompt,
    session_id: `askron-${Date.now()}`,
  }),
})
```
- **What's wrong:** `getAccessToken()` reads `getSession()`, which in the current client is backed by renderer storage. The context then forwards the JWT to the agent API. This may be intended, but it makes secure Supabase storage even more important and should validate the backend origin and token audience. Marked MEDIUM because no leak is visible in this file, but the token source is compromised by [STATE-SUPA-001].
- **SDK citation:** Supabase sessions are represented by an access token JWT and refresh token; access tokens are short-lived and client libraries refresh sessions. Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx.
- **Required fix:** After fixing session storage, route token access through the secure adapter and centralize authenticated backend fetches so only allowed origins receive Supabase JWTs.
- **Fixed code:**
```ts
const response = await authenticatedApiFetch(API_ENDPOINTS.agent.chat, {
  method: 'POST',
  body: JSON.stringify({ message: prompt, session_id }),
})
```
- **Why this scales/lasts:** Access tokens are not scattered across UI code and can be audited in one transport layer.

### [STATE-SUPA-015] Realtime and Supabase Storage are absent in audited scope — 🟢 LOW / VERIFIED
- **File:** `src/api/supabase.ts:1-198`; `src/stores/**/*.ts`; `src/context/AgentUiContext.tsx`; `supabase/migrations/*.sql`
- **Current code:**
```ts
export const db = {
  users: () => supabase.from('users'),
  // table helpers only
}
```
- **What's wrong:** No `.channel()` realtime subscription or `supabase.storage` usage was found in the audited files. Therefore there are no realtime cleanup or signed URL/bucket policy findings in this scope.
- **SDK citation:** Supabase client options include `realtime` and `storage` option namespaces, but this code does not use them. Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts.
- **Required fix:** None now. If realtime or storage is added later, require explicit subscription cleanup and bucket/RLS policy audit.
- **Fixed code:**
```ts
// No change required in current audited scope.
```
- **Why this scales/lasts:** Recording the absence avoids false-positive cleanup work and defines the future audit trigger.

## Per-File Notes

- `authStore.ts`: Curried Zustand pattern is compliant. Persisted auth state is too trusting of localStorage-derived auth; Supabase queries handle missing tables but duplicate token persistence is critical.
- `buildStore.ts`: Curried pattern and `persist` with `version: 4`/`migrate` are good. `partialize` persists threads/sessions/projects only; no Supabase use.
- `interestDiscoveryStore.ts`: Non-curried `create<InterestDiscoveryState>(...)`; no persist or Supabase use.
- `interestsStore.ts`: Curried + persist with partialize; lacks version/migrate and persists profile interests locally. Local mutation of `newNodes` occurs before committing to Zustand state, so no direct state mutation issue found.
- `navigationStore.ts`: Curried + persist with version/migrate; compliant.
- `onboardingStore.ts`: Curried + persist, but no partialize/version/migrate; persists all answers/reasoning/system prompt.
- `orchestrationStore.ts`: Non-curried. Uses immutable updates and clones `Map` before changes; no persist. Exported selectors exist.
- `orchestrationSync.ts`: Pure mapping helpers; no Zustand store creation, persist, Supabase, realtime, or storage.
- `previewStore.ts`: Curried with `subscribeWithSelector`; no persist/Supabase. Selector exports present.
- `projectsStore.ts`: Curried + persist, but no version/migrate; Supabase queries and writes need tighter scoping/error propagation.
- `searchStore.ts`: Non-curried; no persist/Supabase. Uses timers that should be managed by consumers if searches unmount mid-transition (cleanup outside audited store not verified).
- `tabStore.ts`: Curried + persist with partialize; no version/migrate. `setTabs` active fallback expression cannot find an active tab when `activeTabId` is omitted because it checks against `undefined`; not SDK-related.
- `taskStore.ts`: Non-curried; local-only and exposes `window.ronApp.taskStore`. No persist/Supabase.
- `userPreferencesStore.ts`: Curried + persist with `onRehydrateStorage`; no version/migrate. Writes a separate `theme` localStorage key outside persist.
- `src/api/supabase.ts`: Singleton pattern is OK, but auth options are incomplete for Electron secure storage/OAuth PKCE and client is untyped.
- `src/context/AgentUiContext.tsx`: React context state is memoized; Supabase concern is token retrieval/forwarding.
- `supabase/migrations`: Most tables enable RLS. `001`/`003` project schema drift and `tasks` RLS status need correction.

## Cleanup Items

1. Convert `searchStore`, `taskStore`, `interestDiscoveryStore`, and `orchestrationStore` to `create<T>()(...)`.
2. Replace Supabase default auth storage with an Electron secure storage adapter and remove duplicated token persistence paths.
3. Implement Electron OAuth with PKCE, `skipBrowserRedirect`, external auth window/session, and deep-link callback exchange.
4. Add persist `version`/`migrate` and explicit `partialize` to persisted stores that store user-generated data.
5. Scope project child-table queries by visible project/issue IDs in addition to RLS.
6. Convert Supabase writes in `projectsStore` to awaitable actions with caller-visible errors or sync state.
7. Add a corrective migration for `projects` schema drift and verify or remove legacy `tasks` schema changes.
8. Generate Supabase `Database` types and use `createClient<Database>()`.
9. Replace whole-store subscriptions in high-traffic consumers with selectors and `useShallow`.

## Sources & Citations

- Zustand Advanced TypeScript guide (`create<T>()(...)`, middleware TypeScript): https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/advanced-typescript.md
- Zustand persist integration (`name`, default localStorage, `storage`, `partialize`, `version`, `migrate`, hydration): https://github.com/pmndrs/zustand/blob/main/docs/reference/integrations/persisting-store-data.md
- Zustand `useShallow` hook (`zustand/react/shallow`, selector memoization): https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md
- Supabase client auth option types (`autoRefreshToken`, `persistSession`, `detectSessionInUrl`, `storage`, `flowType`): https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/lib/types.ts
- Supabase Auth option types (`skipBrowserRedirect`): https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts
- Supabase Auth sessions (access token, refresh token, refresh lifecycle): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/sessions.mdx
- Supabase native deep linking / OAuth example (`redirectTo`, `skipBrowserRedirect`, callback session creation): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/native-mobile-deep-linking.mdx
- Supabase Row Level Security guide (`enable row level security`, policies, `auth.uid()` null caution): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx
