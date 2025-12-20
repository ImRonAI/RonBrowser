import { useState } from 'react'
import { motion } from 'framer-motion'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      console.log('Searching:', query)
      // TODO: Implement search
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-3xl mx-auto"
    >
      <form onSubmit={handleSearch}>
        <motion.div
          className={`
            relative overflow-hidden
            transition-all duration-500 ease-smooth
            ${isFocused ? 'glass-ultra shadow-glass-hover' : 'glass-frosted shadow-glass'}
          `}
          style={{
            borderRadius: '2px',
          }}
        >
          {/* Glow effect on focus */}
          {isFocused && (
            <motion.div
              className="absolute inset-0 -z-10 opacity-30"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.3, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                background: 'radial-gradient(circle at center, rgba(45, 59, 135, 0.15), transparent 70%)',
                filter: 'blur(20px)',
              }}
            />
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask anything..."
            className="
              w-full px-8 py-5
              bg-transparent
              outline-none
              text-lg
              text-ron-text dark:text-white
              font-georgia
              placeholder:text-ron-text/30 dark:placeholder:text-white/30
              placeholder:font-raleway placeholder:font-raleway-light
              transition-all duration-300
            "
            autoComplete="off"
          />

          {/* Subtle underline indicator */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: isFocused ? 1 : 0,
              opacity: isFocused ? 1 : 0,
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>

        {/* Command hint */}
        {!isFocused && !query && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-4 text-center"
          >
            <p className="text-sm font-raleway font-raleway-light text-ron-text/40 dark:text-white/40">
              Press <kbd className="px-2 py-1 rounded bg-white/10 dark:bg-white/5 font-raleway-bold text-xs">/</kbd> for commands
            </p>
          </motion.div>
        )}
      </form>
    </motion.div>
  )
}
