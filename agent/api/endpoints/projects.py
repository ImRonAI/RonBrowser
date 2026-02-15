"""
Project management endpoints with Supabase persistence.

Supports:
- Projects (top-level containers)
- Tasks (within projects)
- Documents (within projects)
- Initiatives (within projects)
"""

from typing import List, Optional
from datetime import datetime
from enum import Enum
from fastapi import APIRouter, HTTPException, Path as PathParam, Query
from pydantic import BaseModel, Field

from agent.api.core.config import SUPABASE_URL, SUPABASE_KEY

router = APIRouter()

# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------

class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    BLOCKED = "blocked"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DocumentType(str, Enum):
    NOTE = "note"
    SPECIFICATION = "specification"
    DESIGN = "design"
    RESEARCH = "research"
    MEETING = "meeting"
    OTHER = "other"


class InitiativeStatus(str, Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Project models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    metadata: Optional[dict] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    metadata: Optional[dict] = None


class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    metadata: Optional[dict] = None


# Task models
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    parent_task_id: Optional[str] = None
    metadata: Optional[dict] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    parent_task_id: Optional[str] = None
    metadata: Optional[dict] = None


class Task(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    parent_task_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[dict] = None


# Document models
class DocumentCreate(BaseModel):
    title: str
    content: str
    doc_type: DocumentType = DocumentType.NOTE
    metadata: Optional[dict] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doc_type: Optional[DocumentType] = None
    metadata: Optional[dict] = None


class Document(BaseModel):
    id: str
    project_id: str
    title: str
    content: str
    doc_type: DocumentType
    created_at: datetime
    updated_at: datetime
    metadata: Optional[dict] = None


# Initiative models
class InitiativeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: InitiativeStatus = InitiativeStatus.PLANNED
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    metadata: Optional[dict] = None


class InitiativeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[InitiativeStatus] = None
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    metadata: Optional[dict] = None


class Initiative(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    status: InitiativeStatus
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    metadata: Optional[dict] = None


# -----------------------------------------------------------------------------
# Supabase Client (initialized lazily)
# -----------------------------------------------------------------------------

_supabase_client = None


def get_supabase():
    """Get Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except ImportError:
            raise HTTPException(status_code=500, detail="Supabase client not installed")
    return _supabase_client


# -----------------------------------------------------------------------------
# Project Endpoints
# -----------------------------------------------------------------------------

@router.post("/", response_model=Project, status_code=201)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    try:
        supabase = get_supabase()
        result = supabase.table("projects").insert({
            "name": project.name,
            "description": project.description,
            "status": project.status.value,
            "metadata": project.metadata or {}
        }).execute()
        
        if result.data:
            return Project(**result.data[0])
        raise HTTPException(status_code=500, detail="Failed to create project")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[Project])
async def list_projects(
    status: Optional[ProjectStatus] = Query(None, description="Filter by status")
):
    """List all projects."""
    try:
        supabase = get_supabase()
        query = supabase.table("projects").select("*")
        
        if status:
            query = query.eq("status", status.value)
        
        result = query.execute()
        return [Project(**p) for p in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str = PathParam(..., description="Project ID")):
    """Get a specific project."""
    try:
        supabase = get_supabase()
        result = supabase.table("projects").select("*").eq("id", project_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return Project(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_update: ProjectUpdate,
    project_id: str = PathParam(..., description="Project ID")
):
    """Update a project."""
    try:
        supabase = get_supabase()
        
        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if project_update.name is not None:
            update_data["name"] = project_update.name
        if project_update.description is not None:
            update_data["description"] = project_update.description
        if project_update.status is not None:
            update_data["status"] = project_update.status.value
        if project_update.metadata is not None:
            update_data["metadata"] = project_update.metadata
        
        result = supabase.table("projects").update(update_data).eq("id", project_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return Project(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(project_id: str = PathParam(..., description="Project ID")):
    """Delete a project and all its related data."""
    try:
        supabase = get_supabase()
        
        # Delete related data first
        supabase.table("tasks").delete().eq("project_id", project_id).execute()
        supabase.table("documents").delete().eq("project_id", project_id).execute()
        supabase.table("initiatives").delete().eq("project_id", project_id).execute()
        
        # Delete project
        result = supabase.table("projects").delete().eq("id", project_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {"status": "deleted", "project_id": project_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Task Endpoints (nested under projects)
# -----------------------------------------------------------------------------

@router.post("/{project_id}/tasks", response_model=Task, status_code=201)
async def create_task(
    task: TaskCreate,
    project_id: str = PathParam(..., description="Project ID")
):
    """Create a new task in a project."""
    try:
        supabase = get_supabase()
        
        # Verify project exists
        project = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        result = supabase.table("tasks").insert({
            "project_id": project_id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "assignee": task.assignee,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "parent_task_id": task.parent_task_id,
            "metadata": task.metadata or {}
        }).execute()
        
        if result.data:
            return Task(**result.data[0])
        raise HTTPException(status_code=500, detail="Failed to create task")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/tasks", response_model=List[Task])
async def list_project_tasks(
    project_id: str = PathParam(..., description="Project ID"),
    status: Optional[TaskStatus] = Query(None, description="Filter by status")
):
    """List all tasks in a project."""
    try:
        supabase = get_supabase()
        
        query = supabase.table("tasks").select("*").eq("project_id", project_id)
        
        if status:
            query = query.eq("status", status.value)
        
        result = query.execute()
        return [Task(**t) for t in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str = PathParam(..., description="Task ID")):
    """Get a specific task."""
    try:
        supabase = get_supabase()
        result = supabase.table("tasks").select("*").eq("id", task_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return Task(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tasks/{task_id}", response_model=Task)
async def update_task(
    task_update: TaskUpdate,
    task_id: str = PathParam(..., description="Task ID")
):
    """Update a task."""
    try:
        supabase = get_supabase()
        
        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if task_update.title is not None:
            update_data["title"] = task_update.title
        if task_update.description is not None:
            update_data["description"] = task_update.description
        if task_update.status is not None:
            update_data["status"] = task_update.status.value
        if task_update.priority is not None:
            update_data["priority"] = task_update.priority.value
        if task_update.assignee is not None:
            update_data["assignee"] = task_update.assignee
        if task_update.due_date is not None:
            update_data["due_date"] = task_update.due_date.isoformat()
        if task_update.parent_task_id is not None:
            update_data["parent_task_id"] = task_update.parent_task_id
        if task_update.metadata is not None:
            update_data["metadata"] = task_update.metadata
        
        result = supabase.table("tasks").update(update_data).eq("id", task_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return Task(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str = PathParam(..., description="Task ID")):
    """Delete a task."""
    try:
        supabase = get_supabase()
        result = supabase.table("tasks").delete().eq("id", task_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {"status": "deleted", "task_id": task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Document Endpoints (nested under projects)
# -----------------------------------------------------------------------------

@router.post("/{project_id}/documents", response_model=Document, status_code=201)
async def create_document(
    document: DocumentCreate,
    project_id: str = PathParam(..., description="Project ID")
):
    """Create a new document in a project."""
    try:
        supabase = get_supabase()
        
        # Verify project exists
        project = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        result = supabase.table("documents").insert({
            "project_id": project_id,
            "title": document.title,
            "content": document.content,
            "doc_type": document.doc_type.value,
            "metadata": document.metadata or {}
        }).execute()
        
        if result.data:
            return Document(**result.data[0])
        raise HTTPException(status_code=500, detail="Failed to create document")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/documents", response_model=List[Document])
async def list_project_documents(
    project_id: str = PathParam(..., description="Project ID"),
    doc_type: Optional[DocumentType] = Query(None, description="Filter by type")
):
    """List all documents in a project."""
    try:
        supabase = get_supabase()
        
        query = supabase.table("documents").select("*").eq("project_id", project_id)
        
        if doc_type:
            query = query.eq("doc_type", doc_type.value)
        
        result = query.execute()
        return [Document(**d) for d in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}", response_model=Document)
async def get_document(document_id: str = PathParam(..., description="Document ID")):
    """Get a specific document."""
    try:
        supabase = get_supabase()
        result = supabase.table("documents").select("*").eq("id", document_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return Document(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/documents/{document_id}", response_model=Document)
async def update_document(
    doc_update: DocumentUpdate,
    document_id: str = PathParam(..., description="Document ID")
):
    """Update a document."""
    try:
        supabase = get_supabase()
        
        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if doc_update.title is not None:
            update_data["title"] = doc_update.title
        if doc_update.content is not None:
            update_data["content"] = doc_update.content
        if doc_update.doc_type is not None:
            update_data["doc_type"] = doc_update.doc_type.value
        if doc_update.metadata is not None:
            update_data["metadata"] = doc_update.metadata
        
        result = supabase.table("documents").update(update_data).eq("id", document_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return Document(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str = PathParam(..., description="Document ID")):
    """Delete a document."""
    try:
        supabase = get_supabase()
        result = supabase.table("documents").delete().eq("id", document_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"status": "deleted", "document_id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Initiative Endpoints (nested under projects)
# -----------------------------------------------------------------------------

@router.post("/{project_id}/initiatives", response_model=Initiative, status_code=201)
async def create_initiative(
    initiative: InitiativeCreate,
    project_id: str = PathParam(..., description="Project ID")
):
    """Create a new initiative in a project."""
    try:
        supabase = get_supabase()
        
        # Verify project exists
        project = supabase.table("projects").select("id").eq("id", project_id).execute()
        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        result = supabase.table("initiatives").insert({
            "project_id": project_id,
            "name": initiative.name,
            "description": initiative.description,
            "status": initiative.status.value,
            "start_date": initiative.start_date.isoformat() if initiative.start_date else None,
            "target_date": initiative.target_date.isoformat() if initiative.target_date else None,
            "metadata": initiative.metadata or {}
        }).execute()
        
        if result.data:
            return Initiative(**result.data[0])
        raise HTTPException(status_code=500, detail="Failed to create initiative")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/initiatives", response_model=List[Initiative])
async def list_project_initiatives(
    project_id: str = PathParam(..., description="Project ID"),
    status: Optional[InitiativeStatus] = Query(None, description="Filter by status")
):
    """List all initiatives in a project."""
    try:
        supabase = get_supabase()
        
        query = supabase.table("initiatives").select("*").eq("project_id", project_id)
        
        if status:
            query = query.eq("status", status.value)
        
        result = query.execute()
        return [Initiative(**i) for i in result.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/initiatives/{initiative_id}", response_model=Initiative)
async def get_initiative(initiative_id: str = PathParam(..., description="Initiative ID")):
    """Get a specific initiative."""
    try:
        supabase = get_supabase()
        result = supabase.table("initiatives").select("*").eq("id", initiative_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Initiative not found")
        
        return Initiative(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/initiatives/{initiative_id}", response_model=Initiative)
async def update_initiative(
    init_update: InitiativeUpdate,
    initiative_id: str = PathParam(..., description="Initiative ID")
):
    """Update an initiative."""
    try:
        supabase = get_supabase()
        
        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if init_update.name is not None:
            update_data["name"] = init_update.name
        if init_update.description is not None:
            update_data["description"] = init_update.description
        if init_update.status is not None:
            update_data["status"] = init_update.status.value
        if init_update.start_date is not None:
            update_data["start_date"] = init_update.start_date.isoformat()
        if init_update.target_date is not None:
            update_data["target_date"] = init_update.target_date.isoformat()
        if init_update.metadata is not None:
            update_data["metadata"] = init_update.metadata
        
        result = supabase.table("initiatives").update(update_data).eq("id", initiative_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Initiative not found")
        
        return Initiative(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/initiatives/{initiative_id}")
async def delete_initiative(initiative_id: str = PathParam(..., description="Initiative ID")):
    """Delete an initiative."""
    try:
        supabase = get_supabase()
        result = supabase.table("initiatives").delete().eq("id", initiative_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Initiative not found")
        
        return {"status": "deleted", "initiative_id": initiative_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
