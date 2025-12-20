import { Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/utils/cn'

export function AgentPanel() {
  const { isPanelOpen, closePanel, interactionMode, setInteractionMode, isViewingScreen, screenshotData } = useAgentStore()

  return (
    <Transition.Root show={isPanelOpen} as={Fragment}>
      <div className="fixed inset-y-0 right-0 z-50 flex pointer-events-none">
        <Transition.Child
          as={Fragment}
          enter="transform transition ease-smooth duration-400"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="transform transition ease-smooth duration-400"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
        >
          <div className="relative w-96 pointer-events-auto">
            {/* Glass Panel */}
            <div className="h-full glass-ultra shadow-glass-dark backdrop-blur-glass flex flex-col">

              {/* Header - Clean and minimal */}
              <div className="flex-shrink-0 px-6 py-5 flex items-center justify-between">
                <h2 className="text-lg font-georgia text-ron-text dark:text-white">
                  Ron Assistant
                </h2>
                <motion.button
                  onClick={closePanel}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1.5 rounded-sm hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-ron-text/60 dark:text-white/60" />
                </motion.button>
              </div>

              {/* Subtle separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent" />

              {/* Interaction Mode Toggle - Glass toggle, not buttons */}
              <div className="flex-shrink-0 px-6 py-5">
                <div className="relative glass-frosted rounded-sm p-1 flex">
                  {/* Sliding indicator */}
                  <motion.div
                    className="absolute inset-y-1 rounded-sm bg-royal dark:bg-royal-light"
                    initial={false}
                    animate={{
                      x: interactionMode === 'voice' ? 4 : '50%',
                      width: 'calc(50% - 8px)',
                    }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />

                  <button
                    onClick={() => setInteractionMode('voice')}
                    className={cn(
                      "relative z-10 flex-1 py-2 px-4 rounded-sm font-raleway font-raleway-bold text-sm transition-colors",
                      interactionMode === 'voice'
                        ? "text-white"
                        : "text-ron-text/60 dark:text-white/60"
                    )}
                  >
                    Voice
                  </button>
                  <button
                    onClick={() => setInteractionMode('text')}
                    className={cn(
                      "relative z-10 flex-1 py-2 px-4 rounded-sm font-raleway font-raleway-bold text-sm transition-colors",
                      interactionMode === 'text'
                        ? "text-white"
                        : "text-ron-text/60 dark:text-white/60"
                    )}
                  >
                    Type
                  </button>
                </div>
              </div>

              {/* Vision Active Indicator */}
              <AnimatePresence>
                {isViewingScreen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-shrink-0 px-6 pb-5"
                  >
                    <div className="glass-frosted rounded-sm p-4 space-y-3">
                      {/* Status header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-2 h-2 rounded-full bg-royal dark:bg-royal-light"
                            animate={{
                              opacity: [1, 0.4, 1],
                              scale: [1, 0.8, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                          <span className="text-xs font-raleway font-raleway-bold tracking-wider uppercase text-royal dark:text-royal-light">
                            Analyzing Screen
                          </span>
                        </div>
                      </div>

                      {/* Live preview thumbnail */}
                      {screenshotData && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="relative aspect-video rounded-sm overflow-hidden border border-white/10 dark:border-white/5"
                        >
                          <img
                            src={screenshotData}
                            alt="Current view"
                            className="w-full h-full object-cover"
                          />
                          {/* Scanning overlay effect */}
                          <motion.div
                            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-royal to-transparent"
                            animate={{
                              top: ['0%', '100%'],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                          />
                        </motion.div>
                      )}

                      {/* Analysis indicators */}
                      <div className="flex gap-2 text-xs">
                        <motion.div
                          className="px-2 py-1 rounded-sm bg-royal/10 dark:bg-royal-light/10 text-royal dark:text-royal-light font-raleway"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          Detecting elements
                        </motion.div>
                        <motion.div
                          className="px-2 py-1 rounded-sm bg-royal-purple/10 dark:bg-royal-light/10 text-royal-purple dark:text-royal-light font-raleway"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                        >
                          Understanding context
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Content Area */}
              <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {interactionMode === 'voice' ? (
                    <motion.div
                      key="voice"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 flex flex-col items-center justify-center px-6"
                    >
                      {/* Simple elegant voice indicator - no orb animations */}
                      <motion.div
                        className="relative"
                        animate={{
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <div className="w-20 h-20 rounded-full glass-ultra border-2 border-royal dark:border-royal-light" />
                        <div className="absolute inset-0 rounded-full bg-royal/10 dark:bg-royal-light/10" />
                      </motion.div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mt-8 text-sm text-ron-text/60 dark:text-white/60 font-raleway font-raleway-light"
                      >
                        Press <kbd className="px-2 py-1 rounded-sm glass-frosted font-raleway-bold text-xs">Space</kbd> to talk
                      </motion.p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="text"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 flex flex-col"
                    >
                      {/* Messages Area */}
                      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                        {/* Empty state */}
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className="font-raleway font-raleway-light text-ron-text/40 dark:text-white/40 text-center">
                            Start a conversation with Ron
                          </p>
                        </div>

                        {/* Example message structure (for when we add messages) */}
                        {/* <div className="space-y-2">
                          <div className="glass-frosted rounded-sm px-4 py-3">
                            <p className="text-sm font-raleway text-ron-text dark:text-white">
                              User message here
                            </p>
                          </div>
                          <div className="glass-ultra rounded-sm px-4 py-3">
                            <p className="text-sm font-raleway text-ron-text dark:text-white">
                              Ron's response here
                            </p>
                          </div>
                        </div> */}
                      </div>

                      {/* Input Area - Glass input at bottom */}
                      <div className="flex-shrink-0 p-6">
                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent mb-6" />
                        <div className="relative glass-frosted rounded-sm overflow-hidden">
                          <input
                            type="text"
                            placeholder="Type your message..."
                            className="
                              w-full px-4 py-3
                              bg-transparent
                              outline-none
                              text-sm
                              text-ron-text dark:text-white
                              font-raleway font-raleway-light
                              placeholder:text-ron-text/30 dark:placeholder:text-white/30
                            "
                            autoComplete="off"
                          />
                          {/* Subtle focus indicator */}
                          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal to-transparent opacity-0 focus-within:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}
