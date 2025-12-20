import { motion } from 'framer-motion'
import { SearchBar } from '@/components/home/SearchBar'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'

export function HomePage() {
  const { user } = useAuthStore()
  const { answers } = useOnboardingStore()

  // Derive interests from onboarding answers
  const interests = answers.find(a => a.question.includes('topics'))?.answer || 'Technology, AI, Design'
  const topics = interests.split(',').map(t => t.trim()).slice(0, 4)

  return (
    <div className="h-full flex flex-col bg-ron-white dark:bg-ron-black glass:bg-transparent noise-texture relative overflow-hidden">

      {/* Subtle ambient depth - not distracting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(45, 59, 135, 0.03) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(74, 59, 135, 0.02) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Hero Section */}
      <div className="flex-shrink-0 px-8 pt-24 pb-16 z-10 relative">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {user && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-raleway font-raleway-bold tracking-wider uppercase text-royal dark:text-royal-light"
              >
                Welcome back, {user.name}
              </motion.p>
            )}
            <h1 className="text-6xl md:text-7xl font-georgia text-ron-text dark:text-white leading-tight">
              What would you like to explore?
            </h1>
          </motion.div>

          <SearchBar />
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 px-8 pb-12 overflow-auto z-10">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-georgia text-ron-text dark:text-white">
              Curated for you
            </h2>
            {topics.length > 0 && (
              <div className="flex gap-2">
                {topics.map((topic, i) => (
                  <motion.span
                    key={topic}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * i }}
                    className="
                      px-3 py-1.5
                      glass-frosted
                      text-xs font-raleway font-raleway-bold
                      text-ron-text dark:text-white
                      rounded-sm
                    "
                  >
                    {topic}
                  </motion.span>
                ))}
              </div>
            )}
          </div>

          {/* Content Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "The Future of Agentic Interfaces",
                description: "How multi-agent systems are revolutionizing the way we interact with the web.",
                category: "Technology"
              },
              {
                title: "Glass Design in Modern UI",
                description: "Exploring the resurgence of glassmorphism in contemporary interface design.",
                category: "Design"
              },
              {
                title: "AI-Powered Browsing",
                description: "Understanding how artificial intelligence is reshaping web navigation and discovery.",
                category: "AI"
              },
              {
                title: "Voice Interface Evolution",
                description: "The transformation of voice-based interactions in browser applications.",
                category: "Technology"
              },
              {
                title: "Minimalist Web Aesthetics",
                description: "How less-is-more philosophy is defining the future of web design.",
                category: "Design"
              },
              {
                title: "Personalization Algorithms",
                description: "Deep dive into content curation and recommendation systems.",
                category: "AI"
              }
            ].map((item, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.1 * i,
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="
                  group
                  relative
                  glass-ultra
                  rounded-sm
                  p-8
                  cursor-pointer
                  transition-all duration-500 ease-smooth
                  hover:shadow-glass-hover
                  hover:-translate-y-1
                "
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-sm pointer-events-none">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'radial-gradient(circle at top right, rgba(45, 59, 135, 0.05), transparent)',
                    }}
                  />
                </div>

                <div className="relative space-y-4">
                  <span className="text-xs font-raleway font-raleway-bold tracking-wider uppercase text-royal dark:text-royal-light">
                    {item.category}
                  </span>
                  <h3 className="text-xl font-georgia text-ron-text dark:text-white leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm font-raleway font-raleway-light text-ron-text/60 dark:text-white/60 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Accent line */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal to-transparent"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
