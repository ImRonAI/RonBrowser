import { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { SearchBar } from '@/components/home/SearchBar'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { KanbanBoard, CalendarView } from '@/components/board'

type HomeTab = 'discover' | 'tasks' | 'calendar' | 'superagent' | 'vibe'
type CalendarMode = 'day' | 'week' | 'month'

// Sophisticated easing curve
const EASE = [0.16, 1, 0.3, 1] as const

export function HomePage() {
  const { user } = useAuthStore()
  const { answers } = useOnboardingStore()
  const [activeTab, setActiveTab] = useState<HomeTab>('discover')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week')

  // Derive interests from onboarding answers
  const interests = answers.find(a => a.question.includes('topics'))?.answer || 'Technology, AI, Design'
  const topics = interests.split(',').map(t => t.trim()).slice(0, 4)

  return (
    <div className="h-full flex flex-col bg-surface-0 dark:bg-surface-900 relative overflow-hidden">
      {/* Sophisticated background treatment */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Light mode - subtle geometric accents */}
        <div className="dark:hidden">
          <div 
            className="absolute top-0 right-0 w-[600px] h-[600px]"
            style={{
              background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.04) 0%, transparent 50%)',
            }}
          />
          <div 
            className="absolute bottom-0 left-0 w-[500px] h-[500px]"
            style={{
              background: 'radial-gradient(circle at bottom left, rgba(55, 48, 163, 0.03) 0%, transparent 50%)',
            }}
          />
          {/* Subtle grid */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          />
        </div>
        
        {/* Dark mode - dramatic gradient */}
        <div className="hidden dark:block">
        <motion.div
            className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 60%)',
              filter: 'blur(80px)',
          }}
          animate={{
              x: [0, 20, 0],
              y: [0, -15, 0],
          }}
          transition={{
              duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
            className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full"
          style={{
              background: 'radial-gradient(circle, rgba(76, 29, 149, 0.05) 0%, transparent 60%)',
              filter: 'blur(80px)',
          }}
          animate={{
              x: [0, -20, 0],
              y: [0, 15, 0],
          }}
          transition={{
              duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        </div>
      </div>

      {/* Hero Section - Centered Navigation */}
      <div className="flex-shrink-0 px-8 pt-8 pb-6 z-10 relative">
        <div className="max-w-7xl mx-auto">
          {/* Centered Tab Navigation - The Soul of Ron */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="flex justify-center mb-8"
          >
            <HomeTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          </motion.div>

          {/* Dynamic Title */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="text-center mb-8"
          >
            {user && activeTab === 'discover' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-label uppercase tracking-[0.25em] text-accent dark:text-accent-light mb-2"
              >
                Welcome back, {user.name}
              </motion.p>
            )}
          </motion.div>

          {/* Search Bar - Only on discover */}
          <AnimatePresence mode="wait">
            {activeTab === 'discover' && (
              <motion.div
                key="searchbar"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="max-w-3xl mx-auto overflow-hidden"
              >
                <SearchBar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-hidden z-10">
        <LayoutGroup>
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'discover' && (
              <motion.div
                key="discover"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full px-8 pb-12 overflow-auto scrollbar-thin"
              >
                <DiscoverContent topics={topics} />
              </motion.div>
            )}
            {activeTab === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full px-8 pb-8"
              >
                <KanbanBoard />
              </motion.div>
            )}
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full px-8 pb-8"
              >
                <CalendarView mode={calendarMode} onModeChange={setCalendarMode} />
              </motion.div>
            )}
            {activeTab === 'superagent' && (
              <motion.div
                key="superagent"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full px-8 pb-8 flex items-center justify-center"
              >
                <SuperAgentPlaceholder />
              </motion.div>
            )}
            {activeTab === 'vibe' && (
              <motion.div
                key="vibe"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="h-full px-8 pb-8 flex items-center justify-center"
              >
                <VibePlaceholder />
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION - Premium Centered Navigation
// The Soul of Ron Browser
// ─────────────────────────────────────────────────────────────────────────────

interface HomeTabNavigationProps {
  activeTab: HomeTab
  onTabChange: (tab: HomeTab) => void
}

const TAB_CONFIG: { id: HomeTab; label: string; icon: (isActive: boolean) => React.ReactNode }[] = [
  {
    id: 'discover',
    label: 'Discover',
    icon: (isActive) => (
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        animate={{ rotate: isActive ? 360 : 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </motion.svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (isActive) => (
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        animate={{ y: isActive ? [0, -2, 0] : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <rect x="3" y="3" width="5" height="18" rx="1.5" />
        <rect x="9.5" y="6" width="5" height="15" rx="1.5" />
        <rect x="16" y="9" width="5" height="12" rx="1.5" />
      </motion.svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (isActive) => (
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        animate={{ scale: isActive ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="15" r="2" className={isActive ? 'fill-current' : ''} />
      </motion.svg>
    ),
  },
  {
    id: 'superagent',
    label: 'SuperAgent',
    icon: (isActive) => (
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        animate={{
          rotate: isActive ? [0, 10, -10, 0] : 0,
          scale: isActive ? 1.05 : 1
        }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </motion.svg>
    ),
  },
  {
    id: 'vibe',
    label: 'Vibe',
    icon: (isActive) => (
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        animate={{
          y: isActive ? [0, -3, 0] : 0,
          rotate: isActive ? [0, -5, 5, 0] : 0
        }}
        transition={{ duration: 0.6, ease: EASE, repeat: isActive ? Infinity : 0, repeatDelay: 2 }}
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </motion.svg>
    ),
  },
]

function HomeTabNavigation({ activeTab, onTabChange }: HomeTabNavigationProps) {
  const activeIndex = TAB_CONFIG.findIndex(t => t.id === activeTab)

  return (
    <div className="relative">
      {/* Outer glow effect */}
      <motion.div
        className="absolute -inset-1 rounded-2xl opacity-50 blur-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 50%, rgba(99, 102, 241, 0.2) 100%)',
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Main container */}
      <div className="
        relative flex items-center gap-1 p-1.5
        rounded-2xl
        bg-surface-0/80 dark:bg-surface-850/80
        backdrop-blur-xl
        border border-surface-200/50 dark:border-surface-700/50
        shadow-bold dark:shadow-dark-bold
      ">
        {/* Animated pill indicator */}
        <motion.div
          className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-light shadow-glow-accent"
          layoutId="nav-pill"
          initial={false}
          animate={{
            left: `calc(${activeIndex * 20}% + 6px)`,
            width: `calc(20% - 8px)`,
          }}
          transition={{
            type: 'spring',
            stiffness: 350,
            damping: 30,
          }}
        />

        {TAB_CONFIG.map((tab, _index) => {
          const isActive = activeTab === tab.id
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              whileHover={{ scale: isActive ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative z-10 flex items-center justify-center gap-2
                px-5 py-3 min-w-[100px]
                rounded-xl
                text-body-sm font-medium tracking-wide
                transition-all duration-300
                ${isActive
                  ? 'text-white'
                  : 'text-ink-muted dark:text-ink-inverse-muted hover:text-ink dark:hover:text-ink-inverse'
                }
              `}
            >
              <motion.span
                animate={{
                  scale: isActive ? 1.1 : 1,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                {tab.icon(isActive)}
              </motion.span>
              <motion.span
                animate={{
                  fontWeight: isActive ? 600 : 500,
                }}
                className="hidden sm:inline"
              >
                {tab.label}
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SuperAgentPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <motion.div
        className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-glow-accent-lg"
        animate={{
          rotate: [0, 5, -5, 0],
          scale: [1, 1.02, 1]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-12 h-12">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </motion.div>
      <div>
        <h2 className="text-display-sm font-display text-ink dark:text-ink-inverse">SuperAgent</h2>
        <p className="text-body-md text-ink-muted dark:text-ink-inverse-muted mt-2">
          AI-powered automation coming soon
        </p>
      </div>
    </motion.div>
  )
}

function VibePlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <motion.div
        className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
        animate={{
          y: [0, -8, 0],
          rotate: [0, -3, 3, 0]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-12 h-12">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </motion.div>
      <div>
        <h2 className="text-display-sm font-display text-ink dark:text-ink-inverse">Vibe</h2>
        <p className="text-body-md text-ink-muted dark:text-ink-inverse-muted mt-2">
          Your personalized atmosphere
        </p>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVER CONTENT - Curated content cards
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverContent({ topics }: { topics: string[] }) {
  return (
    <div className="max-w-7xl mx-auto space-y-10 pt-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-display-sm font-display text-ink dark:text-ink-inverse">
          Curated for you
        </h2>
          <p className="mt-1 text-body-sm text-ink-muted dark:text-ink-inverse-muted">
            Personalized content based on your interests
          </p>
        </div>
        
        {topics.length > 0 && (
          <div className="flex gap-2">
            {topics.map((topic, i) => (
              <motion.span
                key={topic}
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4, ease: EASE }}
                className="pill"
              >
                {topic}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: "The Future of Agentic Interfaces",
            description: "How multi-agent systems are revolutionizing the way we interact with the web.",
            category: "Technology",
            gradient: "from-accent/10 to-accent-light/5",
          },
          {
            title: "Minimal Design in Modern UI",
            description: "Exploring the power of restraint in contemporary interface design.",
            category: "Design",
            gradient: "from-purple-500/10 to-violet-500/5",
          },
          {
            title: "AI-Powered Browsing",
            description: "Understanding how artificial intelligence is reshaping web navigation and discovery.",
            category: "AI",
            gradient: "from-emerald-500/10 to-teal-500/5",
          },
          {
            title: "Voice Interface Evolution",
            description: "The transformation of voice-based interactions in browser applications.",
            category: "Technology",
            gradient: "from-sky-500/10 to-blue-500/5",
          },
          {
            title: "Bold Typography Systems",
            description: "How type choices define the character of digital experiences.",
            category: "Design",
            gradient: "from-rose-500/10 to-pink-500/5",
          },
          {
            title: "Personalization Algorithms",
            description: "Deep dive into content curation and recommendation systems.",
            category: "AI",
            gradient: "from-amber-500/10 to-orange-500/5",
          }
        ].map((item, i) => (
          <motion.article
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.05 * i,
              duration: 0.5,
              ease: EASE
            }}
            whileHover={{ y: -4 }}
            className="group relative card-interactive overflow-hidden"
          >
            {/* Gradient accent on hover */}
            <motion.div 
              className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
            />
            
            {/* Content */}
            <div className="relative p-7 space-y-4">
              {/* Category badge */}
              <span className="badge-accent">
                {item.category}
              </span>
              
              {/* Title */}
              <h3 className="text-body-xl font-semibold text-ink dark:text-ink-inverse leading-snug group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
                {item.title}
              </h3>
              
              {/* Description */}
              <p className="text-body-sm text-ink-secondary dark:text-ink-inverse-secondary leading-relaxed">
                {item.description}
              </p>
              
              {/* Read more link */}
              <div className="pt-2">
                <span className="text-body-sm font-medium text-accent dark:text-accent-light flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read more
                  <motion.span 
                    className="inline-block"
                    initial={{ x: 0 }}
                    whileHover={{ x: 4 }}
                  >
                    →
                  </motion.span>
                </span>
              </div>
            </div>

            {/* Bottom accent line on hover */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent dark:via-accent-light to-transparent"
              initial={{ scaleX: 0, opacity: 0 }}
              whileHover={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
            />
          </motion.article>
        ))}
      </div>
    </div>
  )
}
