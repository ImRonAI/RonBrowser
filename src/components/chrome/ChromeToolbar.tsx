import { motion } from 'framer-motion'
import { ArrowLeftIcon, ArrowRightIcon, HomeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid'
import { UrlBar } from './UrlBar'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/utils/cn'

// Navigation button component for consistency
function NavButton({ 
  onClick, 
  label, 
  children,
  disabled = false 
}: { 
  onClick: () => void
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        "hover:bg-white/60 dark:hover:bg-white/5 glass:hover:bg-white/40",
        "active:bg-white/80 dark:active:bg-white/10 glass:active:bg-white/50",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        "group"
      )}
      aria-label={label}
    >
      <div className="text-ron-text/60 dark:text-white/60 glass:text-zinc-600 group-hover:text-ron-text dark:group-hover:text-white glass:group-hover:text-zinc-900 transition-colors">
        {children}
      </div>
    </motion.button>
  )
}

export function ChromeToolbar() {
  const { togglePanel, isPanelOpen } = useAgentStore()

  return (
    <div className="flex items-center h-16 px-5 drag-region">
      {/* Traffic lights space (macOS) */}
      <div className="w-20 flex-shrink-0" />

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1 no-drag">
        <NavButton onClick={() => console.log('Home')} label="Home">
          <HomeIcon className="w-[18px] h-[18px]" />
        </NavButton>
        <NavButton onClick={() => console.log('Back')} label="Go back">
          <ArrowLeftIcon className="w-[18px] h-[18px]" />
        </NavButton>
        <NavButton onClick={() => console.log('Forward')} label="Go forward">
          <ArrowRightIcon className="w-[18px] h-[18px]" />
        </NavButton>
        <NavButton onClick={() => console.log('Reload')} label="Reload page">
          <ArrowPathIcon className="w-[18px] h-[18px]" />
        </NavButton>
      </div>

      {/* URL Bar - with generous spacing */}
      <div className="flex-1 mx-6 no-drag">
        <UrlBar />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3 no-drag">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Subtle divider */}
        <div className="w-px h-6 bg-ron-text/10 dark:bg-white/10 glass:bg-zinc-400/30" />

        {/* Agent Panel Trigger */}
        <motion.button
          onClick={togglePanel}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative p-2.5 rounded-xl transition-all duration-300",
            isPanelOpen
              ? "bg-royal dark:bg-royal-light glass:bg-royal shadow-lg"
              : "hover:bg-white/60 dark:hover:bg-white/5 glass:hover:bg-white/40"
          )}
          aria-label="Open Agent Panel"
        >
          <ChatBubbleLeftRightIcon 
            className={cn(
              "w-5 h-5 transition-colors",
              isPanelOpen
                ? "text-white"
                : "text-royal dark:text-royal-light glass:text-royal"
            )} 
          />
          {/* Subtle glow when active */}
          {isPanelOpen && (
            <motion.div
              className="absolute inset-0 rounded-xl bg-royal/20 dark:bg-royal-light/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.2 }}
              transition={{ duration: 0.3 }}
              style={{ filter: 'blur(8px)', zIndex: -1 }}
            />
          )}
        </motion.button>

        {/* User Menu */}
        <UserMenu />
      </div>
    </div>
  )
}
