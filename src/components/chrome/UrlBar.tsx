import { useState, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { cn } from '@/utils/cn'

export function UrlBar() {
  const [url, setUrl] = useState('ron://home')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      console.log('Navigate to:', url)
      // TODO: Implement navigation
    }
  }

  const isSecure = url.startsWith('https://') || url.startsWith('ron://')
  const isRonProtocol = url.startsWith('ron://')

  return (
    <motion.div
      className={cn(
        "relative flex items-center h-11 rounded-xl overflow-hidden",
        "transition-all duration-300 ease-smooth",
        // Base glass styling
        "glass-frosted",
        // Focus states
        isFocused && [
          "ring-2 ring-royal/30 dark:ring-royal-light/30 glass:ring-royal/40",
          "shadow-lg shadow-royal/5 dark:shadow-royal-light/5",
          "bg-white/90 dark:bg-ron-smoke/90 glass:bg-white/60"
        ]
      )}
      animate={{
        scale: isFocused ? 1.01 : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Subtle gradient overlay on focus */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, rgba(45, 59, 135, 0.03) 0%, transparent 50%, rgba(74, 59, 135, 0.03) 100%)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Left section - Protocol/Security indicator */}
      <div className="flex items-center pl-4 pr-2 h-full">
        {isRonProtocol ? (
          <motion.div
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <SparklesIcon className="w-4 h-4 text-royal dark:text-royal-light glass:text-royal" />
            <span className="text-xs font-raleway font-raleway-bold text-royal dark:text-royal-light glass:text-royal tracking-wide">
              ron
            </span>
          </motion.div>
        ) : isSecure ? (
          <motion.div
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <LockClosedIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 glass:text-emerald-600" />
          </motion.div>
        ) : null}
      </div>

      {/* Subtle divider */}
      {(isSecure || isRonProtocol) && (
        <div className="w-px h-5 bg-ron-text/10 dark:bg-white/10 glass:bg-zinc-400/30 mr-2" />
      )}

      {/* URL input */}
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleSubmit}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "flex-1 bg-transparent outline-none",
          "text-sm font-raleway tracking-wide",
          "text-ron-text dark:text-white glass:text-zinc-800",
          "placeholder:text-ron-text/30 dark:placeholder:text-white/30 glass:placeholder:text-zinc-400",
          "selection:bg-royal/20 dark:selection:bg-royal-light/20"
        )}
        placeholder="Search or enter URL..."
      />

      {/* Right section - Search/Action */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center justify-center",
          "w-9 h-9 mr-1 rounded-lg",
          "transition-colors duration-200",
          "hover:bg-royal/10 dark:hover:bg-royal-light/10 glass:hover:bg-royal/15",
          "active:bg-royal/20 dark:active:bg-royal-light/20"
        )}
      >
        <MagnifyingGlassIcon className="w-4 h-4 text-ron-text/50 dark:text-white/50 glass:text-zinc-500" />
      </motion.button>

      {/* Bottom accent line on focus */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal dark:via-royal-light to-transparent"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{
          scaleX: isFocused ? 1 : 0,
          opacity: isFocused ? 0.6 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  )
}