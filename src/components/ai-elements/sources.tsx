"use client";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import type {
  AnchorHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

export type SourcesProps = ComponentProps<typeof Collapsible>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible className={cn("flex flex-col gap-2", className)} {...props} />
);

// ─────────────────────────────────────────────────────────────────────────────
// SourcesTrigger
// ─────────────────────────────────────────────────────────────────────────────

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({ count, className, ...props }: SourcesTriggerProps) => (
  <CollapsibleTrigger asChild {...props}>
    <Button
      className={cn(
        "group h-auto rounded-full px-3 py-1.5 text-xs font-medium",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span>
        {count} source{count !== 1 ? "s" : ""}
      </span>
      <ChevronDownIcon className="size-3 transition-transform group-data-[state=open]:rotate-180" />
    </Button>
  </CollapsibleTrigger>
);

// ─────────────────────────────────────────────────────────────────────────────
// SourcesContent
// ─────────────────────────────────────────────────────────────────────────────

export type SourcesContentProps = HTMLAttributes<HTMLDivElement>;

export const SourcesContent = ({ className, ...props }: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "rounded-xl border border-border bg-background p-2",
      "space-y-2",
      className
    )}
    {...props}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Source
// ─────────────────────────────────────────────────────────────────────────────

export type SourceProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export const Source = ({
  className,
  children,
  rel,
  target,
  ...props
}: SourceProps) => (
  <a
    className={cn(
      "flex items-start gap-3 rounded-lg border border-border/60",
      "bg-background px-3 py-2 text-sm transition-colors",
      "hover:bg-accent/40",
      className
    )}
    rel={rel ?? "noopener noreferrer"}
    target={target ?? "_blank"}
    {...props}
  >
    <div className="min-w-0 flex-1">{children}</div>
    <ExternalLinkIcon className="size-3 text-muted-foreground" />
  </a>
);
