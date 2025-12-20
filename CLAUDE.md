# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ron Browser** is an Electron-based AI agent browser application combining a Chrome-like browser interface with AI-powered features including voice/text onboarding, personalized content curation, and multi-agent orchestration.

## Tech Stack

- **Framework**: Electron 30 with electron-vite for development
- **Frontend**: React 19 + TypeScript 5.9
- **Build**: Vite 7 with electron-builder for packaging
- **Styling**: TailwindCSS 3.4 with custom Catalyst UI components
- **State**: Zustand with persist middleware
- **Backend**: Supabase (authentication, database)
- **UI Components**: Headless UI, Heroicons, Framer Motion
- **Fonts**: Georgia (headers), Raleway (body)

## Development Commands

```bash
# Install dependencies
npm install

# Run in development mode (starts Electron with hot reload)
npm run dev

# Build for production
npm run build

# Start built app
npm start

# Package Electron app (creates distributable)
npm run package

# Type checking (no tests configured yet)
npm run lint
npm run typecheck
```

## Architecture

### Directory Structure

```
/electron                # Electron main and preload processes
  main.ts                # Main process entry (window management, IPC)
  preload.ts             # Preload script (exposes APIs to renderer)

/src                     # React renderer process
  /api                   # Backend API clients
    supabase.ts          # Supabase client and auth functions
    client.ts            # API client utilities
    streaming.ts         # Streaming API handlers
  /components            # UI components
    /catalyst            # Catalyst UI library (copied to src/components)
    /chrome              # Browser chrome (tabs, URL bar, toolbar)
    /agent-panel         # AI agent UI components
    /interests           # Interest discovery and visualization
    /onboarding          # Onboarding flow components
    /auth                # Authentication forms
    /home                # Home page components
    /shared              # Shared/reusable components
  /stores                # Zustand state management
    authStore.ts         # Authentication state (Supabase integration)
    tabStore.ts          # Browser tab management
    onboardingStore.ts   # Onboarding flow state
    interestsStore.ts    # User interests state
    agentStore.ts        # AI agent state
    userPreferencesStore.ts # User preferences
  /pages                 # Page-level components
    SignInPage.tsx       # Authentication page
    OnboardingPage.tsx   # Onboarding flow
    HomePage.tsx         # Main browser home page
  /layouts               # Layout components
    BrowserLayout.tsx    # Main browser layout wrapper
    AuthPageLayout.tsx   # Auth page layout
  /hooks                 # React hooks
    useTheme.ts          # Theme management hook
  /types                 # TypeScript type definitions
  /utils                 # Utility functions
  App.tsx                # Root component with routing logic
  main.tsx               # React entry point

/typescript              # Original Catalyst component library (reference)
/dist                    # Build output (electron/ and renderer/)
```

### Build Configuration

- **electron-vite.config.ts**: Configures three build targets:
  - `main`: Electron main process → `dist/electron/index.js`
  - `preload`: Preload script → `dist/electron/preload.js`
  - `renderer`: React app → `dist/renderer/`
- **tsconfig.json**: Path aliases `@/*` → `src/*`, `@catalyst/*` → `src/components/catalyst/*`

### Application Flow

1. **Electron main process** (`electron/main.ts`):
   - Creates BrowserWindow with custom frame
   - Handles IPC for theme, auth tokens, window controls
   - Manages secure token storage (currently in-memory)

2. **React app routing** (`src/App.tsx`):
   - Not authenticated → `SignInPage`
   - Authenticated but not onboarded → `OnboardingPage`
   - Authenticated and onboarded → `HomePage` in `BrowserLayout`

3. **State management** (Zustand stores):
   - All stores use `persist` middleware for localStorage
   - `authStore` integrates with Supabase auth state changes
   - `tabStore` manages browser tab lifecycle

### Key Features

1. **Authentication** - Supabase email/password + OAuth (Google, Apple, Microsoft, GitHub)
2. **Onboarding Flow** - Voice interview OR text-based questionnaire (TypeForm-style)
3. **Browser Chrome** - Tabs, navigation, URL bar, theme toggle, user menu
4. **Personalized Home** - Dynamic content cards based on user interests
5. **Interest Discovery** - Neural canvas visualization of user interests
6. **Multi-Agent System** - Agent panel with screen vision overlay (planned)

## Design System

### Colors (tailwind.config.ts)

**Light Mode**: Pure white (`#FFFFFF`) background, near-black (`#0A0A0A`) text, royal blue accent (`#2D3B87`)

**Dark Mode**: Near-black (`#0A0A0A`) background, smoke (`#1A1A1A`) secondary surfaces, same royal blue accent

**Glass Mode**: Glassmorphism utilities (`.glass-ultra`, `.glass-frosted`) with high blur and translucency

### Typography

- Headers: Georgia serif
- Body: Raleway (100/200/300/700 weights)

### Theme Support

Three themes via `userPreferencesStore`:
- `light`: Solid white backgrounds
- `dark`: Solid black backgrounds
- `system`: Follows OS preference

Custom TailwindCSS variant `glass:` for glass-specific styles (e.g., `glass:bg-opacity-10`)

## Component Library

Catalyst components are located in `/src/components/catalyst/` (copied from `/typescript/`). All use Headless UI and support dark mode via `dark:` classes:

- `button.tsx` - Button variants (solid, outline, plain, colors)
- `input.tsx` - Text inputs with InputGroup wrapper
- `dialog.tsx` - Modal dialogs
- `dropdown.tsx` - Dropdown menus
- `navbar.tsx`, `sidebar.tsx`, `sidebar-layout.tsx` - Navigation
- `avatar.tsx`, `badge.tsx` - User identity components
- `checkbox.tsx`, `radio.tsx`, `switch.tsx` - Form controls
- `select.tsx`, `listbox.tsx`, `combobox.tsx` - Selection
- `table.tsx`, `alert.tsx` - Data display

## Critical Development Notes

### Electron Testing

**CRITICAL**: This is an Electron desktop app. DO NOT use MCP servers or browser-based testing methods - they will not work. Always test with `npm run dev` which launches the Electron app.

### State Persistence

All Zustand stores use `persist` middleware. On app launch, `RESET_APP_ON_LAUNCH` flag in `App.tsx` can clear storage for development. Keyboard shortcut: `Cmd/Ctrl+Shift+K` resets app state.

### Supabase Integration

- Client initialized in `src/api/supabase.ts`
- Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Auth state syncs with `authStore` via `onAuthStateChange` listener
- Tokens stored in Electron's secure storage (via IPC to main process)
- Database tables: `users`, `user_preferences` (gracefully handles missing tables)

### IPC Communication

Main process exposes APIs via preload script (`electron/preload.ts`):
- `window.electron.theme` - Get/set theme, system theme listener
- `window.electron.auth` - Store/clear/get tokens
- `window.electron.window` - Minimize, maximize, close, fullscreen

### Path Aliases

Use `@/` for src imports and `@catalyst/` for Catalyst components:
```typescript
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@catalyst/button'
```

## Backend Integration (Current State)

- **Authentication**: Fully integrated with Supabase Auth
- **Database**: Tables referenced but gracefully handle non-existence
- **Agent orchestration**: Placeholder stores (`agentStore`) exist but no implementation yet
- **Voice AI**: Components exist (`AgentPanel`, `ScreenVisionOverlay`) but not connected

## Common Patterns

### Creating a new page

1. Create component in `/src/pages/`
2. Add routing logic to `App.tsx`
3. Use layout wrappers (`BrowserLayout`, `AuthPageLayout`)

### Adding state

1. Create store in `/src/stores/` using Zustand pattern
2. Add `persist` middleware if state should survive reloads
3. Use `partialize` to control what gets persisted

### Styling components

1. Use Catalyst components as base (already themed)
2. Extend with TailwindCSS utility classes
3. Support all three themes: `dark:`, `glass:` variants
4. Use color tokens from `tailwind.config.ts` (royal, ron-white, ron-black, ron-smoke)

### Accessing Electron APIs

```typescript
if (window.electron?.theme) {
  const theme = await window.electron.theme.getTheme()
  window.electron.theme.setTheme('dark')
}
```
