'use client'

import { memo, useMemo } from 'react'
import { getToolName, isDataUIPart, isToolUIPart, type UIMessage } from 'ai'
import { cn } from '@/utils/cn'
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtImage,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { ResponseWithCitations, type Citation } from '@/components/ai-elements/response-with-citations'
import { ThinkingIndicator } from '@/components/ai-elements/loader'

type MessagePart = UIMessage['parts'][number]

type ChainOfThoughtMessageProps = {
  parts: MessagePart[]
  citations?: Citation[]
  isStreaming?: boolean
  messageId?: string
  className?: string
}

type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'output-denied'
  | 'approval-requested'
  | 'approval-responded'

type ChainSource = {
  id: string
  label: string
  url?: string
}

type ChainImage = {
  id: string
  src: string
  caption?: string
  alt?: string
}

function toToolState(value: unknown): ToolState {
  if (typeof value === 'string') {
    if (
      value === 'input-streaming' ||
      value === 'input-available' ||
      value === 'output-available' ||
      value === 'output-error' ||
      value === 'output-denied' ||
      value === 'approval-requested' ||
      value === 'approval-responded'
    ) {
      return value
    }

    if (value === 'running') return 'input-available'
    if (value === 'pending') return 'input-streaming'
    if (value === 'success') return 'output-available'
    if (value === 'error') return 'output-error'
  }

  return 'input-streaming'
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getPartText(part: MessagePart) {
  if (part.type === 'text') {
    return asText((part as { text?: string }).text)
  }

  return ''
}

function getMergedReasoningText(reasoningParts: Array<MessagePart & { text?: string }>) {
  return reasoningParts.map((part) => asText(part.text)).filter(Boolean).join('')
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeVisibleResponseText(textContent: string, reasoningText: string) {
  if (!textContent || !reasoningText) return textContent

  // Defensive guard for streams that accidentally replay reasoning as text prefix.
  if (textContent.startsWith(reasoningText)) {
    return textContent.slice(reasoningText.length).replace(/^\s+/, '')
  }

  // Tolerate whitespace differences between reasoning and visible text prefixes.
  const normalizedReasoning = reasoningText.trim()
  if (!normalizedReasoning) return textContent
  const reasoningPrefixPattern = new RegExp(
    `^\\s*${escapeForRegex(normalizedReasoning).replace(/\s+/g, '\\s+')}\\s*`
  )

  if (reasoningPrefixPattern.test(textContent)) {
    return textContent.replace(reasoningPrefixPattern, '')
  }

  return textContent
}

function asUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return undefined
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.startsWith('data:image/')) return true
  return /\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i.test(value)
}

function sourceLabelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function extractSourcesFromUnknown(value: unknown): ChainSource[] {
  const candidates: unknown[] = []
  const pushCandidate = (item: unknown) => {
    if (item !== undefined && item !== null) candidates.push(item)
  }

  pushCandidate(value)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['sources', 'results', 'search_results', 'flat_results', 'citations', 'links', 'items']) {
      const maybeItems = record[key]
      if (Array.isArray(maybeItems)) {
        maybeItems.forEach(pushCandidate)
      }
    }
  }
  if (Array.isArray(value)) {
    value.forEach(pushCandidate)
  }

  const dedupe = new Set<string>()
  const extracted: ChainSource[] = []

  for (const item of candidates) {
    let url: string | undefined
    let label: string | undefined

    if (typeof item === 'string') {
      url = asUrl(item)
      label = url ? sourceLabelFromUrl(url) : undefined
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      url =
        asUrl(record.url) ||
        asUrl(record.link) ||
        asUrl(record.href) ||
        asUrl(record.source) ||
        asUrl(record.sourceId)
      const explicitLabel = typeof record.title === 'string'
        ? record.title
        : typeof record.name === 'string'
          ? record.name
          : undefined
      label = explicitLabel || (url ? sourceLabelFromUrl(url) : undefined)
    }

    if (!url || !label) continue

    const key = `${url}::${label}`
    if (dedupe.has(key)) continue
    dedupe.add(key)
    extracted.push({
      id: key,
      label,
      url,
    })
  }

  return extracted
}

function extractImagesFromUnknown(value: unknown): ChainImage[] {
  const candidates: unknown[] = []
  const pushCandidate = (item: unknown) => {
    if (item !== undefined && item !== null) candidates.push(item)
  }

  pushCandidate(value)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['images', 'image', 'screenshots', 'thumbnails']) {
      const maybeImages = record[key]
      if (Array.isArray(maybeImages)) {
        maybeImages.forEach(pushCandidate)
      } else {
        pushCandidate(maybeImages)
      }
    }
  }
  if (Array.isArray(value)) {
    value.forEach(pushCandidate)
  }

  const dedupe = new Set<string>()
  const extracted: ChainImage[] = []

  for (const item of candidates) {
    let src: string | undefined
    let caption: string | undefined
    let alt: string | undefined

    if (typeof item === 'string') {
      if (isImageUrl(item)) {
        src = item
      }
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const maybeSrc =
        (typeof record.src === 'string' && record.src) ||
        (typeof record.url === 'string' && record.url) ||
        (typeof record.image === 'string' && record.image) ||
        (typeof record.thumbnail === 'string' && record.thumbnail)
      if (maybeSrc && isImageUrl(maybeSrc)) {
        src = maybeSrc
      }
      caption = typeof record.caption === 'string' ? record.caption : undefined
      alt = typeof record.alt === 'string' ? record.alt : undefined
    }

    if (!src || dedupe.has(src)) continue
    dedupe.add(src)
    extracted.push({
      id: src,
      src,
      caption,
      alt: alt || caption || 'Tool result image',
    })
  }

  return extracted
}

function openSource(url?: string) {
  if (!url || typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function getReasoningParts(parts: MessagePart[]) {
  return parts.filter((part) => part.type === 'reasoning') as Array<
    MessagePart & { text?: string }
  >
}

function getToolParts(parts: MessagePart[]) {
  return parts.filter((part) => isToolUIPart(part)) as Array<
    MessagePart & {
      type: string
      state?: string
      input?: unknown
      output?: unknown
      errorText?: string
      toolName?: string
    }
  >
}

function getDataParts(parts: MessagePart[]) {
  return parts.filter((part) => isDataUIPart(part)) as Array<
    MessagePart & { type: string; data?: unknown }
  >
}

export const ChainOfThoughtMessage = memo(function ChainOfThoughtMessage({
  parts,
  citations = [],
  isStreaming = false,
  messageId,
  className,
}: ChainOfThoughtMessageProps) {
  const reasoningParts = useMemo(() => getReasoningParts(parts), [parts])

  const textContent = useMemo(
    () => {
      const visibleText = parts.map((part) => getPartText(part)).filter(Boolean).join('')
      const mergedReasoning = getMergedReasoningText(reasoningParts)
      return sanitizeVisibleResponseText(visibleText, mergedReasoning)
    },
    [parts, reasoningParts],
  )

  const toolParts = useMemo(() => getToolParts(parts), [parts])
  const dataParts = useMemo(() => getDataParts(parts), [parts])

  const hasProcessParts =
    reasoningParts.length > 0 || toolParts.length > 0 || dataParts.length > 0

  return (
    <div className={cn('space-y-3', className)} data-message-id={messageId}>
      {hasProcessParts && (
        <ChainOfThought defaultOpen={isStreaming}>
          <ChainOfThoughtHeader>
            {isStreaming ? 'Working…' : 'Reasoning and tool calls'}
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            {reasoningParts.map((part, index) => {
              const reasoningText = asText(part.text)
              if (!reasoningText.trim()) return null

              return (
                <ChainOfThoughtStep
                  key={`reasoning-${index}`}
                  label={`Reasoning ${index + 1}`}
                  status={isStreaming ? 'active' : 'complete'}
                >
                  <Reasoning defaultOpen={isStreaming} isStreaming={isStreaming}>
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningText}</ReasoningContent>
                  </Reasoning>
                </ChainOfThoughtStep>
              )
            })}

            {toolParts.map((part, index) => {
              const state = toToolState(part.state)
              const toolType = typeof part.type === 'string' ? part.type : 'dynamic-tool'
              const toolName =
                (typeof part.toolName === 'string' && part.toolName) ||
                getToolName(part as any) ||
                `tool-${index + 1}`
              const toolSources = extractSourcesFromUnknown(part.output ?? part.input)
              const toolImages = extractImagesFromUnknown(part.output ?? part.input)

              return (
                <ChainOfThoughtStep
                  key={`tool-${index}-${toolName}`}
                  label={`Tool: ${toolName}`}
                  status={state.startsWith('output-') ? 'complete' : 'active'}
                >
                  <Tool>
                    {toolType === 'dynamic-tool' ? (
                      <ToolHeader type={toolType as 'dynamic-tool'} toolName={toolName} state={state} />
                    ) : (
                      <ToolHeader type={toolType as any} state={state} />
                    )}
                    <ToolContent>
                      {part.input !== undefined && <ToolInput input={part.input as any} />}
                      {(part.output !== undefined || part.errorText) && (
                        <ToolOutput
                          output={(part.output as any) ?? null}
                          errorText={part.errorText as any}
                        />
                      )}
                    </ToolContent>
                  </Tool>

                  {toolSources.length > 0 && (
                    <ChainOfThoughtSearchResults>
                      {toolSources.map((source) => (
                        <ChainOfThoughtSearchResult
                          key={source.id}
                          className={source.url ? 'cursor-pointer' : undefined}
                          onClick={() => openSource(source.url)}
                          title={source.url}
                        >
                          {source.label}
                        </ChainOfThoughtSearchResult>
                      ))}
                    </ChainOfThoughtSearchResults>
                  )}

                  {toolImages.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {toolImages.map((image) => (
                        <ChainOfThoughtImage key={image.id} caption={image.caption}>
                          <img
                            src={image.src}
                            alt={image.alt || ''}
                            className="max-h-full max-w-full object-contain"
                          />
                        </ChainOfThoughtImage>
                      ))}
                    </div>
                  )}
                </ChainOfThoughtStep>
              )
            })}

            {dataParts.map((part, index) => {
              const dataSources = extractSourcesFromUnknown(part.data)
              const dataImages = extractImagesFromUnknown(part.data)

              return (
                <ChainOfThoughtStep
                  key={`data-${index}-${part.type}`}
                  label={part.type.replace(/^data-/, '').replace(/-/g, ' ') || 'Data event'}
                  status={isStreaming ? 'active' : 'complete'}
                >
                  {dataSources.length > 0 && (
                    <ChainOfThoughtSearchResults>
                      {dataSources.map((source) => (
                        <ChainOfThoughtSearchResult
                          key={source.id}
                          className={source.url ? 'cursor-pointer' : undefined}
                          onClick={() => openSource(source.url)}
                          title={source.url}
                        >
                          {source.label}
                        </ChainOfThoughtSearchResult>
                      ))}
                    </ChainOfThoughtSearchResults>
                  )}

                  {dataImages.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {dataImages.map((image) => (
                        <ChainOfThoughtImage key={image.id} caption={image.caption}>
                          <img
                            src={image.src}
                            alt={image.alt || ''}
                            className="max-h-full max-w-full object-contain"
                          />
                        </ChainOfThoughtImage>
                      ))}
                    </div>
                  )}

                  <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
                    {safeJson(part.data)}
                  </pre>
                </ChainOfThoughtStep>
              )
            })}
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}

      {textContent.trim() ? (
        <ResponseWithCitations
          className="prose prose-sm max-w-none dark:prose-invert"
          citations={citations}
          content={textContent}
          isStreaming={isStreaming}
        />
      ) : (
        isStreaming && <ThinkingIndicator text="Thinking…" />
      )}
    </div>
  )
})
