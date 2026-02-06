import { useMemo, useState, useEffect } from 'react'
import { Dialog, DialogActions, DialogBody, DialogTitle } from '@catalyst/dialog'
import { Button } from '@catalyst/button'
import { useProjectsStore, projectSelectors } from '@/stores/projectsStore'
import {
  IssuePriority,
  IssueStatus,
  IssueTypeKey,
  ProjectTypeKey,
  PROJECT_TYPE_SCHEMES,
  ISSUE_PRIORITY_CONFIG,
  ISSUE_STATUS_CONFIG,
  ISSUE_TYPE_CONFIG,
} from '@/types/projects'

interface CreateProjectDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectDialog({ isOpen, onClose }: CreateProjectDialogProps) {
  const { createProject } = useProjectsStore()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [type, setType] = useState<ProjectTypeKey>('software-development')
  const [summary, setSummary] = useState('')

  const reset = () => {
    setName('')
    setKey('')
    setType('software-development')
    setSummary('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    createProject({ name: name.trim(), key: key.trim() || undefined, type, summary })
    handleClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} size="lg">
      <DialogTitle>Create Project</DialogTitle>
      <DialogBody className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="Optional"
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjectTypeKey)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              {Object.values(PROJECT_TYPE_SCHEMES).map((scheme) => (
                <option key={scheme.key} value={scheme.key}>
                  {scheme.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What is this project about?"
            className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm min-h-[120px]"
          />
        </div>
      </DialogBody>
      <DialogActions className="mt-6 border-t border-white/10 pt-4 justify-end gap-2">
        <Button
          outline
          onClick={handleClose}
          className="rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-wide"
        >
          Cancel
        </Button>
        <Button
          color="indigo"
          onClick={handleSubmit}
          className="rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-wide"
        >
          Create Project
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface CreateIssueDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  parentId?: string | null
  initialStatus?: IssueStatus
  initialType?: IssueTypeKey
  allowParentSelection?: boolean
}

export function CreateIssueDialog({
  isOpen,
  onClose,
  projectId,
  parentId,
  initialStatus,
  initialType,
  allowParentSelection = false,
}: CreateIssueDialogProps) {
  const { projects, issues, people, createIssue } = useProjectsStore()
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || projects[0]?.id || '')
  const [selectedType, setSelectedType] = useState<IssueTypeKey>(initialType || 'task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<IssueStatus>(initialStatus || 'backlog')
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [assignee, setAssignee] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [parent, setParent] = useState<string | null>(parentId ?? null)
  const [error, setError] = useState<string | null>(null)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const scheme = selectedProject ? PROJECT_TYPE_SCHEMES[selectedProject.type] : null

  const allowedTypes = useMemo(() => {
    if (!scheme) return []
    if (parent) {
      const parentIssue = issues.find((issue) => issue.id === parent)
      if (!parentIssue) return []
      return projectSelectors.getAllowedChildTypes(parentIssue.type)
    }
    return scheme.issueTypes.filter((type) => projectSelectors.isRootTypeAllowed(type))
  }, [scheme, parent, issues])

  const parentOptions = useMemo(() => {
    if (!selectedProject) return []
    const requiredParentType = STANDARD_PARENT_BY_CHILD[selectedType]
    if (!allowParentSelection || !requiredParentType) return []
    return issues.filter((issue) =>
      issue.projectId === selectedProject.id &&
      issue.type === requiredParentType
    )
  }, [selectedProject, selectedType, issues, allowParentSelection])

  useEffect(() => {
    if (allowedTypes.length === 0) return
    if (!allowedTypes.includes(selectedType)) {
      setSelectedType(allowedTypes[0])
    }
  }, [allowedTypes, selectedType])

  const reset = () => {
    setSelectedProjectId(projectId || projects[0]?.id || '')
    setSelectedType(initialType || 'task')
    setTitle('')
    setDescription('')
    setStatus(initialStatus || 'backlog')
    setPriority('medium')
    setAssignee('')
    setDueDate('')
    setParent(parentId ?? null)
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    const result = createIssue({
      projectId: selectedProjectId,
      title: title.trim(),
      type: selectedType,
      description: description.trim(),
      status,
      priority,
      assignees: assignee ? [assignee] : [],
      dueDate: dueDate || undefined,
      parentId: parent || undefined,
    })

    if (result.error) {
      setError(result.error)
      return
    }

    handleClose()
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} size="xl">
      <DialogTitle>Create Issue</DialogTitle>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as IssueTypeKey)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {ISSUE_TYPE_CONFIG[type]?.label ?? type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {allowParentSelection && parentOptions.length > 0 && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Parent</label>
            <select
              value={parent || ''}
              onChange={(e) => setParent(e.target.value || null)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              <option value="">No parent</option>
              {parentOptions.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              {Object.keys(ISSUE_STATUS_CONFIG).map((key) => (
                <option key={key} value={key}>
                  {ISSUE_STATUS_CONFIG[key as IssueStatus].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              {Object.keys(ISSUE_PRIORITY_CONFIG).map((key) => (
                <option key={key} value={key}>
                  {ISSUE_PRIORITY_CONFIG[key as IssuePriority].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Assignee</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            >
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-ink-inverse-muted">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2 w-full rounded-xl glass-subtle border border-white/10 dark:border-white/10 px-4 py-3 text-body-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-body-xs text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}
      </DialogBody>
      <DialogActions className="mt-6 border-t border-white/10 pt-4 justify-end gap-2">
        <Button
          outline
          onClick={handleClose}
          className="rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-wide"
        >
          Cancel
        </Button>
        <Button
          color="indigo"
          onClick={handleSubmit}
          className="rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-wide"
        >
          Create Issue
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const STANDARD_PARENT_BY_CHILD: Record<IssueTypeKey, IssueTypeKey | null> = {
  initiative: null,
  epic: 'initiative',
  story: 'epic',
  task: 'story',
  subtask: 'task',
}
