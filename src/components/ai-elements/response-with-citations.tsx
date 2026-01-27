/**
 * ResponseWithCitations
 *
 * Extends ResponseMarkdown to support inline citations with hover previews.
 * Preserves markdown rendering while turning [n] markers into InlineCitation components.
 */

import { ResponseMarkdown } from './response'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import type { ComponentProps } from 'react'
import { cn } from '@/utils/cn'
import { visit } from 'unist-util-visit'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource
} from './inline-citation'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Citation {
  number: string
  title: string
  url: string
  snippet?: string
}

interface ResponseWithCitationsProps {
  content: string
  citations?: Citation[]
  isStreaming?: boolean
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Citation Parsing (Markdown-aware)
// ─────────────────────────────────────────────────────────────────────────────

const STREAMDOWN_PLUGINS = { code }
const CODE_BLOCK_LANGUAGE = /language-([^\s]+)/i

const MARKDOWN_COMPONENTS: NonNullable<ComponentProps<typeof Streamdown>['components']> = {
  code: ({ className, children, ...props }) => {
    const raw = Array.isArray(children) ? children.join('') : String(children ?? '')
    const match = typeof className === 'string' ? className.match(CODE_BLOCK_LANGUAGE) : null
    const language = (match?.[1] || 'text') as string
    const isInline = !match

    if (isInline) {
      return (
        <code
          className={cn(
            'rounded bg-surface-100/70 px-1.5 py-0.5 text-[0.85em] text-ink dark:bg-surface-800/70 dark:text-ink-inverse',
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }

    return (
      <CodeBlock code={raw.trimEnd()} language={language as any} className="my-3">
        <CodeBlockCopyButton />
      </CodeBlock>
    )
  },
}

function createCitationPlugin() {
  return () => (tree: any) => {
    visit(tree, 'text', (node: any, index: number | null, parent: any) => {
      if (!parent || typeof node.value !== 'string') return
      const parts = node.value.split(/(\[\d+\])/)
      if (parts.length <= 1) return

      const nextNodes = parts
        .map((part) => {
          const match = part.match(/^\[(\d+)\]$/)
          if (match) {
            return {
              type: 'link',
              url: `citation://${match[1]}`,
              children: [{ type: 'text', value: part }],
            }
          }
          if (!part) return null
          return { type: 'text', value: part }
        })
        .filter(Boolean)

      if (index === null || index === undefined) return
      parent.children.splice(index, 1, ...nextNodes)
      return index + nextNodes.length
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ResponseWithCitations({
  content,
  citations = [],
  isStreaming,
  className
}: ResponseWithCitationsProps) {
  if (!citations || citations.length === 0) {
    return (
      <ResponseMarkdown
        content={content}
        isStreaming={isStreaming}
        className={className}
      />
    )
  }

  const citationMap = new Map(citations.map((c) => [c.number, c]))

  const components: NonNullable<ComponentProps<typeof Streamdown>['components']> = {
    ...MARKDOWN_COMPONENTS,
    a: ({ href, children, ...props }) => {
      const match = typeof href === 'string' ? href.match(/^citation:\/\/(\d+)$/) : null
      if (match) {
        const number = match[1]
        const citation = citationMap.get(number)
        if (!citation) {
          return (
            <span
              className="text-accent dark:text-accent-light font-medium"
              title="Citation metadata pending"
            >
              {children}
            </span>
          )
        }

        return (
          <InlineCitation>
            <InlineCitationText>{children}</InlineCitationText>
            <InlineCitationCard>
              <InlineCitationCardTrigger sources={[citation.url]}>
                [{citation.number}]
              </InlineCitationCardTrigger>
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselNext />
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    <InlineCitationCarouselItem>
                      <InlineCitationSource
                        title={citation.title}
                        url={citation.url}
                        description={citation.snippet}
                      />
                    </InlineCitationCarouselItem>
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        )
      }

      return (
        <a
          href={href}
          className="text-accent underline-offset-2 hover:underline"
          {...props}
        >
          {children}
        </a>
      )
    },
  }

  return (
    <Streamdown
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        className
      )}
      plugins={STREAMDOWN_PLUGINS}
      remarkPlugins={[createCitationPlugin()]}
      components={components}
      mode={isStreaming ? 'streaming' : 'static'}
      isAnimating={isStreaming}
      parseIncompleteMarkdown={true}
    >
      {content}
    </Streamdown>
  )
}
