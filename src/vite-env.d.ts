/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_DEBUG: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Type declarations for packages without @types
declare module 'react-katex' {
  import { ComponentType } from 'react'
  export const InlineMath: ComponentType<{ math: string; [key: string]: any }>
  export const BlockMath: ComponentType<{ math: string; [key: string]: any }>
}
