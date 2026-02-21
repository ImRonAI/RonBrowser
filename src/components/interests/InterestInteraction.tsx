import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { X, Play, FileText, MessageSquare, Briefcase, Bot, ArrowLeft } from 'lucide-react'
import { WebPreview, WebPreviewBody } from '@/components/ai-elements/web-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAgentUi } from '@/context/AgentUiContext'
import { enqueueAgentPanelMessage } from '@/services/agentChatBridge'
import { useTaskStore } from '@/stores/taskStore'
import {
  OpenIn,
  OpenInContent,
  OpenInTrigger,
  OpenInChatGPT,
  OpenInClaude,
  OpenInScira,
  OpenInT3,
  OpenInCursor,
} from '@/components/ai-elements/open-in-chat'

// Interface for the Story object (matching HomePage.tsx)
interface Story {
  title: string
  url: string
  description: string
  age: string
  topic: string
  hostname: string
  thumbnail: string
}

interface InterestsPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  story: Story | null
}

export function InterestsPreviewModal({ isOpen, onClose, story }: InterestsPreviewModalProps) {
  if (!story) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-5xl w-full h-[80vh] p-0 gap-0 overflow-hidden bg-surface-950 border-surface-800 flex flex-col rounded-xl border shadow-2xl">
             {/* Header / Actions Bar */}
             <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur-md z-50">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-white/70 hover:text-white hover:bg-white/10 gap-2 pl-2 pr-3" 
                        onClick={onClose}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    
                    <div className="h-4 w-px bg-white/10" />

                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                            {story.url.includes('youtube') || story.url.includes('video') ? (
                                <Play className="w-4 h-4" />
                            ) : (
                                <FileText className="w-4 h-4" />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h3 className="text-sm font-medium text-white truncate max-w-[400px]">{story.title}</h3>
                            <span className="text-xs text-white/50 truncate">{story.hostname}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <InterestsActionMenu story={story} />
                    <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
             </div>

             {/* Content Area - Using WebPreview properly */}
             <div className="flex-1 w-full min-h-0 bg-black relative">
                <WebPreview
                    defaultUrl={story.url}
                    className="size-full border-none rounded-none bg-transparent flex flex-col"
                >
                   <WebPreviewBody className="flex-1 size-full" />
                </WebPreview>
             </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

function InterestsActionMenu({ story }: { story: Story }) {
  const { openPanel } = useAgentUi()
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  
  // Construct a useful prompt for external tools
  const analysisPrompt = `Analyze this content: ${story.title}\nURL: ${story.url}\nDescription: ${story.description}`

  const handleStartInAgentPanel = () => {
    openPanel()
    const prompt = `I'm interested in this content: ${story.title} (${story.url}). \n\nDescription: ${story.description}. \n\nPlease help me analyze this.`
    enqueueAgentPanelMessage({ text: prompt })
  }

  // NOTE: "Start in Building Agent" currently just opens the Agent Panel as a fallback
  const handleStartInBuildingAgent = () => {
      handleStartInAgentPanel()
  }

  return (
    <>
      <OpenIn query={analysisPrompt}>
        <OpenInTrigger>
          <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2">
             <MessageSquare className="w-4 h-4" />
             Open in Chat
          </Button>
        </OpenInTrigger>
        <OpenInContent align="end" className="w-64 bg-surface-900 border-surface-800 text-white">
          <DropdownMenuLabel>Ron Workflows</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          
          <DropdownMenuItem onClick={handleStartInAgentPanel} className="focus:bg-indigo-600 focus:text-white cursor-pointer gap-2">
            <Bot className="w-4 h-4" />
            Start in Agent Panel
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleStartInBuildingAgent} className="focus:bg-purple-600 focus:text-white cursor-pointer gap-2">
            <Bot className="w-4 h-4 text-purple-300" />
            Start in SuperAgent
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setTaskModalOpen(true)} className="focus:bg-emerald-600 focus:text-white cursor-pointer gap-2">
            <Briefcase className="w-4 h-4" />
            Start in Task...
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuLabel>External Tools</DropdownMenuLabel>
          
          <OpenInChatGPT />
          <OpenInClaude />
          <OpenInScira />
          <OpenInT3 />
          <OpenInCursor />
          
        </OpenInContent>
      </OpenIn>

      <TaskSelectionModal 
        isOpen={taskModalOpen} 
        onClose={() => setTaskModalOpen(false)} 
        story={story} 
      />
    </>
  )
}

function TaskSelectionModal({ isOpen, onClose, story }: { isOpen: boolean, onClose: () => void, story: Story }) {
  const { tasks } = useTaskStore()
  const { openPanel } = useAgentUi()
  
  const [newTaskInput, setNewTaskInput] = useState('')
  const [filter, setFilter] = useState('')

  const handleExistingTask = async (taskId: string) => {
    // Send json object to Ron Tab Agent within that task (simulated via sendMessage)
    const task = tasks.find(t => t.id === taskId)
    const prompt = `[CONTEXT: Existing Task "${task?.title}" (ID: ${taskId})]\nI found this content relevant to the task:\n\nTitle: ${story.title}\nURL: ${story.url}\n\nPlease integrate this info.`
    
    openPanel()
    enqueueAgentPanelMessage({ text: prompt })
    onClose()
  }

  const handleNewTask = async () => {
    if (!newTaskInput.trim()) return

    const prompt = `Please create a new task.\n\nTask Details: ${newTaskInput}\n\nSource Content:\nTitle: ${story.title}\nURL: ${story.url}\nDescription: ${story.description}\n\nCreate this task now.`
    
    openPanel()
    enqueueAgentPanelMessage({ text: prompt })
    onClose()
  }

  const filteredTasks = tasks.filter(t => 
      t.title.toLowerCase().includes(filter.toLowerCase()) && 
      t.status !== 'done'
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-surface-900 border-surface-800 text-white">
        <DialogHeader>
          <DialogTitle>Start in Task</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 mt-2">
            {/* New Task Section */}
            <div className="space-y-2 pb-4 border-b border-white/10">
                <label className="text-xs font-semibold uppercase text-white/50 tracking-wider">New Task</label>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Describe the new task..." 
                        value={newTaskInput}
                        onChange={(e) => setNewTaskInput(e.target.value)}
                        className="bg-black/20 border-white/10 text-white placeholder:text-white/30"
                        onKeyDown={(e) => e.key === 'Enter' && handleNewTask()}
                    />
                    <Button onClick={handleNewTask} disabled={!newTaskInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                        Create
                    </Button>
                </div>
            </div>

            {/* Existing Tasks Section */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-white/50 tracking-wider">Existing Tasks</label>
                <Input 
                    placeholder="Search tasks..." 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-8 text-xs bg-black/20 border-white/10 text-white mb-2"
                />
                
                <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10 pr-1">
                    {filteredTasks.length === 0 ? (
                        <p className="text-sm text-white/30 text-center py-2">No matching tasks found</p>
                    ) : (
                        filteredTasks.map(task => (
                            <button
                                key={task.id}
                                onClick={() => handleExistingTask(task.id)}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
                            >
                                <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">{task.title}</div>
                                <div className="text-[10px] text-white/40 flex items-center justify-between">
                                    <span>{new Date(task.updatedAt).toLocaleDateString()}</span>
                                    <span className="capitalize">{task.status}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
