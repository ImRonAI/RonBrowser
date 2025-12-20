import { motion } from 'framer-motion'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@/hooks/useTheme'

// Glass/Crystal icon component
function GlassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  // Calculate indicator position: light=0, dark=1, glass=2
  const getPosition = () => {
    if (theme === 'light' || theme === 'system') return 0
    if (theme === 'dark') return 1
    return 2 // glass
  }

  const position = getPosition()

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="
        relative
        w-[72px] h-7
        glass-frosted
        rounded-full
        p-1
        transition-all duration-300
        hover:shadow-glass
      "
      title={`Theme: ${theme} (click to cycle)`}
    >
      {/* Sliding indicator */}
      <motion.div
        className={`
          absolute top-1 left-1
          w-5 h-5
          rounded-full
          shadow-md
          ${theme === 'glass'
            ? 'bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/50'
            : 'bg-gradient-to-br from-royal to-royal-purple dark:from-royal-light dark:to-royal-purple'
          }
        `}
        animate={{
          x: position * 22,
        }}
        transition={{
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
        }}
      />

      {/* Icons */}
      <div className="relative flex items-center justify-between h-full px-0.5">
        <motion.div
          animate={{
            opacity: position === 0 ? 1 : 0.4,
            scale: position === 0 ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          <SunIcon className="w-4 h-4 text-royal dark:text-royal-light glass:text-ron-text/70" />
        </motion.div>
        <motion.div
          animate={{
            opacity: position === 1 ? 1 : 0.4,
            scale: position === 1 ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          <MoonIcon className="w-4 h-4 text-royal dark:text-royal-light glass:text-ron-text/70" />
        </motion.div>
        <motion.div
          animate={{
            opacity: position === 2 ? 1 : 0.4,
            scale: position === 2 ? 1 : 0.8,
          }}
          transition={{ duration: 0.2 }}
        >
          <GlassIcon className="w-4 h-4 text-royal dark:text-royal-light glass:text-ron-text/70" />
        </motion.div>
      </div>
    </motion.button>
  )
}
