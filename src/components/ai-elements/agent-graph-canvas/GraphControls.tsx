/**
 * GraphControls Component
 *
 * Playback controls for graph execution simulation.
 * Includes play/pause, step, and reset functionality.
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GraphControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  canStep: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  className?: string;
}

export const GraphControls = memo(function GraphControls({
  isRunning,
  isPaused,
  canStep,
  onPlay,
  onPause,
  onStep,
  onReset,
  className,
}: GraphControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "bg-slate-900/90 backdrop-blur-sm",
        "rounded-xl border border-slate-700",
        "p-3 shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ControlsIcon className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Controls
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        {!isRunning || isPaused ? (
          <ControlButton
            onClick={onPlay}
            disabled={isRunning && !isPaused}
            tooltip="Play"
            variant="primary"
          >
            <PlayIcon className="w-4 h-4" />
          </ControlButton>
        ) : (
          <ControlButton
            onClick={onPause}
            disabled={!isRunning}
            tooltip="Pause"
            variant="warning"
          >
            <PauseIcon className="w-4 h-4" />
          </ControlButton>
        )}

        {/* Step Button */}
        <ControlButton
          onClick={onStep}
          disabled={!canStep || isRunning}
          tooltip="Step Forward"
          variant="default"
        >
          <StepIcon className="w-4 h-4" />
        </ControlButton>

        {/* Reset Button */}
        <ControlButton
          onClick={onReset}
          disabled={false}
          tooltip="Reset"
          variant="danger"
        >
          <ResetIcon className="w-4 h-4" />
        </ControlButton>
      </div>

      {/* Status Indicator */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            Status
          </span>
          <StatusBadge isRunning={isRunning} isPaused={isPaused} />
        </div>
      </div>
    </motion.div>
  );
});

interface ControlButtonProps {
  onClick: () => void;
  disabled: boolean;
  tooltip: string;
  variant: "primary" | "warning" | "danger" | "default";
  children: React.ReactNode;
}

function ControlButton({
  onClick,
  disabled,
  tooltip,
  variant,
  children,
}: ControlButtonProps) {
  const variants = {
    primary: {
      base: "bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border-violet-500/30",
      disabled: "opacity-50 cursor-not-allowed",
    },
    warning: {
      base: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30",
      disabled: "opacity-50 cursor-not-allowed",
    },
    danger: {
      base: "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30",
      disabled: "opacity-50 cursor-not-allowed",
    },
    default: {
      base: "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600",
      disabled: "opacity-50 cursor-not-allowed",
    },
  };

  const config = variants[variant];

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        "p-2 rounded-lg border transition-all duration-200",
        "flex items-center justify-center",
        config.base,
        disabled && config.disabled
      )}
    >
      {children}
    </motion.button>
  );
}

function StatusBadge({
  isRunning,
  isPaused,
}: {
  isRunning: boolean;
  isPaused: boolean;
}) {
  const status = isRunning
    ? isPaused
      ? "Paused"
      : "Running"
    : "Stopped";

  const config = {
    Running: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    Paused: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Stopped: "bg-slate-800 text-slate-400 border-slate-600",
  };

  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded-md border text-[10px] font-medium",
        config[status]
      )}
    >
      <div className="flex items-center gap-1">
        {status === "Running" && (
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        )}
        {status}
      </div>
    </div>
  );
}

// Icons
function ControlsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6" />
      <path d="M12 17v6" />
      <path d="M4.22 4.22l4.24 4.24" />
      <path d="M15.54 15.54l4.24 4.24" />
      <path d="M1 12h6" />
      <path d="M17 12h6" />
      <path d="M4.22 19.78l4.24-4.24" />
      <path d="M15.54 8.46l4.24-4.24" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function StepIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}