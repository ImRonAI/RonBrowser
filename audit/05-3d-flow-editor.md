# 05 — 3D / Flow / Rich-Text Editor SDK Compliance Audit

Audit date: 2026-05-22  
Repository: `/home/runner/work/RonBrowser/RonBrowser`  
Scope audited line-by-line:

- `src/components/interests/**`
- `src/components/board/**`
- `src/components/projects/**`
- Every `src/**` file importing any requested SDK/package family discovered by grep: `three`, `@react-three/fiber`, `@react-three/drei`, `@xyflow/react`, `@tiptap/*`, `lowlight`, `tippy.js`, `framer-motion`, `motion`, `embla-carousel-react`, `recharts`, `react-jsx-parser`, `katex`, `react-katex`, `shiki`, `cmdk`, `dagre`, `@hello-pangea/dnd`.

Network note: direct `web_fetch`/direct DNS resolution for official documentation hosts failed in this environment; citations below use official documentation URLs and quotes verified via `web_search` where available. Claims not backed by an official-doc quote are marked **UNVERIFIED**.

## Executive Summary

The audited code is mostly on current package names (`@xyflow/react`, `@tiptap/*`, `@react-three/fiber`, `@react-three/drei`) and no legacy `reactflow` imports were found. No `dagre` or `@hello-pangea/dnd` usage was found in `src`, despite both being installed.

Key SDK compliance risks:

1. **High:** `WorkflowVisualizationPart` recreates `nodeTypes` and mapped `nodes` on every render, violating the official React Flow/XYflow stable-reference guidance and causing avoidable graph re-renders.
2. **High:** TipTap editor content does not actually sync when the `content` prop changes; the effect detects drift but performs no update, so switching tasks can show stale rich text.
3. **Medium:** TipTap slash-command popup lifecycle assumes `popup[0]` exists even when `onStart` exits early, risking runtime crashes during Suggestion lifecycle callbacks.
4. **Medium:** TipTap React editor is configured without render-throttling options; large documents and transaction-heavy editing will rerender the React wrapper on every transaction.
5. **Medium:** The Three/R3F visualizer mutates a particle buffer cumulatively from the last mutated positions instead of immutable base positions, which can cause long-running drift and unstable GPU-buffer updates under continuous audio input.
6. **Low:** Both `framer-motion` and `motion` are installed, while audited code imports only `framer-motion`; this is redundant after the official Motion package rebrand.

## Severity Legend

- **Critical:** SDK-incompatible code likely to fail at runtime or corrupt state/data.
- **High:** Confirmed SDK misuse or lifecycle issue likely to cause incorrect behavior, large performance regressions, or stale UI.
- **Medium:** SDK-adjacent lifecycle/performance risk that scales poorly or can crash in edge cases.
- **Low:** Cleanup, bundle-size, or forward-compatibility concern.
- **Info:** Verified compliance/no issue.
- **UNVERIFIED:** Needs live official docs/runtime confirmation.

---

## Findings

### 3DFE-001 — HIGH — XYflow `nodeTypes` is recreated every render

**File / lines**

- `src/components/search-results/WorkflowVisualizationPart.tsx:7-10`
- `src/components/search-results/WorkflowVisualizationPart.tsx:108-130`

**Current code**

Excerpted from the actual implementation:

```tsx
import { memo, useCallback } from 'react'

const nodeTypes = useCallback(() => ({
  agentNode: AgentWorkflowNode,
}), [])

<Canvas
  nodes={part.nodes.map((node) => ({
    ...node,
    type: 'agentNode',
  }))}
  edges={part.edges}
  nodeTypes={nodeTypes()}
  fitView
/>
```

**What's wrong**

`useCallback` stabilizes the function, not the object returned by calling it. `nodeTypes()` creates a fresh object on every render, triggering React Flow/XYflow's documented re-render trap for custom node/edge type registries. The inline `part.nodes.map(...)` also creates a fresh node array on every render and should be memoized for workflow graphs.

**SDK citation**

Official React Flow / XYflow custom node guidance: <https://reactflow.dev/learn/customization/custom-nodes>

> “If you define your custom nodeTypes inside the component, a new object is created on every render, which will cause all nodes to re-render. To avoid this, define nodeTypes outside your component (or memoize them).”

Official troubleshooting warning: <https://reactflow.dev/learn/troubleshooting/common-errors>

> “You created a new object for `nodeTypes` / `edgeTypes` on every render. This can break internals of React Flow. Consider memoizing your nodeTypes/edgeTypes.”

**Required fix**

Use `useMemo` for `nodeTypes` and derived nodes, or define `nodeTypes` at module scope when it has no runtime dependencies.

**Fixed code**

Prefer module scope for the static type registry; memoize only values derived from props.

```tsx
import { memo, useMemo } from 'react'
import type { NodeTypes } from '@xyflow/react'

const workflowNodeTypes: NodeTypes = {
  agentNode: AgentWorkflowNode,
}

const flowNodes = useMemo(
  () => part.nodes.map((node) => ({ ...node, type: 'agentNode' })),
  [part.nodes],
)

<Canvas
  nodes={flowNodes}
  edges={part.edges}
  nodeTypes={workflowNodeTypes}
  fitView
/>
```

**Why this scales**

Stable graph prop references prevent React Flow from recalculating internals and rerendering every node on parent renders. This matters as workflow visualizations grow from a handful of agents to dozens/hundreds of nodes.

---

### 3DFE-002 — HIGH — TipTap editor ignores non-empty external `content` changes

**File / lines**

- `src/components/board/task-detail/editor/NotionEditor.tsx:47-129`

**Current code**

```tsx
const editor = useEditor({
  // ...
  content,
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML())
  },
})

useEffect(() => {
  if (editor && content !== editor.getHTML()) {
     // Only update if content is significantly different to avoid cursor jumps
     // ... no update is performed
  }
}, [content, editor])

useEffect(() => {
    if (editor && editor.isEmpty && content) {
        editor.commands.setContent(content)
    }
}, [editor, content])
```

**What's wrong**

`content` is applied at editor creation and only reapplied when the editor is empty. When the parent changes `content` for another task/document, the first effect detects the mismatch but intentionally does nothing, leaving the editor on stale HTML. In a board/task detail editor, this can display or save the wrong task body.

**SDK citation**

Official TipTap command docs: <https://tiptap.dev/docs/editor/api/commands/content/set-content>

> “`emitUpdate?: boolean (true)` — Whether to emit an update event. Defaults to true (Note: This changed from false in v2).”

Official TipTap React install/use pattern: <https://tiptap.dev/docs/editor/getting-started/install/react>

> `useEditor({ extensions: [StarterKit], content: '<p>Hello World!</p>' })` and render with `<EditorContent editor={editor} />`.

**Required fix**

Track document identity in the parent if possible; when a new task/document content prop arrives, call `setContent(content, { emitUpdate: false })` to avoid echoing the update back through `onChange`.

**Fixed code**

```tsx
useEffect(() => {
  if (!editor) return

  const nextContent = content || ''
  if (nextContent !== editor.getHTML()) {
    editor.commands.setContent(nextContent, { emitUpdate: false })
  }
}, [editor, content])
```

If cursor preservation for same-document collaborative updates is required, gate this effect on a stable `documentId`/`taskId` prop instead of raw HTML comparison.

**Why this scales**

A single editor instance can safely serve many board tasks without stale document state. `emitUpdate: false` avoids feedback loops and redundant persistence writes.

---

### 3DFE-003 — MEDIUM — TipTap Suggestion/tippy lifecycle assumes popup exists

**File / lines**

- `src/components/board/task-detail/editor/extensions/slash-command.ts:53-104`

**Current code**

```ts
render: () => {
  let component: any
  let popup: any

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(SlashCommandMenu, {
        props,
        editor: props.editor,
      })

      if (!props.clientRect) {
        return
      }

      popup = tippy('body', { /* ... */ })
    },

    onUpdate(props: any) {
      component.updateProps(props)
      // ...
      popup[0].setProps({ getReferenceClientRect: props.clientRect })
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        popup[0].hide()
        return true
      }
      return component.ref?.onKeyDown(props)
    },

    onExit() {
      popup[0].destroy()
      component.destroy()
    },
  }
}
```

**What's wrong**

`onStart` can return before assigning `popup` when `props.clientRect` is absent. Later lifecycle hooks dereference `popup[0]` and `component` without guards. This can crash the editor during slash-command lifecycle transitions or selection changes.

**SDK citation**

Official TipTap Suggestion utility: <https://tiptap.dev/docs/editor/api/utilities/suggestion>

> The `render` function returns lifecycle hooks such as `onStart`, `onUpdate`, `onKeyDown`, and `onExit`; `onExit` is where UI cleanup should occur.

**Required fix**

Type the renderer and popup, and guard all lifecycle callbacks. Destroy any partially-created ReactRenderer if no popup can be created.

**Fixed code**

```ts
import type { Instance } from 'tippy.js'

render: () => {
  let component: ReactRenderer | null = null
  let popup: Instance[] | null = null

  return {
    onStart: (props) => {
      if (!props.clientRect) return

      component = new ReactRenderer(SlashCommandMenu, {
        props,
        editor: props.editor,
      })

      popup = tippy(document.body, {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      })
    },
    onUpdate: (props) => {
      component?.updateProps(props)
      if (props.clientRect && popup?.[0]) {
        popup[0].setProps({ getReferenceClientRect: props.clientRect })
      }
    },
    onKeyDown: (props) => {
      if (props.event.key === 'Escape') {
        popup?.[0]?.hide()
        return true
      }
      return component?.ref?.onKeyDown?.(props) ?? false
    },
    onExit: () => {
      popup?.[0]?.destroy()
      component?.destroy()
      popup = null
      component = null
    },
  }
}
```

**Why this scales**

Suggestion UI becomes resilient under rapid typing, IME composition, selection changes, and React 19 StrictMode-like lifecycle stress.

---

### 3DFE-004 — MEDIUM — TipTap React wrapper rerenders on every transaction

**File / lines**

- `src/components/board/task-detail/editor/NotionEditor.tsx:47-111`

**Current code**

```tsx
const editor = useEditor({
  editable: !readOnly,
  extensions: [/* many extensions */],
  content,
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML())
  },
  editorProps: { /* ... */ },
})
```

**What's wrong**

This task editor includes tables, task lists, code highlighting, custom React node views, slash commands, file attachments, and Ask Ron blocks. With default TipTap React behavior, the React component can rerender for every ProseMirror transaction. That is acceptable for prototypes but risky for large task descriptions and embedded node views.

**SDK citation**

Official TipTap React performance guidance: <https://tiptap.dev/docs/editor/getting-started/install/react>

> “`shouldRerenderOnTransaction: (props) => boolean` — A function that lets you decide if the React component should re-render on a ProseMirror transaction. Returning false will prevent the re-render. By default, it always returns true.”

Official TipTap performance guidance: <https://tiptap.dev/docs/editor/getting-started/install/react>

> “Consider using the `shouldRerenderOnTransaction` option to finely control when a rerender should occur.”

**Required fix**

Add `shouldRerenderOnTransaction` policy and move toolbar active-state subscriptions to a focused editor-state hook or command state updates. At minimum, avoid full wrapper rerenders for document-only changes.

**Fixed code**

Tune the predicate to the UI's real dependencies; the example below is a starting point, not a universal policy.

```tsx
const editor = useEditor({
  editable: !readOnly,
  extensions,
  content,
  shouldRerenderOnTransaction: ({ transaction }) => {
    return transaction.selectionSet
  },
  onUpdate: ({ editor }) => onChange(editor.getHTML()),
  editorProps,
})
```

If toolbar buttons must update formatting state while typing, include those transactions or subscribe to active marks/nodes separately. Then derive BubbleMenu button active states from editor state subscriptions rather than forcing the entire editor wrapper to update for every keystroke.

**Why this scales**

Typing, table edits, code-block edits, and custom NodeView updates do not repeatedly rerender the whole editor shell and all toolbar controls.

---

### 3DFE-005 — MEDIUM — R3F particle simulation mutates GPU buffer cumulatively without immutable base positions

**File / lines**

- `src/components/voice-agent/VoiceAgentVisualizer.tsx:174-263`

**Current code**

```tsx
const [positions, colors] = useMemo(() => {
  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)
  // random initial positions
  return [positions, colors]
}, [])

useFrame((state) => {
  if (particlesRef.current) {
    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      const x = positions[i3]
      const y = positions[i3 + 1]
      const z = positions[i3 + 2]
      const radius = Math.sqrt(x * x + y * y + z * z)
      const newRadius = radius + audioData.volume * Math.sin(i + time) * 0.5
      positions[i3] = newRadius * Math.sin(phi) * Math.cos(theta)
      // ...
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
  }
})
```

**What's wrong**

The frame loop reads from the already-mutated GPU attribute buffer and writes back into the same buffer. `newRadius` is based on the previous frame's radius, so continuous audio input can accumulate radius drift instead of oscillating around a stable base distribution. The code does mutate inside `useFrame` rather than calling React state, which is correct, but it needs stable base arrays for deterministic animation.

**SDK citation**

Official R3F `useFrame` docs: <https://r3f.docs.pmnd.rs/api/hooks#useframe>

> “Caution: Mutate objects inside useFrame, never call useState/setState as it will create a render-loop.”

Official Three.js disposal/performance manual: <https://threejs.org/manual/#en/how-to-dispose-of-objects>

> “Whenever you create an instance of a three.js type, you allocate a certain amount of memory… these objects are not released automatically. Instead, the application has to use a special API in order to free such resources.”

**Required fix**

Keep immutable base positions and write derived frame positions from the base array each frame. Let R3F own disposal of JSX-created geometry/materials on unmount; do not call React state inside `useFrame`.

**Fixed code**

```tsx
const { basePositions, colors } = useMemo(() => {
  const basePositions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)
  // fill basePositions/colors once
  return { basePositions, colors }
}, [])

useFrame((state) => {
  const geometry = particlesRef.current?.geometry
  if (!geometry) return

  const time = state.clock.getElapsedTime()
  const positionAttr = geometry.attributes.position
  const target = positionAttr.array as Float32Array

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3
    const x = basePositions[i3]
    const y = basePositions[i3 + 1]
    const z = basePositions[i3 + 2]
    // derive target[i3..i3+2] from base + time/audio
  }

  positionAttr.needsUpdate = true
})
```

**Why this scales**

Long-lived Electron windows can run the visualizer indefinitely without unbounded particle drift. Frame updates remain inside R3F's render loop and avoid React re-render loops.

---

### 3DFE-006 — LOW — Motion package duplication after rebrand

**File / lines**

- `package.json:93-98`
- Representative audited imports: `src/components/interests/NeuralCanvas.tsx:2`, `src/components/board/BoardView.tsx:2`, `src/components/projects/dialogs.tsx:2`, plus many other `src/**` files importing `framer-motion`.

**Current code**

```json
"framer-motion": "^12.23.26",
"motion": "^12.23.26"
```

```ts
import { motion, AnimatePresence } from 'framer-motion'
```

**What's wrong**

Both old and new package names are installed. The audited code imports `framer-motion`; no `from 'motion/react'` import was found. Keeping both packages increases dependency surface and bundle/install size.

**SDK citation**

Official Motion migration docs: <https://motion.dev/docs/migrate-from-framer-motion>

> “Change your imports from `framer-motion` to `motion/react`.”

**Required fix**

Choose one package. Preferred forward path: migrate imports to `motion/react`, verify behavior, then remove `framer-motion`. If the team intentionally wants the old import name, remove the unused `motion` dependency instead.

**Fixed code**

```ts
import { motion, AnimatePresence, useDragControls } from 'motion/react'
```

```json
"motion": "^12.23.26"
```

**Why this scales**

One animation package avoids duplicate dependency trees and keeps all motion components on the same rebranded API surface.

---

## Verified Compliant Areas / No Findings

### R3F / Drei / Three.js

- `src/components/voice-agent/VoiceAgentVisualizer.tsx` uses `Canvas` with valid R3F v9-style `gl={{ antialias: true, alpha: true }}` object props; no legacy `outputEncoding` or `THREE.ColorManagement.enabled` mutation was found.
- `useFrame` is used for imperative Three object mutation and does not call React state setters inside the frame loop.
- JSX-created `<icosahedronGeometry>`, `<shaderMaterial>`, `<bufferGeometry>`, `<pointsMaterial>`, `<torusGeometry>`, and `<meshBasicMaterial>` are owned by R3F. No manual `renderer.dispose()` misuse was found.
- Drei `OrbitControls` props used (`enableZoom`, `enablePan`, `autoRotate`, `autoRotateSpeed`) are current. `makeDefault` is not required because no other component reads controls from the R3F root store.
- `src/components/interests/**` is not a Three/R3F canvas despite the “neural canvas” name; it is SVG/DOM/framer-motion based.

### XYflow v12

- No `reactflow` package imports were found; all flow imports use `@xyflow/react`.
- `src/components/ai-elements/strands-orchestration/strands-graph.tsx` and `strands-swarm.tsx` define `nodeTypes`/`edgeTypes` at module scope and use `useNodesState`/`useEdgesState`, matching XYflow's controlled-state helper pattern.
- `src/components/ai-elements/canvas.tsx` imports `@xyflow/react/dist/style.css`, wraps `<ReactFlow>`, and passes props through safely.

### TipTap v3

- Imports are on `@tiptap/*` v3 package names present in `package.json`.
- Custom Node extensions use `Node.create`, `addAttributes`, `parseHTML`, `renderHTML`, and `ReactNodeViewRenderer`; no confirmed v2-only API signature was found.
- `CodeBlockLowlight` uses `lowlight` v3's `createLowlight(common)` pattern.

### Dagre / DnD

- No `dagre` imports were found in `src`.
- No `@hello-pangea/dnd`, `DragDropContext`, `Droppable`, or `Draggable` imports/usages were found in `src`.

---

## Cleanup Items

1. Remove unused dependencies if they are not planned: `dagre`, `@hello-pangea/dnd`, and either `framer-motion` or `motion` after consolidation.
2. Consider adding a dependency-boundary lint rule or import check to prevent legacy `reactflow` imports.
3. For large flow graphs, memoize all derived `nodes`, `edges`, `nodeTypes`, `edgeTypes`, and callback props at component boundaries.
4. For TipTap, introduce a typed `extensions` factory (`useMemo`) and replace `any` in Suggestion/NodeView code with TipTap v3 types.
5. For R3F scenes, document ownership/disposal expectations: JSX-created Three resources are R3F-owned; manually-created external textures/geometries/materials must be disposed in cleanup.

---

## Sources & Citations

- React Three Fiber hooks / `useFrame`: <https://r3f.docs.pmnd.rs/api/hooks#useframe> — “Mutate objects inside useFrame, never call useState/setState as it will create a render-loop.”
- React Three Fiber Canvas / v9 GL API: <https://r3f.docs.pmnd.rs/api/canvas> and <https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide> — Canvas `gl` accepts constructor parameters/properties/callbacks; async callbacks support WebGPU renderer initialization.
- Drei controls: <https://drei.docs.pmnd.rs/controls/introduction> — controls run before other `useFrame`s; `makeDefault` registers controls in the R3F root store when needed.
- Three.js disposal manual: <https://threejs.org/manual/#en/how-to-dispose-of-objects> — geometries, materials, and textures allocate WebGL resources and require disposal when manually owned.
- React Flow / XYflow React Flow API: <https://reactflow.dev/api-reference/react-flow>
- React Flow / XYflow `useNodesState`: <https://reactflow.dev/api-reference/hooks/use-nodes-state> — returns `[nodes, setNodes, onNodesChange]`; `onNodesChange` handles node changes for controlled flows.
- React Flow / XYflow custom node memoization guidance: <https://reactflow.dev/learn/customization/custom-nodes> and <https://reactflow.dev/learn/troubleshooting/common-errors> — stable `nodeTypes`/`edgeTypes` references are required to avoid full node rerenders and internal warnings.
- TipTap React install: <https://tiptap.dev/docs/editor/getting-started/install/react>
- TipTap React/useEditor performance: <https://tiptap.dev/docs/editor/getting-started/install/react> — `shouldRerenderOnTransaction` can prevent rerenders; default behavior rerenders on transactions.
- TipTap `setContent`: <https://tiptap.dev/docs/editor/api/commands/content/set-content> — `emitUpdate` defaults to true in v3; use `{ emitUpdate: false }` for external sync that should not fire `onUpdate`.
- TipTap Suggestion utility: <https://tiptap.dev/docs/editor/api/utilities/suggestion> — render lifecycle hooks include `onStart`, `onUpdate`, `onKeyDown`, and `onExit`; cleanup belongs in `onExit`.
- TipTap v2 → v3 migration: <https://tiptap.dev/docs/editor/migration-from-v2-to-v3>
- Motion migration from Framer Motion: <https://motion.dev/docs/migrate-from-framer-motion> — “Change your imports from `framer-motion` to `motion/react`.”
