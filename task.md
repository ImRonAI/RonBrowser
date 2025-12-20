# Phase 1: Core User Flow & Onboarding Implementation

## Objective
Complete the "Current Phase" by connecting the user journey: Auth -> Onboarding -> Home -> Agent Interaction.
Focus on the Onboarding Flow (Text-based) and ensuring the Home page reflects the user's preferences.

## Implementation Plan

### 1. Onboarding Flow (Immediate Priority)
- [ ] **Review & Update Store**: Verify `src/stores/onboardingStore.ts` handles necessary state (completed flag, answers).
- [ ] **Create Onboarding Page**: Implement `src/pages/OnboardingPage.tsx`.
    - Design a "TypeForm-style" multi-step questionnaire.
    - Steps: Greeting -> Name/Role -> Interests -> AI Personality Preference -> Completion.
    - Use `framer-motion` for smooth transitions between questions.
- [ ] **Data Persistence**: Ensure answers are saved to `onboardingStore` and `userPreferencesStore`.
- [ ] **Route Protection**: Update `src/App.tsx` to redirect authenticated users to `/onboarding` if they haven't completed it.

### 2. Home Page Personalization
- [ ] **Dynamic Content**: Update `src/pages/HomePage.tsx` to read from `onboardingStore`/`userPreferencesStore`.
    - Display "Welcome back, [Name]".
    - Generate suggested "Cards" based on "Interests".
- [ ] **Kinetic Monolith**: Implement a visual representation (or a polished placeholder) of the "Kinetic Monolith" concept in the empty space.

### 3. Agent System Foundation
- [ ] **Documentation**: Populate `AGENTS.md` with the specific architecture (Strands framework integration plan).
- [ ] **Agent Panel**: Enhance `src/components/agent-panel/AgentPanel.tsx` to show a basic "System Prompt" derived from Onboarding answers.
    - This proves the "Personalization" is working.

### 4. Browser Chrome Refinement (Cleanup)
- [ ] **Verify Navigation**: Ensure `UrlBar` and `TabBar` work reasonably well for a demo (can load URLs in a webview or iframe if possible, or just mock navigation events).

## Success Criteria
- User logs in (mocked).
- User is presented with a beautiful, animated Onboarding questions.
- Upon completion, User lands on Home Page.
- Home Page is personalized (Name, suggestions).
- Opening Agent Panel shows that the Agent knows the user's context.
