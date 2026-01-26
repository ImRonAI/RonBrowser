# Ron Browser Agent System Architecture

## Overview
Ron Browser uses the **Strands** framework pattern for multi-agent orchestration. The system is designed to have a primary "Orchestrator" (The User's ron) and specialized sub-agents.

## Core Agents

### 1. The Monolith (Orchestrator)
- **Role**: Main interface with the user.
- **Responsibilities**:
    - Intent recognition (Is this a search? A coding task? A browse action?).
    - Delegation to sub-agents.
    - Synthesis of results into a coherent UI.
    - Maintaining user context and preferences (from Onboarding).

### 2. Browser Agent (Navigator)
- **Role**: Autonomous web navigation.
- **Tools**:
    - `goTo(url)`
    - `click(selector)`
    - `extract(selector)`
    - `scroll()`
- **Implementation**: Uses Electron's `BrowserView` or Puppeteer/Playwright connection (TBD).

### 3. Researcher Agent
- **Role**: Deep dive information gathering.
- **Workflow**:
    - Generates search queries.
    - Scrapes top results.
    - Summarizes findings.
    - Follows citations.

## Implementation Plan (Strands)

1. **State Management**: `agentStore` holds the conversation history and the active "Thread".
2. **Tool Registry**: A central registry of tools available to agents.
3. **Context Window**: Dynamic context management to keep relevant info in scope.

## Current Status
- [x] UI Panel (`AgentPanel`)
- [x] Onboarding Data (Personalization Context)
- [ ] Agent Logic Implementation
- [ ] Tool definitions

## Agent Loop + Streaming Contract

### UIMessageStream v1 Protocol (CRITICAL)
The UI uses AI SDK `useChat` + `DefaultChatTransport` and expects **UIMessageStream v1** events.

**MANDATORY REQUIREMENT**: Every stream MUST emit terminal events (`finish` and `[DONE]`) even on:
- Successful completion
- Errors or exceptions
- Timeouts
- Early exits or cancellation

If terminal events are missing, the UI stays in a non-ready `status` ('streaming' or 'submitted') 
and **blocks the user from sending new messages**.

### Implementation Details

#### Backend (`agent/api/main.py`)
The `/superagent/stream` endpoint implements these safeguards:

1. **Overall Timeout**: Configurable via `AGENT_TIMEOUT_SECONDS` env var (default: 300s/5min)
2. **Terminal Event Fallback**: After agent execution completes (success, error, or timeout),
   the endpoint checks if `finish` and `[DONE]` were emitted and emits them if missing
3. **Guaranteed Yield**: Terminal events are yielded to the client before the generator returns
4. **Error Handling**: All exception paths emit error + terminal events

#### Callback Handler (`agent/aisdk_stream.py`)
The `AISDKCallbackHandler` class:

1. Emits terminal events when Strands calls it with `result=AgentResult(...)`
2. Tracks state with `_finished` flag to prevent duplicate terminal events
3. Provides `finalize(finish_reason)` method to force terminal events if `result=` was never received
4. Provides `is_finished` property to check if terminal events were already emitted

### Event Flow
```
start → start-step → [content/reasoning/tool events] → finish-step → finish → [DONE]
```

### Debugging Non-Responsive UI
If the agent panel appears stuck:
1. Check browser console for `[AgentPanel] API Error` messages
2. Check backend logs for `Stream complete` with `Finish: True, Done: True`
3. If `Finish: False` or `Done: False`, terminal events weren't received
4. Check for agent timeout (look for "Agent execution timed out" in logs)
5. Verify backend is running: `npm run dev:backend` on port 8765
