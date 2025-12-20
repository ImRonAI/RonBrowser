import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { useOnboardingStore, INTERVIEW_QUESTIONS } from '@/stores/onboardingStore'
import { useAuthStore } from '@/stores/authStore'
import { ChevronRightIcon, ChatBubbleBottomCenterTextIcon, MicrophoneIcon } from '@heroicons/react/24/outline'
import { VoiceOnboardingScene } from '@/components/voice-agent'

export function OnboardingPage() {
  const { user } = useAuthStore()
  const {
    mode,
    currentStep,
    currentQuestionIndex,
    setMode,
    nextStep,
    nextQuestion,
    setAnswer,
    completeOnboarding,
    addReasoningStep
  } = useOnboardingStore()
  
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on step change
  useEffect(() => {
    if (currentStep === 'interview') {
      setTimeout(() => inputRef.current?.focus(), 500)
    }
  }, [currentStep, currentQuestionIndex])

  // Handle Input Submit
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim()) return

    const currentQuestion = INTERVIEW_QUESTIONS[currentQuestionIndex]
    setAnswer(currentQuestion, inputValue)
    setInputValue('')
    nextQuestion()
  }

  // Handle Reasoning Simulation
  useEffect(() => {
    if (currentStep === 'reasoning') {
      const steps = [
        { type: 'thinking', content: 'Analyzing responses...' },
        { type: 'search', content: 'Identifying key interest clusters...' },
        { type: 'tool-use', content: 'Generating personal profile...' },
        { type: 'conclusion', content: 'Profile calibration complete.' }
      ]

      let delay = 0
      steps.forEach((step, index) => {
        delay += 1500
        setTimeout(() => {
          addReasoningStep(step.type, step.content)
          if (index === steps.length - 1) {
            setTimeout(completeOnboarding, 1000)
          }
        }, delay)
      })
    }
  }, [currentStep, addReasoningStep, completeOnboarding])

  // Variants for animations
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  }

  // Render Logic
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-zinc-50 dark:bg-zinc-950 p-8 overflow-hidden relative">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none" />

      <div className="max-w-2xl w-full z-10">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: MODE SELECTION */}
          {currentStep === 'mode-selection' && (
            <motion.div
              key="mode-selection"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-12 text-center"
            >
              <div className="space-y-4">
                <Heading level={1} className="!text-5xl font-light">Welcome, {user?.name || 'Explorer'}.</Heading>
                <Text className="text-xl text-zinc-500">How would you like to set up your experience?</Text>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button
                  onClick={() => setMode('type')}
                  className="group relative p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500 transition-all text-left space-y-4 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                    <ChatBubbleBottomCenterTextIcon className="w-8 h-8 text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                  <div>
                    <Heading level={3}>Text Interview</Heading>
                    <Text className="mt-2">Answer a few questions at your own pace to personalize your feed.</Text>
                  </div>
                </button>

                <button
                  onClick={() => setMode('talk')}
                  className="group relative p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-500 transition-all text-left space-y-4 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                    <MicrophoneIcon className="w-8 h-8 text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                  <div>
                    <Heading level={3}>Voice Calibration</Heading>
                    <Text className="mt-2">Have a natural conversation with our AI agent to set up your profile.</Text>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: INTERVIEW - TEXT MODE */}
          {currentStep === 'interview' && mode === 'type' && (
            <motion.div
              key={`question-${currentQuestionIndex}`}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-8"
            >
               <div className="space-y-2">
                <Text className="text-blue-600 dark:text-blue-400 font-medium tracking-wider uppercase text-sm">
                    Question {currentQuestionIndex + 1} of {INTERVIEW_QUESTIONS.length}
                </Text>
                <Heading level={2} className="!text-3xl sm:!text-4xl leading-tight">
                    {INTERVIEW_QUESTIONS[currentQuestionIndex]}
                </Heading>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative group">
                    <div className="overflow-x-auto scrollbar-none pr-28">
                      <input
                          ref={inputRef}
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full min-w-full bg-transparent border-b-2 border-zinc-200 dark:border-zinc-800 text-2xl py-4 group-hover:border-blue-500 focus:border-blue-500 outline-none transition-colors dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                          autoFocus
                      />
                    </div>
                     <div className="absolute right-0 bottom-4 flex items-center space-x-2 text-sm text-zinc-400 bg-zinc-50 dark:bg-zinc-950 pl-4">
                        <span>Press Enter ↵</span>
                    </div>
                </div>
                
                <div className="flex justify-end">
                    <Button type="submit" color="blue" className="!text-lg !px-8 !py-3 rounded-full" disabled={!inputValue.trim()}>
                        Next <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </Button>
                </div>
               </form>
            </motion.div>
          )}

          {/* STEP 2: INTERVIEW - VOICE MODE */}
          {currentStep === 'interview' && mode === 'talk' && (
            <VoiceOnboardingScene
              onComplete={() => nextStep()}
              onSkip={() => setMode('type')}
            />
          )}

          {/* STEP 3: REASONING */}
          {currentStep === 'reasoning' && (
            <motion.div
              key="reasoning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-8"
            >
                <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <Heading level={2}>Calibrating your experience...</Heading>
                <div className="h-8 overflow-hidden relative">
                    <AnimatePresence mode="popLayout">
                        {useOnboardingStore.getState().reasoning.steps.slice(-1).map((step) => (
                             <motion.div
                                key={step.timestamp}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className="text-zinc-500 font-mono text-sm"
                             >
                                {step.content}
                             </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </motion.div>
          )}

           {/* STEP 4: COMPLETE (Handled by redirect usually, but just in case) */}
           {currentStep === 'complete' && (
            <motion.div
              key="complete"
              variants={pageVariants}
              initial="initial"
              animate="animate"
               className="text-center space-y-6"
            >
                 <Heading level={1}>All Set!</Heading>
                 <Text>Redirecting you to your personalized home...</Text>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      
      {/* Progress Bar */}
      {currentStep === 'interview' && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-500 ease-out" 
             style={{ width: `${((currentQuestionIndex) / INTERVIEW_QUESTIONS.length) * 100}%` }} 
        />
      )}
    </div>
  )
}
