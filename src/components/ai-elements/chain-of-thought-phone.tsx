/**
 * Chain of Thought - Phone/Telnyx Components
 * 
 * Visualize phone calls, SMS, and voicemail actions.
 */

import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CallStatus = 'dialing' | 'ringing' | 'connected' | 'on_hold' | 'ended' | 'failed'
export type CallDirection = 'outbound' | 'inbound'

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtPhoneCall
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtPhoneCallProps {
  phoneNumber: string
  contactName?: string
  direction: CallDirection
  status: CallStatus
  duration?: number
  transcript?: string[]
  actions?: Array<'mute' | 'hold' | 'transfer' | 'end'>
  className?: string
}

export function ChainOfThoughtPhoneCall({
  phoneNumber,
  contactName,
  direction,
  status,
  duration,
  transcript,
  actions = [],
  className
}: ChainOfThoughtPhoneCallProps) {
  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      status === 'connected' 
        ? 'border-green-300 dark:border-green-800' 
        : status === 'failed'
          ? 'border-red-300 dark:border-red-800'
          : 'border-surface-200 dark:border-surface-700',
      className
    )}>
      {/* Call header */}
      <div className={cn(
        'p-4',
        status === 'connected' 
          ? 'bg-green-50 dark:bg-green-900/20' 
          : 'bg-surface-100 dark:bg-surface-800'
      )}>
        <div className="flex items-center gap-4">
          {/* Avatar/Status */}
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            status === 'connected' 
              ? 'bg-green-500' 
              : status === 'dialing' || status === 'ringing'
                ? 'bg-blue-500'
                : status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-surface-300 dark:bg-surface-600'
          )}>
            {status === 'dialing' || status === 'ringing' ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <PhoneIcon className="w-6 h-6 text-white" />
              </motion.div>
            ) : status === 'failed' ? (
              <PhoneOffIcon className="w-6 h-6 text-white" />
            ) : (
              <PhoneIcon className="w-6 h-6 text-white" />
            )}
          </div>

          {/* Call info */}
          <div className="flex-1">
            <p className="text-body-md font-semibold text-ink dark:text-ink-inverse">
              {contactName || phoneNumber}
            </p>
            {contactName && (
              <p className="text-body-sm text-ink-secondary dark:text-ink-inverse-secondary">
                {phoneNumber}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                'text-label px-2 py-0.5 rounded-full',
                status === 'connected' ? 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                status === 'failed' ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                status === 'ended' ? 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300' :
                'bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
              )}>
                {status === 'dialing' ? 'Dialing...' :
                 status === 'ringing' ? 'Ringing...' :
                 status === 'connected' ? 'Connected' :
                 status === 'on_hold' ? 'On Hold' :
                 status === 'ended' ? 'Call Ended' : 'Failed'}
              </span>
              {direction === 'inbound' && (
                <span className="text-label text-ink-muted dark:text-ink-inverse-muted">Incoming</span>
              )}
            </div>
          </div>

          {/* Duration */}
          {duration !== undefined && (status === 'connected' || status === 'ended') && (
            <div className="text-display-sm font-mono text-ink dark:text-ink-inverse">
              {formatCallDuration(duration)}
            </div>
          )}
        </div>
      </div>

      {/* Live transcript */}
      {transcript && transcript.length > 0 && (
        <div className="p-3 border-t border-surface-200 dark:border-surface-700 max-h-40 overflow-y-auto">
          <div className="space-y-2">
            {transcript.map((line, i) => (
              <p key={i} className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Call actions */}
      {actions.length > 0 && status === 'connected' && (
        <div className="flex items-center justify-center gap-4 p-3 bg-surface-50 dark:bg-surface-850 border-t border-surface-200 dark:border-surface-700">
          {actions.includes('mute') && (
            <button className="p-3 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors">
              <MicOffIcon className="w-5 h-5 text-ink-muted dark:text-ink-inverse-muted" />
            </button>
          )}
          {actions.includes('hold') && (
            <button className="p-3 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors">
              <PauseIcon className="w-5 h-5 text-ink-muted dark:text-ink-inverse-muted" />
            </button>
          )}
          {actions.includes('transfer') && (
            <button className="p-3 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors">
              <TransferIcon className="w-5 h-5 text-ink-muted dark:text-ink-inverse-muted" />
            </button>
          )}
          {actions.includes('end') && (
            <button className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors">
              <PhoneOffIcon className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtSMS
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtSMSProps {
  phoneNumber: string
  contactName?: string
  direction: 'outbound' | 'inbound'
  message: string
  status: 'sending' | 'sent' | 'delivered' | 'failed'
  timestamp?: Date
  className?: string
}

export function ChainOfThoughtSMS({
  phoneNumber,
  contactName,
  direction,
  message,
  status,
  timestamp,
  className
}: ChainOfThoughtSMSProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <MessageIcon className="w-4 h-4 text-green-500" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            {direction === 'outbound' ? 'Send SMS' : 'Received SMS'}
          </span>
        </div>
        <span className={cn(
          'text-label px-1.5 py-0.5 rounded',
          status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          status === 'sending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
          'bg-surface-200 text-ink-muted dark:bg-surface-700 dark:text-ink-inverse-muted'
        )}>
          {status}
        </span>
      </div>

      {/* Contact */}
      <div className="px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <p className="text-body-sm font-medium text-ink dark:text-ink-inverse">
          {direction === 'outbound' ? 'To: ' : 'From: '}
          {contactName || phoneNumber}
        </p>
      </div>

      {/* Message bubble */}
      <div className="p-3">
        <div className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          direction === 'outbound'
            ? 'ml-auto bg-green-500 text-white rounded-br-md'
            : 'bg-surface-100 dark:bg-surface-800 text-ink dark:text-ink-inverse rounded-bl-md'
        )}>
          <p className="text-body-sm">{message}</p>
          {timestamp && (
            <p className={cn(
              'text-label mt-1',
              direction === 'outbound' ? 'text-white/70' : 'text-ink-muted dark:text-ink-inverse-muted'
            )}>
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ChainOfThoughtVoicemail
// ─────────────────────────────────────────────────────────────────────────────

interface ChainOfThoughtVoicemailProps {
  phoneNumber: string
  contactName?: string
  duration: number
  transcript?: string
  timestamp?: Date
  status: 'playing' | 'paused' | 'stopped'
  className?: string
}

export function ChainOfThoughtVoicemail({
  phoneNumber,
  contactName,
  duration,
  transcript,
  timestamp,
  status,
  className
}: ChainOfThoughtVoicemailProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <VoicemailIcon className="w-4 h-4 text-purple-500" />
          <span className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            Voicemail
          </span>
        </div>
        <span className="text-label text-ink-muted dark:text-ink-inverse-muted">
          {formatCallDuration(duration)}
        </span>
      </div>

      {/* From */}
      <div className="px-3 py-2 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <p className="text-body-sm font-medium text-ink dark:text-ink-inverse">
            From: {contactName || phoneNumber}
          </p>
          {timestamp && (
            <p className="text-label text-ink-muted dark:text-ink-inverse-muted">
              {timestamp.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Player */}
      <div className="p-3 flex items-center gap-3">
        <button className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-purple-500 hover:bg-purple-600 transition-colors'
        )}>
          {status === 'playing' ? (
            <PauseIcon className="w-5 h-5 text-white" />
          ) : (
            <PlayIcon className="w-5 h-5 text-white" />
          )}
        </button>
        
        {/* Progress bar */}
        <div className="flex-1">
          <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-500"
              initial={{ width: '0%' }}
              animate={{ width: status === 'playing' ? '100%' : '0%' }}
              transition={{ duration, ease: 'linear' }}
            />
          </div>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="px-3 pb-3">
          <p className="text-body-xs text-ink-secondary dark:text-ink-inverse-secondary italic">
            "{transcript}"
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  )
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function TransferIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 14 20 9 15 4" />
      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function VoicemailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="11.5" r="4.5" />
      <circle cx="18.5" cy="11.5" r="4.5" />
      <line x1="5.5" y1="16" x2="18.5" y2="16" />
    </svg>
  )
}


