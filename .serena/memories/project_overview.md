# Ron Browser Project Overview

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

## Key Features
1. **Authentication** - Supabase email/password + OAuth (Google, Apple, Microsoft, GitHub)
2. **Onboarding Flow** - Voice interview OR text-based questionnaire (TypeForm-style)
3. **Browser Chrome** - Tabs, navigation, URL bar, theme toggle, user menu
4. **Personalized Home** - Dynamic content cards based on user interests
5. **Interest Discovery** - Neural canvas visualization of user interests
6. **Multi-Agent System** - Agent panel with screen vision overlay (planned)
