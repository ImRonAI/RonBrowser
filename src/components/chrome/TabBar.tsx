import { motion, AnimatePresence } from 'framer-motion'
import { PlusIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useTabStore } from '@/stores/tabStore'
import { cn } from '@/utils/cn'

export function TabBar() {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab } = useTabStore()

  return (
    <div className="flex items-center h-11 px-5">
      {/* Subtle top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ron-text/5 dark:via-white/5 glass:via-zinc-400/20 to-transparent" />

      {/* New Tab Button */}
      <motion.button
        onClick={() => createTab()}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center justify-center w-8 h-8 mr-3",
          "rounded-lg transition-colors duration-200",
          "hover:bg-white/60 dark:hover:bg-white/5 glass:hover:bg-white/40",
          "active:bg-white/80 dark:active:bg-white/10"
        )}
        aria-label="New Tab"
      >
        <PlusIcon className="w-4 h-4 text-ron-text/50 dark:text-white/50 glass:text-zinc-500" />
      </motion.button>

      {/* Tabs */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <AnimatePresence mode="popLayout">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id
            const isRonTab = tab.url?.startsWith('ron://')
            
            return (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, scale: 0.9, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group relative flex items-center gap-2.5 px-4 py-2 cursor-pointer",
                  "min-w-[140px] max-w-[240px]",
                  "rounded-lg transition-all duration-200",
                  isActive
                    ? [
                        "glass-ultra",
                        "shadow-sm"
                      ]
                    : [
                        "hover:bg-white/50 dark:hover:bg-white/5 glass:hover:bg-white/30",
                        "bg-transparent"
                      ]
                )}
              >
                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-royal via-royal-purple to-royal dark:from-royal-light dark:via-royal-purple dark:to-royal-light rounded-full"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}

                {/* Tab favicon */}
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-4 h-4 flex-shrink-0 rounded-sm" />
                ) : isRonTab ? (
                  <SparklesIcon className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive 
                      ? "text-royal dark:text-royal-light glass:text-royal" 
                      : "text-ron-text/40 dark:text-white/40 glass:text-zinc-500"
                  )} />
                ) : (
                  <div className={cn(
                    "w-4 h-4 rounded-full flex-shrink-0",
                    isActive
                      ? "bg-royal dark:bg-royal-light glass:bg-royal"
                      : "bg-ron-text/20 dark:bg-white/20 glass:bg-zinc-400/50"
                  )} />
                )}

                {/* Tab title */}
                <span className={cn(
                  "flex-1 text-xs truncate font-raleway transition-colors",
                  isActive
                    ? "text-ron-text dark:text-white glass:text-zinc-800 font-raleway-bold"
                    : "text-ron-text/60 dark:text-white/60 glass:text-zinc-600"
                )}>
                  {tab.title}
                </span>

                {/* Close button */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "p-1 rounded-md transition-all duration-200",
                    "opacity-0 group-hover:opacity-100",
                    "hover:bg-ron-text/10 dark:hover:bg-white/10 glass:hover:bg-zinc-400/30"
                  )}
                  aria-label="Close Tab"
                >
                  <XMarkIcon className="w-3 h-3 text-ron-text/50 dark:text-white/50 glass:text-zinc-500" />
                </motion.button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
