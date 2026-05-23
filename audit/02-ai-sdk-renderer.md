# Zone 2: AI SDK / Renderer Audit
**SDKs:** ai@6, @ai-sdk/react@3, ai-elements@1.8, streamdown@1.6, rive@4 | **Audited:** 2026-05-22

## Executive Summary

Audited every file under `src/components/ai-elements/` (including the nested `theapp/` copy), every file under `src/components/voice-agent/`, `src/services/agentChatBridge.ts`, `src/api/client.ts`, `src/api/index.ts`, `src/api/sonar-reasoning-pro.ts`, and every `/src` importer of `ai`, `@ai-sdk/react`, `streamdown`, `ai-elements`, or `@rive-app/react-webgl2` found by grep.

The renderer is mostly migrated to AI SDK v6/v5-style `useChat` (`sendMessage`, `DefaultChatTransport`, `UIMessage.parts`) and does not directly import provider packages or AI SDK server functions (`streamText`, `generateText`, `generateObject`) in normal renderer chat components. The largest compliance risks are (1) one manual SSE parser that only partially implements the UI message stream protocol, (2) history hydration paths that flatten or drop non-text `UIMessage.parts`, and (3) local AI Elements copies missing current upstream Streamdown plugin wiring for code/math/mermaid/CJK rendering. Rive usage is broadly compliant: it uses `@rive-app/react-webgl2`, `useRive`, and `useStateMachineInput` without unmanaged Rive listeners.

Audited importer set from grep:

- `src/pages/SearchResultsPage.tsx`
- `src/components/superagent/SuperAgentInterface.tsx`
- `src/components/search-results/SearchAgentDisplay.tsx`
- `src/components/search-results/SearchLayout.tsx`
- `src/components/board/task-detail/editor/AskRonMenu.tsx`
- `src/components/board/task-detail/tabs/RonTab.tsx`
- `src/components/search-results/SearchLayout.old.tsx`
- `src/components/search-results/AgentFormationDiagram.tsx`
- `src/components/search-results/SearchChat.tsx`
- `src/components/agent-panel/AgentPanel.tsx`
- `src/components/ai-elements/**` files importing `ai`, `streamdown`, or `@rive-app/react-webgl2`

No `useCompletion`, `useObject`, `experimental_useObject`, AI SDK provider package imports, or AI SDK Core server-side generation imports were found in `/src` importer scope.

## Severity Legend
🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW

## Findings

### [Z2-001] Search results page manually parses only part of the AI SDK UI message stream protocol — 🟠 HIGH
- **File:** `src/pages/SearchResultsPage.tsx:338`
- **Current code:**
```tsx
const response = await fetch('http://localhost:8765/agents/search/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: searchQuery,
    session_id: 'search-page'
  })
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (reader) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n')

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      const parsed = JSON.parse(data)
      switch (parsed.type) {
        case 'text-delta':
        case 'reasoning-delta':
        case 'tool-input-available':
        case 'tool-output-available':
          // handled
      }
    }
  }
}
```
- **What's wrong:**
  - This is a custom client parser for the AI SDK UI data stream while neighboring components use `useChat` + `DefaultChatTransport`.
  - It does not buffer partial SSE frames across `reader.read()` boundaries; `chunk.split('\n')` can split JSON mid-event and drop or fail parsing streamed parts.
  - `[DONE]` only breaks the inner `for` loop, not the outer reader loop.
  - It ignores many v6 stream parts that the SDK documents as current protocol: `start`, `tool-input-delta`, `tool-approval-request`, `tool-approval-response`, `tool-output-denied`, `file`, `custom`, `start-step`, `finish-step`, `abort`, and appended `error` parts.
  - It posts `{ message, session_id }`, not the UI-message request shape expected by `DefaultChatTransport` examples. If the Python backend intentionally accepts this legacy shape, this should be documented as a custom protocol; otherwise it is not SDK-compatible.
- **SDK citation:**
  - AI SDK Chatbot docs show `useChat` with `DefaultChatTransport`, `sendMessage({ text: input })`, server `streamText({ messages: await convertToModelMessages(messages) })`, and `return result.toUIMessageStreamResponse()`; they also state: “The UI messages have a new `parts` property… render… using the `parts` property instead of the `content` property.” https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/02-chatbot.mdx
  - AI SDK stream protocol docs: “The data stream protocol uses Server-Sent Events (SSE) format…” and “When you provide data streams from a custom backend, you need to set the `x-vercel-ai-ui-message-stream` header to `v1`.” The same doc lists text, reasoning, source, file, data, error, tool input/output/approval, step, finish, abort, and `[DONE]` parts. https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/50-stream-protocol.mdx
- **Required fix:** Replace this manual parser with `useChat` + `DefaultChatTransport` as in `SearchAgentDisplay.tsx`, or centralize a complete SSE parser that buffers frames, validates the `x-vercel-ai-ui-message-stream: v1` contract, handles every documented part type, handles abort cleanup, and maps emitted chunks into real `UIMessage.parts`.
- **Fixed code:**
```tsx
const transport = useMemo(
  () => new DefaultChatTransport({
    api: 'http://localhost:8765/agents/search/stream',
    body: () => ({ session_id: 'search-page' }),
  }),
  [],
)

const { messages, sendMessage, status } = useChat({
  transport,
  onData: (part) => {
    if (part.type === 'data-usage') setUsage(part.data as UsageData)
  },
})

useEffect(() => {
  if (searchQuery && status === 'ready') {
    void sendMessage({ text: searchQuery })
  }
}, [searchQuery, sendMessage, status])
```
- **Why scales/lasts:** Delegating stream parsing to the SDK tracks v6 protocol changes, preserves tool/source/reasoning parts, and avoids every component reimplementing partial SSE parsing.

### [Z2-002] AgentPanel history hydration flattens historical non-text parts into one text part — 🟡 MEDIUM
- **File:** `src/components/agent-panel/AgentPanel.tsx:156`
- **Current code:**
```tsx
const loadedMessages: UIMessage[] = data.messages.map((msg: any, i: number) => {
  const textContent =
    typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content
            .map((block: any) => {
              if (typeof block === 'string') return block
              if (block?.type === 'text' && typeof block.text === 'string') return block.text
              if ((block?.type === 'reasoning' || block?.type === 'thinking') && typeof (block.text || block.content) === 'string') {
                return block.text || block.content
              }
              return ''
            })
            .join('')
        : ''
  const parts: MessagePart[] = [{ type: 'text', text: textContent }]

  return {
    id: `msg-${sid}-${i}`,
    role: msg.role,
    content: '',
    parts,
  }
})
```
- **What's wrong:** The v6 `UIMessage.parts` model is intentionally typed for text, reasoning, source, file, data, and tool parts. This hydration path collapses `reasoning`/`thinking` into visible text and drops tool calls, tool results, sources, files, and data parts. A saved conversation will replay differently from the live stream, and `ChainOfThoughtMessage` can no longer render reasoning/tool/source state correctly.
- **SDK citation:** AI SDK Chatbot docs: “The UI messages have a new `parts` property that contains the message parts… The parts property supports different message types, including text, tool invocation, and tool result.” https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/02-chatbot.mdx
- **Required fix:** Hydrate each persisted block to its corresponding `UIMessage.parts` entry; do not coerce reasoning/tool/data/source/file parts into a text string.
- **Fixed code:**
```tsx
function hydrateParts(content: unknown): MessagePart[] {
  if (typeof content === 'string') return [{ type: 'text', text: content } as MessagePart]
  if (!Array.isArray(content)) return [{ type: 'text', text: '' } as MessagePart]

  return content.flatMap((block: any): MessagePart[] => {
    if (typeof block === 'string') return [{ type: 'text', text: block } as MessagePart]
    if (block?.type === 'text') return [{ type: 'text', text: block.text || '' } as MessagePart]
    if (block?.type === 'reasoning' || block?.type === 'thinking') {
      return [{ type: 'reasoning', text: block.text || block.content || '', state: 'done' } as MessagePart]
    }
    if (block?.type?.startsWith?.('data-')) return [block as MessagePart]
    if (block?.type === 'dynamic-tool' || block?.type?.startsWith?.('tool-')) return [block as MessagePart]
    if (block?.type === 'source-url' || block?.type === 'source-document' || block?.type === 'file') return [block as MessagePart]
    return []
  })
}
```
- **Why scales/lasts:** Preserving parts keeps storage, live streams, replay, and UI renderers aligned as SDK part types expand.

### [Z2-003] SearchChat history loader drops tool outputs and source/file/data parts — 🟡 MEDIUM
- **File:** `src/components/search-results/SearchChat.tsx:253`
- **Current code:**
```tsx
const loadedMessages: UIMessage[] = data.messages.map((msg: any, i: number) => {
  const parts: MessagePart[] = []
  if (typeof msg.content === 'string') {
    parts.push({ type: 'text', text: msg.content } as MessagePart)
  } else if (Array.isArray(msg.content)) {
    msg.content.forEach((block: any) => {
      if (typeof block === 'string') {
        parts.push({ type: 'text', text: block } as MessagePart)
      } else if (block?.type === 'text') {
        parts.push({ type: 'text', text: block.text || '' } as MessagePart)
      } else if (block?.type === 'reasoning' || block?.type === 'thinking') {
        parts.push({ type: 'reasoning', text: block.text || block.content || '' } as MessagePart)
      } else if (block?.type === 'tool_use') {
        parts.push({
          type: 'dynamic-tool',
          toolName: block.name,
          toolCallId: block.id || `call_${i}_${Math.random().toString(36).slice(2, 8)}`,
          state: 'output-available',
          input: block.input,
        } as MessagePart)
      }
    })
  }
```
- **What's wrong:** `tool_use` is converted to `dynamic-tool` but no `output` is attached, while matching `tool_result`/tool output blocks, source blocks, files, and `data-*` blocks are not handled. It also sets the tool state to `output-available` even when only input is present. This misrepresents the v6 tool lifecycle.
- **SDK citation:** AI SDK stream protocol docs define separate `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-output-available`, `tool-output-denied`, source, file, and data stream parts. https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/50-stream-protocol.mdx
- **Required fix:** Preserve backend persisted tool input and output pairs into one `dynamic-tool` part with correct state, and map source/file/data parts through untouched.
- **Fixed code:**
```tsx
if (block?.type === 'tool_use') {
  parts.push({
    type: 'dynamic-tool',
    toolName: block.name,
    toolCallId: block.id,
    state: block.output ? 'output-available' : 'input-available',
    input: block.input,
    output: block.output,
    errorText: block.errorText,
  } as MessagePart)
} else if (block?.type === 'tool_result') {
  mergeToolResult(parts, block.toolCallId, block.output, block.errorText)
} else if (
  block?.type?.startsWith?.('data-') ||
  block?.type === 'source-url' ||
  block?.type === 'source-document' ||
  block?.type === 'file'
) {
  parts.push(block as MessagePart)
}
```
- **Why scales/lasts:** Correct state transitions allow `isToolUIPart`, `getToolName`, citations, previews, and reasoning renderers to work for replayed conversations exactly as they do during live streaming.

### [Z2-004] Local AI Elements `MessageResponse` omits upstream Streamdown plugin wiring — 🟡 MEDIUM
- **File:** `src/components/ai-elements/message.tsx:348`
- **Current code:**
```tsx
export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
```
- **What's wrong:** The project depends on `@streamdown/cjk`, `@streamdown/code`, `@streamdown/math`, and `@streamdown/mermaid`, but the main local `MessageResponse` wrapper does not pass those plugins. The nested `theapp` copy and Vercel upstream do pass `plugins={streamdownPlugins}`. As a result, code highlighting, math, mermaid, and CJK behavior can diverge from ai-elements 1.8 expectations in the production copy.
- **SDK citation:** Vercel AI Elements source imports `{ cjk, code, math, mermaid }`, defines `const streamdownPlugins = { cjk, code, math, mermaid }`, and renders `<Streamdown ... plugins={streamdownPlugins} ... />` in `packages/elements/src/message.tsx`. https://github.com/vercel/ai-elements/blob/main/packages/elements/src/message.tsx
  Streamdown README says its AI SDK usage passes `plugins={{ code, mermaid, math, cjk }}` and notes that optional plugins require matching setup. https://github.com/vercel/streamdown
- **Required fix:** Match upstream ai-elements by importing the installed plugins and passing them into `Streamdown`.
- **Fixed code:**
```tsx
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'

const streamdownPlugins = { cjk, code, math, mermaid }

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children && prevProps.isAnimating === nextProps.isAnimating,
)
```
- **Why scales/lasts:** Keeping local copied components aligned with upstream reduces subtle rendering drift when SDK/plugin docs and examples assume those plugins are active.

### [Z2-005] Local AI Elements `ReasoningContent` omits upstream Streamdown plugins and forwards Collapsible props into Streamdown — 🟡 MEDIUM
- **File:** `src/components/ai-elements/reasoning.tsx:207`
- **Current code:**
```tsx
export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    >
      <Streamdown {...props}>
        {children}
      </Streamdown>
    </CollapsibleContent>
  )
);
```
- **What's wrong:** Like `MessageResponse`, it omits the installed Streamdown plugins. It also spreads `CollapsibleContent` props into `Streamdown`, which can leak non-Streamdown/DOM props into the markdown renderer. Upstream Vercel AI Elements renders `<Streamdown plugins={streamdownPlugins}>{children}</Streamdown>` and does not forward the collapsible props to Streamdown.
- **SDK citation:** Vercel AI Elements `reasoning.tsx` defines `const streamdownPlugins = { cjk, code, math, mermaid }` and renders `<Streamdown plugins={streamdownPlugins}>{children}</Streamdown>`. https://github.com/vercel/ai-elements/blob/main/packages/elements/src/reasoning.tsx
- **Required fix:** Wire plugins and stop forwarding `CollapsibleContent` props to `Streamdown`.
- **Fixed code:**
```tsx
const streamdownPlugins = { cjk, code, math, mermaid }

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent className={cn('mt-4 text-sm', className)} {...props}>
      <Streamdown plugins={streamdownPlugins}>{children}</Streamdown>
    </CollapsibleContent>
  ),
)
```
- **Why scales/lasts:** Reasoning markdown then renders with the same capabilities as message markdown and stays compatible with ai-elements upstream changes.

### [Z2-006] `ResponseMarkdown` always enables incomplete Markdown parsing, even in static mode — 🟢 LOW
- **File:** `src/components/ai-elements/response.tsx:77`
- **Current code:**
```tsx
export function ResponseMarkdown({ content, isStreaming, className }: ResponseMarkdownProps) {
  return (
    <MessageResponse
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
      mode={isStreaming ? 'streaming' : 'static'}
      isAnimating={isStreaming}
      parseIncompleteMarkdown={true}
    >
      {content}
    </MessageResponse>
  )
}
```
- **What's wrong:** `parseIncompleteMarkdown` is appropriate for streaming/incomplete output, but static completed content should not need unterminated block recovery. This is not a security bypass, but it can render malformed final Markdown as if it were still streaming.
- **SDK citation:** Streamdown README describes it as “Streaming-optimized” and says it handles “incomplete Markdown gracefully”; examples set `isAnimating={status === 'streaming'}` for streaming state. https://github.com/vercel/streamdown
- **Required fix:** Gate incomplete parsing on `isStreaming`.
- **Fixed code:**
```tsx
<MessageResponse
  mode={isStreaming ? 'streaming' : 'static'}
  isAnimating={isStreaming}
  parseIncompleteMarkdown={isStreaming}
>
  {content}
</MessageResponse>
```
- **Why scales/lasts:** Completed responses render deterministically while streamed responses still get Streamdown’s incomplete-Markdown recovery.

### [Z2-007] `sonar-reasoning-pro.ts` mixes renderer hook code with server-only API handler and secret-bearing direct provider call — 🟠 HIGH
- **File:** `src/api/sonar-reasoning-pro.ts:167`
- **Current code:**
```ts
export class SonarReasoningProClient extends EventEmitter {
  async streamReal(query: string): Promise<void> {
    const apiKey = this.options.apiKey || process.env.PERPLEXITY_API_KEY

    if (!apiKey) {
      throw new Error('Perplexity API key is required')
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stream: true, /* ... */ })
    })
  }
}

export function createSonarStreamHandler() {
  return async (req: any, res: any) => { /* Express/SSE handler */ }
}

export function useSonarReasoningPro() { /* React hook */ }
```
- **What's wrong:** This `/src/api` file combines Node `EventEmitter`, `process.env.PERPLEXITY_API_KEY`, an Express-style SSE handler, a direct browser-reachable provider fetch, and a React hook. If this module is imported into the renderer, Vite/Electron renderer code can include server-only logic and potentially expose or misuse provider credentials. It is also not an AI SDK UI message stream; it emits a custom `content` / `reasoning_start` / `metadata` protocol that differs from v6 `text-start`/`text-delta`, `reasoning-start`/`reasoning-delta`, `source-*`, and `tool-*` parts.
- **SDK citation:** AI SDK Chatbot server example keeps provider calls in an API route and returns `result.toUIMessageStreamResponse()` from server code, while the client uses `useChat` to consume it. https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/02-chatbot.mdx  AI SDK Stream Protocol docs define the v6 UI message stream part names and custom backend header requirement. https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/50-stream-protocol.mdx
- **Required fix:** Split server-only Perplexity/Sonar streaming into backend code, expose a UI-message-compatible endpoint, and keep the renderer hook as a client-only `useChat`/`DefaultChatTransport` wrapper or a protocol-specific hook that never imports secret-bearing code.
- **Fixed code:**
```ts
// renderer-only hook
export function useSonarReasoningPro() {
  return useChat({
    transport: new DefaultChatTransport({ api: '/api/sonar-reasoning-pro/stream' }),
  })
}

// server/backend route only
const result = streamText({
  model: perplexityModel,
  messages: await convertToModelMessages(messages),
})
return result.toUIMessageStreamResponse()
```
- **Why scales/lasts:** Separating renderer and server concerns prevents credential leakage and lets the client consume the same UI message stream contract as the rest of the app.

### [Z2-008] Legacy `message.content` fallback remains in `AskRonMenu` finish handling — 🟢 LOW
- **File:** `src/components/board/task-detail/editor/AskRonMenu.tsx:70`
- **Current code:**
```tsx
onFinish: (message: any) => {
  setTimeout(() => {
    let text = ''
    if (message.content) {
      text = message.content
    } else if (message.parts) {
      text = message.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('')
    }
    replaceNodeWithResult(text)
  }, 800)
}
```
- **What's wrong:** v6 UI messages should be rendered/read through `parts`, not `content`. The fallback is harmless if the SDK callback object still supplies compatibility fields, but this path silently prefers legacy `content` over `parts` if both exist. It should prefer `parts` and ignore unsupported non-text parts intentionally.
- **SDK citation:** AI SDK Chatbot docs: “We recommend rendering the messages using the `parts` property instead of the `content` property.” https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/02-chatbot.mdx
- **Required fix:** Prefer `parts` and remove `content` as the primary path.
- **Fixed code:**
```tsx
const text = Array.isArray(message.parts)
  ? message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join('')
  : typeof message.content === 'string'
    ? message.content
    : ''
```
- **Why scales/lasts:** The editor path remains compatible with v6+ structured messages and does not accidentally display serialized tool/reasoning content.

### [Z2-009] Rive Persona integration is compliant; no change required — 🟢 LOW
- **File:** `src/components/ai-elements/persona.tsx:234`
- **Current code:**
```tsx
const { rive, RiveComponent } = useRive({
  autoplay: true,
  onLoad: stableCallbacks.onLoad,
  onLoadError: stableCallbacks.onLoadError,
  onPause: stableCallbacks.onPause,
  onPlay: stableCallbacks.onPlay,
  onRiveReady: stableCallbacks.onReady,
  onStop: stableCallbacks.onStop,
  src: source.source,
  stateMachines: stateMachine,
})

const listeningInput = useStateMachineInput(rive, stateMachine, 'listening')
const thinkingInput = useStateMachineInput(rive, stateMachine, 'thinking')
const speakingInput = useStateMachineInput(rive, stateMachine, 'speaking')
const asleepInput = useStateMachineInput(rive, stateMachine, 'asleep')
```
- **What's wrong:** No SDK violation found. The component uses `@rive-app/react-webgl2`, `useRive`, and `useStateMachineInput`, stabilizes callbacks to avoid reinitialization, and does not add unmanaged Rive event listeners that would require explicit cleanup.
- **SDK citation:** Rive React runtime docs identify the React runtime package/hook pattern (`@rive-app/react-canvas` / related runtimes, `useRive`) and Rive’s runtime model. https://rive.app/docs/runtimes/react/react  Package target here is the WebGL2 runtime, which exposes the same hook family.
- **Required fix:** None.
- **Fixed code:**
```tsx
// No code change required.
```
- **Why scales/lasts:** The hook-owned Rive lifecycle is the least fragile integration pattern for React/Electron renderers.

## Cleanup Items

- Remove or quarantine the nested `src/components/ai-elements/theapp/` sample app from production source scanning/build inputs if it is only a copied reference. It duplicates many ai-elements components and can drift from the production copy.
- Align all local `src/components/ai-elements/*` copies with `vercel/ai-elements` upstream for v1.8, especially `message.tsx`, `reasoning.tsx`, and any component with Streamdown plugin support.
- Add a backend protocol contract document for `http://localhost:8765/agents/*/stream`: request shape, required `x-vercel-ai-ui-message-stream: v1` response header when using UI message streams, and supported part types.
- Add regression coverage for history hydration of text, reasoning, data, source, file, and dynamic-tool parts.
- Consider a single shared `hydrateUIMessageParts()` utility used by `AgentPanel`, `SearchChat`, task chat, and search chat history.

## Sources & Citations

- AI SDK Chatbot docs (official source in Vercel AI repo): https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/02-chatbot.mdx
  - Key excerpts used: `useChat` example with `DefaultChatTransport`; `sendMessage({ text: input })`; server `streamText` with `convertToModelMessages`; `toUIMessageStreamResponse()`; “The UI messages have a new `parts` property…”
- AI SDK Transport docs (official source in Vercel AI repo): https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/21-transport.mdx
  - Key excerpts used: default `useChat` HTTP transport; `DefaultChatTransport` configuration; dynamic `body`/`headers`; `prepareSendMessagesRequest`.
- AI SDK Stream Protocol docs (official source in Vercel AI repo): https://raw.githubusercontent.com/vercel/ai/main/content/docs/04-ai-sdk-ui/50-stream-protocol.mdx
  - Key excerpts used: SSE data stream protocol; required `x-vercel-ai-ui-message-stream: v1`; supported stream part names; `[DONE]` termination.
- AI SDK Tool Calling docs (official source in Vercel AI repo): https://raw.githubusercontent.com/vercel/ai/main/content/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx
  - Key excerpts used: function tools define `description`, `inputSchema`, `execute`, and optional `strict`; `tools` used by `generateText`/`streamText`.
- AI SDK migration/codemod docs: https://github.com/vercel/ai/blob/main/packages/codemod/README.md and https://raw.githubusercontent.com/vercel/ai/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx
  - Key excerpts used: `replace-content-with-parts`, `replace-usechat-api-with-transport`, `replace-usechat-input-with-state`, `rename-tool-parameters-to-inputschema`, `append` → `sendMessage`, transport architecture.
- AI Elements README: https://github.com/vercel/ai-elements/blob/main/README.md
  - Key excerpts used: AI Elements is a shadcn-based component library; components are copied into the app for customization; examples include `Conversation`, `Message`, and `MessageResponse`.
- AI Elements upstream source: https://github.com/vercel/ai-elements/blob/main/packages/elements/src/message.tsx and https://github.com/vercel/ai-elements/blob/main/packages/elements/src/reasoning.tsx
  - Key excerpts used: upstream `MessageResponse` and `ReasoningContent` wire `@streamdown/cjk`, `@streamdown/code`, `@streamdown/math`, and `@streamdown/mermaid` via `plugins={streamdownPlugins}`.
- Streamdown README: https://github.com/vercel/streamdown
  - Key excerpts used: “drop-in replacement for react-markdown”; “Streaming-optimized”; “Security-first - Built with `rehype-harden`”; AI SDK usage example with `plugins={{ code, mermaid, math, cjk }}` and `isAnimating={status === 'streaming'}`.
- Rive React runtime docs: https://rive.app/docs/runtimes/react/react
  - Key excerpts used: React runtime/hook integration model for Rive animations. Fetching was intermittently unavailable during this audit; validated code against package API usage and official URL.
