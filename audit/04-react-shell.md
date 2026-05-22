# Zone 4: React 19 Application Shell / Routing / Hooks SDK Compliance Audit
**SDKs:** react@^19.2.3, react-dom@^19.2.3, @types/react@^19.2.7, typescript@^5.9.3 | **Audited:** 2026-05-22 | **Scope:** `src/main.tsx`, `src/App.tsx`, `src/pages/**`, `src/layouts/**`, `src/hooks/**`, `src/types/**`, `src/utils/**`, `src/lib/**`, `src/index.css`, `src/vite-env.d.ts`, `index.html`; context usage also checked in `src/context/AgentUiContext.tsx` because the requested checklist explicitly calls it out.

## Executive Summary

The React root is modern and compliant: `src/main.tsx` uses one `createRoot()` call and wraps `<App />` in `React.StrictMode`; no `ReactDOM.render` usage was found in the audited scope. The main compliance risks are not legacy React APIs; they are effect lifecycle correctness, route/auth hydration, and TypeScript type escapes. Several effects start external work (`fetch` streams, timeouts, intervals, and a voice-agent subprocess) without symmetrical cleanup, which is especially visible under StrictMode's setup/cleanup stress test. App routing reads persisted auth/onboarding booleans directly and never gates on auth initialization or persist hydration, so initial renders can route to the wrong shell. React 19 form Actions are not required everywhere, but the sign-in/onboarding forms are still fully manual and should be considered for `useActionState`/`useFormStatus` when refactored. HTML lacks an Electron renderer CSP, and global font loading is duplicated through both HTML and CSS.

## Severity Legend

- 🔴 CRITICAL: likely runtime leak, stale async update, security boundary gap, or incorrect auth route state
- 🟠 HIGH: SDK best-practice mismatch that can become production-impacting
- 🟡 MEDIUM: type-safety, cleanup, maintainability, or scalability issue
- 🟢 LOW: modernization or cleanup item; safe but should be tracked

## Audit Coverage Matrix

| Area | Files/lines reviewed | Result |
| --- | --- | --- |
| React root | `src/main.tsx:1-10` | ✅ single `createRoot`; ✅ `StrictMode`; ✅ no deprecated `ReactDOM.render` |
| App routing shell | `src/App.tsx:1-255` | 🟠 auth/onboarding hydration race; no route-level error boundary/Suspense around async-heavy routes |
| Layouts | `src/layouts/AuthPageLayout.tsx:1-197`, `src/layouts/BrowserLayout.tsx:1-145` | Mostly compliant cleanup; BrowserLayout context provider is memoized through `AgentUiContext`; no hook-rule violations |
| Hooks | `src/hooks/useTheme.ts:1-71`, `src/hooks/useVoiceAgent.ts:1-190` | `useTheme` is acceptable DOM synchronization; `useVoiceAgent` leaks subprocess ownership on unmount and uses `any` |
| Pages | All files in `src/pages/**` | No conditional/loop hook calls found; timeout/interval/fetch cleanup issues; several `any` type escapes |
| Types/utils/lib | `src/types/**`, `src/pages/types/**`, `src/utils/**`, `src/lib/**`, `src/vite-env.d.ts` | Many type files are clean; utilities contain broad `any` and unsafe assertions |
| Context | `src/context/AgentUiContext.tsx:1-262` | Value is memoized; no hook-rule violation; React 19 `<Context>` provider modernization available |
| CSS/HTML | `src/index.css:1-703`, `index.html:1-17` | Tailwind directives present; Electron CSP missing; duplicate external font loading |

## Findings

### [REACT-SHELL-001] App routing uses persisted auth/onboarding booleans before auth initialization or store hydration — 🟠 HIGH
- **File:** `src/App.tsx:36-40`, `src/App.tsx:198-210`; corroborating store state in `src/stores/authStore.ts:21-23`, `src/stores/authStore.ts:143-160`, `src/stores/onboardingStore.ts:57-65`
- **Current code:**
```tsx
const { isAuthenticated } = useAuthStore()
const { isComplete } = useOnboardingStore()

if (!isAuthenticated) {
  return (
    <AuthPageLayout>
      <SignInPage />
    </AuthPageLayout>
  )
}

if (!isComplete) {
  return <OnboardingPage />
}
```
- **What's wrong:** `authStore` exposes `isLoading` and `isInitialized`, and the persisted stores can rehydrate asynchronously, but `App` never calls or waits on auth initialization and never gates on Zustand persist hydration. The first render can show `SignInPage` or `OnboardingPage` using stale defaults before Supabase/session restoration finishes, then flip routes. That creates auth-gating races, route flicker, and possible side effects from the wrong page tree mounting under StrictMode.
- **SDK citation:** React's `useEffect` docs state that Effects are for synchronizing with external systems, and React can run setup/cleanup more than once in development StrictMode; routing should not depend on external session state without an explicit loading/initialized branch. Source: https://react.dev/reference/react/useEffect. React StrictMode docs state that StrictMode enables extra development-only checks including re-rendering and re-running Effects to find bugs. Source: https://react.dev/reference/react/StrictMode.
- **Required fix:** Initialize auth once at shell startup; render a neutral loading shell until auth is initialized and the persisted onboarding/auth stores have hydrated. Subscribe to `persist.onFinishHydration` or equivalent store flags if the app continues to persist route-critical booleans.
- **Fixed code:**
```tsx
export function App() {
  const { isAuthenticated, isInitialized, isLoading, initialize } = useAuthStore()
  const { isComplete } = useOnboardingStore()
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    void initialize()
    const updateHydration = () => {
      setHasHydrated(
        useAuthStore.persist.hasHydrated() && useOnboardingStore.persist.hasHydrated(),
      )
    }
    updateHydration()
    const offAuth = useAuthStore.persist.onFinishHydration(updateHydration)
    const offOnboarding = useOnboardingStore.persist.onFinishHydration(updateHydration)
    return () => {
      offAuth()
      offOnboarding()
    }
  }, [initialize])

  if (!hasHydrated || isLoading || !isInitialized) return <AppLoadingScreen />
  if (!isAuthenticated) return <AuthPageLayout><SignInPage /></AuthPageLayout>
  if (!isComplete) return <OnboardingPage />
  return <BrowserLayout>{/* ... */}</BrowserLayout>
}
```
- **Why this scales:** Route decisions come from one initialized session state, not a transient persisted snapshot; future auth providers and onboarding migrations cannot accidentally mount the wrong page tree.

### [REACT-SHELL-002] Search streaming effect has no abort/reader cleanup and omits a reactive dependency — 🔴 CRITICAL
- **File:** `src/pages/SearchResultsPage.tsx:285-307`, `src/pages/SearchResultsPage.tsx:323-560`
- **Current code:**
```tsx
const upsertToolExecution = useCallback((toolCallId: string, update: Partial<ToolExecution>) => {
  setToolExecutions((prev) => { /* ... */ })
}, [])

useEffect(() => {
  if (!searchQuery) return
  const fetchResults = async () => {
    const response = await fetch('http://localhost:8765/agents/search/stream', { /* ... */ })
    const reader = response.body?.getReader()
    // long async read loop with setState calls
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      // setAnswerText, setReasoningText, setCitations, setSearchResponse, etc.
    }
  }
  fetchResults()
}, [searchQuery])
```
- **What's wrong:** The effect starts a long-lived network stream but returns no cleanup. If `searchQuery` changes or the page unmounts, the old stream can continue reading and calling `setState`; earlier and later searches can race. `upsertToolExecution` is referenced inside the effect but not listed in dependencies; today it is stable, but the effect is no longer locally correct if the callback changes.
- **SDK citation:** React's `useEffect` reference says the setup function may return a cleanup function; React runs cleanup before the next setup and after unmount. It also states that dependencies must include every reactive value referenced from the setup code. Source: https://react.dev/reference/react/useEffect. React's data-fetching Effect example uses an `ignore` flag in cleanup so stale responses do not update state. Source: https://react.dev/reference/react/useEffect#fetching-data-with-effects.
- **Required fix:** Create an `AbortController`, pass `signal` to `fetch`, cancel/release the reader, guard stale updates, and include `upsertToolExecution` in the dependency array. If adopting React 19 Suspense later, lift the stream into a cache/resource with an abortable lifecycle.
- **Fixed code:**
```tsx
useEffect(() => {
  if (!searchQuery) return

  const controller = new AbortController()
  let ignore = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  async function fetchResults() {
    try {
      const response = await fetch('http://localhost:8765/agents/search/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ message: searchQuery, session_id: 'search-page' }),
      })
      reader = response.body?.getReader()
      while (reader && !ignore) {
        const { done, value } = await reader.read()
        if (done || ignore) break
        // parse chunk; before each state write, check !ignore
      }
    } catch (error) {
      if (!ignore && !(error instanceof DOMException && error.name === 'AbortError')) {
        setError(error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  void fetchResults()
  return () => {
    ignore = true
    controller.abort()
    void reader?.cancel()
  }
}, [searchQuery, upsertToolExecution])
```
- **Why this scales:** Only the current query owns the stream; StrictMode cleanup proves the stream can be torn down; future callback refactors cannot silently create stale closures.

### [REACT-SHELL-003] Home page interval cleanup is unreachable, leaking timers after unmount — 🔴 CRITICAL
- **File:** `src/pages/HomePage.tsx:380-393`
- **Current code:**
```tsx
useEffect(() => {
  const baseInterval = 15000
  const timers = TOPIC_GROUPS.map((_, i) => {
    const timeout = setTimeout(() => {
      cycleCard(i)
      const interval = setInterval(() => cycleCard(i), 90000)
      return () => clearInterval(interval)
    }, initialDelay)
    return timeout
  })
  return () => timers.forEach(clearTimeout)
}, [cycleCard])
```
- **What's wrong:** Returning a function from inside the `setTimeout` callback does nothing; React never receives that cleanup. After each timeout fires, its interval persists until page reload, even if `HomePage` unmounts.
- **SDK citation:** React's `useEffect` docs define cleanup as the function returned from the Effect setup itself, not from nested timer callbacks. Source: https://react.dev/reference/react/useEffect.
- **Required fix:** Store interval IDs in the effect scope and clear both pending timeouts and created intervals in the effect's returned cleanup.
- **Fixed code:**
```tsx
useEffect(() => {
  const intervals: ReturnType<typeof setInterval>[] = []
  const timers = TOPIC_GROUPS.map((_, i) => {
    const timeout = setTimeout(() => {
      cycleCard(i)
      intervals.push(setInterval(() => cycleCard(i), 90000))
    }, i * 15000)
    return timeout
  })

  return () => {
    timers.forEach(clearTimeout)
    intervals.forEach(clearInterval)
  }
}, [cycleCard])
```
- **Why this scales:** Every timer created by the component is owned by the effect and is released during route changes, test remounts, and StrictMode cleanup.

### [REACT-SHELL-004] Onboarding timeouts update store after unmount and are not StrictMode-safe — 🟠 HIGH
- **File:** `src/pages/OnboardingPage.tsx:27-31`, `src/pages/OnboardingPage.tsx:45-65`
- **Current code:**
```tsx
useEffect(() => {
  if (currentStep === 'interview') {
    setTimeout(() => inputRef.current?.focus(), 500)
  }
}, [currentStep, currentQuestionIndex])

useEffect(() => {
  if (currentStep === 'reasoning') {
    steps.forEach((step, index) => {
      delay += 1500
      setTimeout(() => {
        addReasoningStep(step.type, step.content)
        if (index === steps.length - 1) {
          setTimeout(completeOnboarding, 1000)
        }
      }, delay)
    })
  }
}, [currentStep, addReasoningStep, completeOnboarding])
```
- **What's wrong:** Both effects create timers without cleanup. The reasoning effect mutates persisted onboarding state after unmount and can duplicate steps under StrictMode remounts or fast navigation.
- **SDK citation:** React StrictMode intentionally re-runs Effects in development to find missing cleanup. Source: https://react.dev/reference/react/StrictMode. React `useEffect` cleanup should stop synchronizing with external systems such as timers. Source: https://react.dev/reference/react/useEffect.
- **Required fix:** Track timeout IDs and clear them in cleanup. For the reasoning effect, also ensure duplicate steps are not appended if the effect is re-entered for the same onboarding run.
- **Fixed code:**
```tsx
useEffect(() => {
  if (currentStep !== 'interview') return
  const focusTimer = setTimeout(() => inputRef.current?.focus(), 500)
  return () => clearTimeout(focusTimer)
}, [currentStep, currentQuestionIndex])

useEffect(() => {
  if (currentStep !== 'reasoning') return
  const timeoutIds: ReturnType<typeof setTimeout>[] = []
  let delay = 0
  steps.forEach((step, index) => {
    delay += 1500
    timeoutIds.push(setTimeout(() => {
      addReasoningStep(step.type, step.content)
      if (index === steps.length - 1) {
        timeoutIds.push(setTimeout(completeOnboarding, 1000))
      }
    }, delay))
  })
  return () => timeoutIds.forEach(clearTimeout)
}, [currentStep, addReasoningStep, completeOnboarding])
```
- **Why this scales:** Onboarding can be interrupted, retried, or remounted without duplicate persisted reasoning steps or delayed completions from abandoned sessions.

### [REACT-SHELL-005] Voice-agent hook removes listeners but intentionally leaves the external subprocess running on unmount — 🔴 CRITICAL
- **File:** `src/hooks/useVoiceAgent.ts:49-107`, `src/hooks/useVoiceAgent.ts:110-179`
- **Current code:**
```tsx
// Start/stop when enabled toggles (no unmount stop to avoid StrictMode churn)
useEffect(() => {
  if (!window.electron?.voiceAgent) return
  if (!enabled) {
    if (startedRef.current) stop()
    return
  }
  if (!startedRef.current) {
    start()
  }
}, [enabled, start, stop])

useEffect(() => {
  if (!enabled || !window.electron?.voiceAgent) return
  const removeEventListener = window.electron.voiceAgent.onEvent(/* ... */)
  // ... other listeners
  return () => {
    removeEventListener()
    removeOutputListener()
    removeErrorListener()
    removeStoppedListener()
  }
}, [enabled, onComplete, onError])
```
- **What's wrong:** The hook owns a Python voice-agent subprocess but does not stop it when the component unmounts while `enabled` is true. Listener cleanup alone can leave the external process recording/running without UI ownership. The comment explicitly works around StrictMode rather than making setup/cleanup symmetrical and idempotent.
- **SDK citation:** React's Effect guidance says Effects should synchronize with external systems and return cleanup to disconnect/stop that synchronization; StrictMode re-runs setup and cleanup to reveal cleanup bugs. Source: https://react.dev/reference/react/useEffect and https://react.dev/reference/react/StrictMode.
- **Required fix:** Make Electron `voiceAgent.start/stop` idempotent and return a cleanup from the lifecycle effect that stops the process if this hook started it. If StrictMode churn is a problem, debounce in the Electron/service layer or use a reference-counted owner token rather than omitting cleanup.
- **Fixed code:**
```tsx
useEffect(() => {
  if (!enabled || !window.electron?.voiceAgent) return
  let ownsProcess = false
  let cancelled = false

  const startPromise = (async () => {
    if (!startedRef.current) {
      await start()
      ownsProcess = startedRef.current
      if (cancelled && ownsProcess) await stop()
    }
  })()

  return () => {
    cancelled = true
    void startPromise.then(() => {
      if (ownsProcess || startedRef.current) void stop()
    })
  }
}, [enabled, start, stop])
```
- **Why this scales:** The hook lifecycle owns the external resource lifecycle; future route changes, StrictMode checks, and onboarding retries cannot orphan the subprocess.

### [REACT-SHELL-006] Broad `any` usage bypasses TypeScript 5.9/@types/react 19 safety — 🟡 MEDIUM
- **Files:** `src/hooks/useVoiceAgent.ts:60`; `src/vite-env.d.ts:17-18`; `src/pages/AIElementsShowcase.tsx:521`; `src/pages/ExecutePage.tsx:372`; `src/pages/HomePage.tsx:225-240`; `src/pages/SearchResultsPage.tsx:133`, `183`, `236`; `src/utils/search-tool-utils.ts:97`, `133-139`; `src/utils/tool-classifier.ts:266-267`, `334-353`, `416-445`, `494-495`, `546`, `706-708`, `830-843`; `src/stores/onboardingStore.ts:140` (store line included because page code calls it through onboarding flow)
- **Current code:**
```ts
const result = await window.electron.voiceAgent.start(apiKey) as any
export const InlineMath: ComponentType<{ math: string; [key: string]: any }>
function normalizeCitations(raw: any): Citation[] { /* ... */ }
function isRecord(value: unknown): value is Record<string, any> { /* ... */ }
```
- **What's wrong:** `any` erases the event/result/data contracts the React shell depends on. This is most dangerous at API boundaries (`window.electron.voiceAgent`, streamed search events, untyped JSON tool output, and component props) because invalid data can flow into JSX and effects without compiler narrowing.
- **SDK citation:** TypeScript's handbook describes `any` as an escape hatch that permits property access/calls without type checking. Source: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any. TypeScript 5.9 release notes are the target compiler baseline for this audit. Source: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html.
- **Required fix:** Replace `any` with `unknown` at data boundaries, then narrow with small type guards. For React component declarations, use explicit props based on React DOM attributes instead of an `any` index signature.
- **Fixed code:**
```ts
type VoiceAgentStartResult = { success: boolean; error?: string }
const result = await window.electron.voiceAgent.start(apiKey) as VoiceAgentStartResult

type KatexProps = { math: string } & Omit<React.HTMLAttributes<HTMLElement>, 'children'>
declare module 'react-katex' {
  import type { ComponentType } from 'react'
  export const InlineMath: ComponentType<KatexProps>
  export const BlockMath: ComponentType<KatexProps>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
```
- **Why this scales:** Typed boundaries make malformed Electron IPC, streamed JSON, and third-party component props fail at compile/narrowing points instead of deep inside React rendering.

### [REACT-SHELL-007] `fileToDataUrl` assumes FileReader result shape without runtime narrowing or abort path — 🟡 MEDIUM
- **File:** `src/utils/file-utils.ts:10-16`
- **Current code:**
```ts
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```
- **What's wrong:** `FileReader.result` is `string | ArrayBuffer | null`; the cast hides null/non-string cases. The Promise does not handle `onabort` and cannot be cancelled by callers using React cleanup.
- **SDK citation:** TypeScript type assertions do not add runtime validation; when using the React shell to start async browser APIs from effects/handlers, cleanup should be able to abort external work. React Effect cleanup source: https://react.dev/reference/react/useEffect. TypeScript handbook source for type assertions: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions.
- **Required fix:** Narrow `reader.result`, wire `onabort`, and optionally accept an `AbortSignal`.
- **Fixed code:**
```ts
export function fileToDataUrl(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    signal?.addEventListener('abort', abort, { once: true })
    reader.onload = () => {
      signal?.removeEventListener('abort', abort)
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new TypeError('Expected FileReader result to be a data URL string'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onabort = () => reject(new DOMException('File read aborted', 'AbortError'))
    reader.readAsDataURL(file)
  })
}
```
- **Why this scales:** File utilities become safe to call from React event flows and future Suspense/resources without hidden invalid casts.

### [REACT-SHELL-008] React 19 form Actions are not used for auth/onboarding submissions — 🟢 LOW
- **File:** `src/pages/SignInPage.tsx:48-55`, `src/pages/SignInPage.tsx:101-108`, `src/pages/OnboardingPage.tsx:34-42`, `src/pages/OnboardingPage.tsx:188`
- **Current code:**
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (isSignUp) {
    await signup(email, password, name)
  } else {
    await login(email, password)
  }
}

<motion.form onSubmit={handleSubmit} className="space-y-5">
```
- **What's wrong:** This is not invalid React, but it misses React 19's simplified form submission model. Pending/error state is split between local form state and Zustand auth store; submit buttons must manually consume `isLoading`. This is a modernization item, not a blocker.
- **SDK citation:** React 19 release notes introduce Actions for async transitions and forms, plus `useActionState` to access action result and pending state, and `useFormStatus` for child form submission status. Source: https://react.dev/blog/2024/12/05/react-19.
- **Required fix:** When refactoring auth/onboarding, move submit mutations into form Actions and use `useActionState`/`useFormStatus` for pending/error UI. Keep store actions as the underlying mutation implementation.
- **Fixed code:**
```tsx
const [formState, formAction, isPending] = useActionState(async (_prev, formData: FormData) => {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  await login(email, password)
  return { error: null }
}, { error: null })

<form action={formAction}>
  <SubmitButton />
</form>
```
- **Why this scales:** Form pending/error state is co-located with the mutation and child submit controls can subscribe without prop drilling.

### [REACT-SHELL-009] Context provider is memoized but still uses legacy `.Provider` spelling — 🟢 LOW
- **File:** `src/context/AgentUiContext.tsx:43`, `src/context/AgentUiContext.tsx:200-251`
- **Current code:**
```tsx
const AgentUiContext = createContext<AgentUiContextValue | null>(null)
const value = useMemo<AgentUiContextValue>(() => ({ /* all fields/actions */ }), [/* deps */])

return (
  <AgentUiContext.Provider value={value}>
    {children}
  </AgentUiContext.Provider>
)
```
- **What's wrong:** The value is correctly memoized and hook usage is valid. React 19 allows rendering the context object itself as a provider, so `.Provider` is no longer necessary. This is a modernization opportunity only.
- **SDK citation:** React 19 release notes introduce `<Context>` as a provider, allowing `<ThemeContext value={theme}>` instead of `<ThemeContext.Provider value={theme}>`. Source: https://react.dev/blog/2024/12/05/react-19.
- **Required fix:** Optional: change to the React 19 provider shorthand when the codebase is ready.
- **Fixed code:**
```tsx
return (
  <AgentUiContext value={value}>
    {children}
  </AgentUiContext>
)
```
- **Why this scales:** Aligns with React 19 idioms while keeping the already-good memoization behavior.

### [REACT-SHELL-010] Electron renderer HTML lacks a CSP and loads duplicate external font stylesheets — 🟠 HIGH
- **File:** `index.html:4-15`, `src/index.css:1-4`
- **Current code:**
```html
<meta charset="UTF-8" />
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ron Browser</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```
```css
@import url("https://fonts.googleapis.com/css2?family=Raleway:wght@100;200;300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap");
@source "../node_modules/streamdown/dist/*.js";
```
- **What's wrong:** There is no `<meta http-equiv="Content-Security-Policy">` in the Electron renderer HTML. Font loading is duplicated between HTML and CSS and depends on remote Google font stylesheets. The `@source` directive is Tailwind v4 syntax, but this project uses Tailwind 3.4.17; in Tailwind 3, content scanning belongs in `tailwind.config.ts`, where this project already has `content` configured.
- **SDK citation:** React 19 supports document metadata directly in components (`<title>`, `<meta>`, `<link>`), but security metadata for Electron's initial document still belongs in the loaded HTML shell. Source: https://react.dev/blog/2024/12/05/react-19. Electron's official security guide recommends setting a strong Content Security Policy and gives a minimum renderer meta tag example. Source: https://www.electronjs.org/docs/latest/tutorial/security#csp-meta-tag.
- **Required fix:** Add a restrictive CSP compatible with the renderer's real needs; remove duplicate remote font loading or bundle fonts locally; remove `@source` or migrate Tailwind intentionally to v4.
- **Fixed code:**
```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:8765 https://*.supabase.co;"
/>
```
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
- **Why this scales:** The renderer has a clear resource policy, builds do not depend on live font CDN CSS, and Tailwind content scanning remains centralized in the version-appropriate config.

### [REACT-SHELL-011] Route tree has no shell-level ErrorBoundary/Suspense for async-heavy pages — 🟡 MEDIUM
- **File:** `src/App.tsx:161-235`
- **Current code:**
```tsx
if (showSearchResultsDev || showFullResults || searchRouteQuery) {
  return (
    <BrowserLayout>
      <SearchAgentDisplay query={searchRouteQuery || searchQuery || "The Buffalo Bills"} sessionId="search-page" />
    </BrowserLayout>
  )
}
// other route branches return page trees directly
```
- **What's wrong:** Individual components may contain their own boundaries, but the app shell itself has no route-level error boundary or Suspense fallback around route branches. React 19's `use()`/Suspense support will make this more important as data moves into render-time resources. Today, a thrown render error in a route can unmount the whole shell.
- **SDK citation:** React's reference documents `<Suspense>` as the component for displaying a fallback while children load, and Error Boundaries are the React mechanism for catching render errors in a subtree. Source: https://react.dev/reference/react/Suspense and https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary.
- **Required fix:** Add a shell-level `ErrorBoundary` and Suspense fallback around route content; keep more specific boundaries inside complex widgets.
- **Fixed code:**
```tsx
function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<AppLoadingScreen />}>
        {children}
      </Suspense>
    </AppErrorBoundary>
  )
}
```
- **Why this scales:** New async routes can adopt Suspense/use() without reworking top-level routing, and one route crash does not destroy the entire Electron renderer.

## Cleanup Items

- 🟢 `src/main.tsx` is compliant. Optional hardening: avoid the non-null assertion by checking `document.getElementById('root')` and throwing a clear error if the HTML shell is malformed.
- 🟢 `src/hooks/useTheme.ts` correctly uses an Effect to synchronize the document class with an external DOM system. No derived-state Effect violation found.
- 🟢 `src/layouts/AuthPageLayout.tsx` and `src/layouts/BrowserLayout.tsx` attach context-menu/Electron listeners with cleanup. Keep this pattern for future shell listeners.
- 🟢 `src/pages/ProjectHomePage.tsx`, `src/pages/ProjectsIndexPage.tsx`, and most `src/pages/types/*.ts` are React-hook clean in the audited lines.
- 🟢 No `forwardRef` usages were found in the audited shell/page/hooks scope, so React 19 ref-as-prop migration is not currently applicable here.
- 🟢 No direct document metadata rendered in React routes was found. `index.html` has a static `<title>`; future dynamic titles can use React 19 metadata rendering directly.
- 🟢 No Hooks were found inside loops, conditions, or non-component utility functions in audited React files.

## Sources & Citations

> **Network verification note:** direct `web_fetch`/`curl` attempts to `react.dev` and `typescriptlang.org` failed in this environment due to DNS resolution (`No address associated with hostname`). I used `web_search` for live-document verification and cite the official URLs below; claims that could not be re-fetched directly are notated by their official source URL.

- React 19 release notes — Actions, `useActionState`, `useOptimistic`, `useFormStatus`, ref as prop, `<Context>` provider shorthand, and document metadata. https://react.dev/blog/2024/12/05/react-19. Quote used: React 19 introduces Actions for async transitions/forms and new hooks for pending/error/optimistic state; it also supports refs as props, document metadata, and `<Context>` as provider.
- `createRoot` reference. https://react.dev/reference/react-dom/client/createRoot. Quote used: “Only call `createRoot()` once for each element/container.”
- `StrictMode` reference. https://react.dev/reference/react/StrictMode. Quote used: StrictMode enables extra development-only checks including re-rendering and re-running Effects to find bugs caused by missing cleanup.
- `useEffect` reference. https://react.dev/reference/react/useEffect. Quote used: the setup function may return cleanup; React runs cleanup before the next setup and after unmount; all reactive values used by the Effect must be listed as dependencies.
- “You Might Not Need an Effect.” https://react.dev/learn/you-might-not-need-an-effect. Quote used: Effects are an escape hatch for synchronizing with external systems, not for deriving render state.
- Rules of Hooks. https://react.dev/reference/rules/rules-of-hooks. Quote used: “Don’t call Hooks inside loops, conditions, or nested functions.”
- Suspense reference. https://react.dev/reference/react/Suspense. Quote used: Suspense displays a fallback until children finish loading.
- Error Boundary reference. https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary. Quote used: class components can implement error boundary methods to catch rendering errors below them.
- TypeScript 5.9 release notes. https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html. Used as compiler baseline source.
- TypeScript handbook, `any` and type assertions. https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any and https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions. Quote used: `any` opts out of type checking; assertions do not add runtime checks.
- Electron security guide, CSP. https://www.electronjs.org/docs/latest/tutorial/security#csp-meta-tag. Quote used: Electron recommends setting a strong Content Security Policy for renderer pages, with a minimum meta tag that restricts script loading to self.
