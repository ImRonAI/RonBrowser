"""
Ron Browser - Search Chat API
FastAPI backend for Perplexity Sonar Pro with LanceDB persistent memory
"""

import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
from strands import Agent
from a2a.client import A2AClient
from a2a.types import (
    SendStreamingMessageRequest,
    MessageSendParams,
    Message as A2AMessage,
    TextPart,
    Role,
    TaskStatusUpdateEvent,
    TaskArtifactUpdateEvent,
)

# Fix LanceDB fork-safety warning on macOS
# This must be done before lancedb import
import multiprocessing
import platform

if platform.system() == "Darwin":
    try:
        multiprocessing.set_start_method("spawn")
    except RuntimeError:
        pass

# LanceDB for persistent memory
import lancedb
import pyarrow as pa

# Load environment variables from project root .env
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Set BYPASS_TOOL_CONSENT to bypass interactive tool confirmation prompts
# This is required for non-interactive backends (strands tools like shell,
# use_computer, file_write, editor all require terminal input otherwise)
os.environ["BYPASS_TOOL_CONSENT"] = "true"

# ─────────────────────────────────────────────────────────────────────────────
# Sandbox Setup - All agent file/shell operations default to this directory
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
LANCEDB_URI = os.getenv("LANCEDB_URI", "db://default-jxjth2")
LANCEDB_API_KEY = os.getenv("LANCEDB_API_KEY")
LANCEDB_REGION = os.getenv("LANCEDB_REGION", "us-east-1")
LANCEDB_FALLBACK_URI = os.getenv(
    "LANCEDB_FALLBACK_URI",
    str(Path(__file__).parent.parent.parent / "data" / "lancedb")
)
EMBEDDING_MODEL = "text-embedding-3-small"  # For semantic search
SUPERAGENT_SESSION_ID = os.getenv("SUPERAGENT_SESSION_ID", "ron-permanent")
SUPERAGENT_LOCK_SESSION = os.getenv("SUPERAGENT_LOCK_SESSION", "false").lower() == "true"
SUPERAGENT_BROWSER_SESSION = os.getenv("SUPERAGENT_BROWSER_SESSION", "ron-superagent")
TASK_AGENT_SESSION_ID = os.getenv("TASK_AGENT_SESSION_ID", "ron-task-agent")
TASK_AGENT_LOCK_SESSION = os.getenv("TASK_AGENT_LOCK_SESSION", "false").lower() == "true"
TASK_AGENT_BROWSER_SESSION = os.getenv("TASK_AGENT_BROWSER_SESSION", "ron-task-agent")
API_TOOL_TIMEOUT_SECONDS = int(os.getenv("API_TOOL_TIMEOUT_SECONDS", "7"))

# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str

class SearchContext(BaseModel):
    query: str
    answer: str
    sources: List[Dict[str, Any]]

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    search_context: Optional[SearchContext] = None
    model: str = "sonar-pro"

class ChatResponse(BaseModel):
    session_id: str
    message: str
    citations: List[Dict[str, Any]] = []
    
class SearchRequest(BaseModel):
    query: str
    search_filter: Optional[str] = None
    search_domain_filter: Optional[List[str]] = None

# ─────────────────────────────────────────────────────────────────────────────
# Memory Store (LanceDB)
# ─────────────────────────────────────────────────────────────────────────────

class ConversationMemory:
    """Persistent conversation memory using LanceDB Cloud"""

    def __init__(self):
        self.db = None
        self.sessions_table = None
        self.messages_table = None
        self._mode = "uninitialized"  # cloud | local | memory
        self._fallback_sessions: Dict[str, Dict[str, Any]] = {}
        self._fallback_messages: Dict[str, List[Dict[str, Any]]] = {}

    async def initialize(self):
        """Initialize LanceDB Cloud connection and tables"""
        def ensure_tables():
            if "sessions" not in self.db.list_tables():
                schema = pa.schema([
                    pa.field("session_id", pa.string()),
                    pa.field("created_at", pa.string()),
                    pa.field("updated_at", pa.string()),
                    pa.field("search_query", pa.string()),
                    pa.field("search_answer", pa.string()),
                    pa.field("sources_json", pa.string()),
                ])
                self.db.create_table("sessions", schema=schema)
            self.sessions_table = self.db.open_table("sessions")

            if "messages" not in self.db.list_tables():
                schema = pa.schema([
                    pa.field("id", pa.string()),
                    pa.field("session_id", pa.string()),
                    pa.field("role", pa.string()),
                    pa.field("content", pa.string()),
                    pa.field("citations_json", pa.string()),
                    pa.field("created_at", pa.string()),
                ])
                self.db.create_table("messages", schema=schema)
            self.messages_table = self.db.open_table("messages")

        # Prefer cloud when configured; fall back to local or in-memory on failure.
        if isinstance(LANCEDB_URI, str) and LANCEDB_URI.startswith("db://"):
            try:
                client_config = {
                    "retry_config": {"retries": 1, "connect_retries": 1, "read_retries": 1},
                    "timeout_config": {"timeout": 15, "connect_timeout": 5, "read_timeout": 10},
                }
                self.db = lancedb.connect(
                    uri=LANCEDB_URI,
                    api_key=LANCEDB_API_KEY,
                    region=LANCEDB_REGION,
                    client_config=client_config,
                )
                ensure_tables()
                self._mode = "cloud"
                logger.info(f"LanceDB Cloud connected to {LANCEDB_URI}")
                return
            except Exception as e:
                logger.error(f"LanceDB Cloud init failed, falling back to local: {e}")

        try:
            self.db = lancedb.connect(LANCEDB_FALLBACK_URI)
            ensure_tables()
            self._mode = "local"
            logger.info(f"LanceDB Local connected to {LANCEDB_FALLBACK_URI}")
        except Exception as e:
            self.db = None
            self.sessions_table = None
            self.messages_table = None
            self._mode = "memory"
            logger.error(f"LanceDB local init failed; using in-memory store: {e}")

    def create_session(self, search_context: Optional[SearchContext] = None) -> str:
        """Create a new chat session"""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        session_data = {
            "session_id": session_id,
            "created_at": now,
            "updated_at": now,
            "search_query": search_context.query if search_context else "",
            "search_answer": search_context.answer if search_context else "",
            "sources_json": json.dumps(search_context.sources) if search_context else "[]",
        }
        
        if self.sessions_table:
            self.sessions_table.add([session_data])
        else:
            self._fallback_sessions[session_id] = session_data
        logger.info(f"Created session: {session_id}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID"""
        try:
            if self.sessions_table:
                results = self.sessions_table.search().where(
                    f"session_id = '{session_id}'"
                ).limit(1).to_list()
                return results[0] if results else None
            return self._fallback_sessions.get(session_id)
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return None
    
    def add_message(
        self, 
        session_id: str, 
        role: str, 
        content: str,
        citations: List[Dict[str, Any]] = None
    ):
        """Add a message to the session"""
        message_data = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "role": role,
            "content": content,
            "citations_json": json.dumps(citations or []),
            "created_at": datetime.utcnow().isoformat(),
        }
        
        if self.messages_table:
            self.messages_table.add([message_data])
        else:
            self._fallback_messages.setdefault(session_id, []).append(message_data)
        
        # Update session timestamp
        # Note: LanceDB doesn't support updates well, so we track via messages
        
    def get_messages(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent messages for a session"""
        try:
            if self.messages_table:
                results = self.messages_table.search().where(
                    f"session_id = '{session_id}'"
                ).limit(limit).to_list()
            else:
                results = list(self._fallback_messages.get(session_id, []))[-limit:]
            
            # Sort by created_at
            results.sort(key=lambda x: x.get("created_at", ""))
            return results
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []

    def list_sessions(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List recent sessions for UI."""
        try:
            if self.sessions_table:
                results = self.sessions_table.search().limit(limit).to_list()
            else:
                results = list(self._fallback_sessions.values())
            results.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            return results
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
            return []
    
    def build_context(self, session_id: str, max_messages: int = 10) -> List[Dict[str, str]]:
        """Build conversation context for API call"""
        messages = []
        
        # Get session for search context
        session = self.get_session(session_id)
        if session and session.get("search_query"):
            # Add search context as system message
            sources_summary = ""
            try:
                sources = json.loads(session.get("sources_json", "[]"))
                if sources:
                    sources_summary = "\n\nRelevant sources:\n" + "\n".join(
                        f"- {s.get('title', 'Unknown')}: {s.get('url', '')}"
                        for s in sources[:5]
                    )
            except:
                pass
                
            system_content = f"""You are a helpful AI assistant continuing a conversation about a search the user performed.

Original search query: {session.get('search_query')}

Initial search answer summary:
{session.get('search_answer')[:2000] if session.get('search_answer') else 'No initial answer'}
{sources_summary}

Continue helping the user explore this topic. You can reference the search results and provide additional insights. Be conversational and helpful."""

            messages.append({"role": "system", "content": system_content})
        
        # Add conversation history
        history = self.get_messages(session_id, limit=max_messages)
        for msg in history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
            
        return messages

# Global memory instance
memory = ConversationMemory()

# ─────────────────────────────────────────────────────────────────────────────
# Perplexity API Client
# ─────────────────────────────────────────────────────────────────────────────

async def stream_perplexity_chat(
    messages: List[Dict[str, str]],
    model: str = "sonar-pro"
) -> AsyncGenerator[str, None]:
    """Stream chat completion from Perplexity API"""
    
    if not PERPLEXITY_API_KEY:
        yield json.dumps({"error": "PERPLEXITY_API_KEY not configured"})
        return
        
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }
    
    async with httpx.AsyncClient(timeout=API_TOOL_TIMEOUT_SECONDS) as client:
        async with client.stream(
            "POST",
            PERPLEXITY_API_URL,
            headers=headers,
            json=payload,
        ) as response:
            if response.status_code != 200:
                error = await response.aread()
                yield json.dumps({
                    "error": f"API error {response.status_code}: {error.decode()}"
                })
                return
                
            citations = []
            full_content = ""
            
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        # Send final message with citations
                        yield json.dumps({
                            "type": "done",
                            "citations": citations,
                            "full_content": full_content
                        })
                        break
                        
                    try:
                        chunk = json.loads(data)
                        
                        # Extract citations if present
                        if "citations" in chunk:
                            citations = chunk["citations"]
                            
                        # Extract content delta
                        if chunk.get("choices"):
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                full_content += content
                                yield json.dumps({
                                    "type": "content",
                                    "content": content
                                })
                                
                    except json.JSONDecodeError:
                        continue

async def perplexity_search(
    query: str,
    search_filter: Optional[str] = None,
    search_domain_filter: Optional[List[str]] = None,
    model: str = "sonar-pro"
) -> AsyncGenerator[str, None]:
    """Stream search results from Perplexity API"""
    
    if not PERPLEXITY_API_KEY:
        yield json.dumps({"error": "PERPLEXITY_API_KEY not configured"})
        return
        
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": query}],
        "stream": True,
    }
    
    if search_filter:
        payload["search_filter"] = search_filter
    if search_domain_filter:
        payload["search_domain_filter"] = search_domain_filter
    
    async with httpx.AsyncClient(timeout=API_TOOL_TIMEOUT_SECONDS) as client:
        async with client.stream(
            "POST",
            PERPLEXITY_API_URL,
            headers=headers,
            json=payload,
        ) as response:
            if response.status_code != 200:
                error = await response.aread()
                yield json.dumps({
                    "type": "error",
                    "error": f"API error {response.status_code}: {error.decode()}"
                })
                return
                
            citations = []
            full_content = ""
            
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        yield json.dumps({
                            "type": "done",
                            "citations": citations,
                            "full_content": full_content
                        })
                        break
                        
                    try:
                        chunk = json.loads(data)
                        
                        # Extract citations if present
                        if "citations" in chunk:
                            citations = chunk["citations"]
                            yield json.dumps({
                                "type": "citations",
                                "citations": citations
                            })
                            
                        # Extract content delta
                        if chunk.get("choices"):
                            delta = chunk["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                full_content += content
                                yield json.dumps({
                                    "type": "content",
                                    "content": content
                                })
                                
                    except json.JSONDecodeError:
                        continue

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup"""
    await memory.initialize()

    # NOTE: MCP gateway is NOT pre-loaded to avoid exceeding tool limits (200 max)
    # The agent has access to load_mcp_server() and can dynamically load tools when needed
    logger.info("Backend started. Agent can use load_mcp_server('gateway') when needed.")
    
    # Only initialize Playwright - don't create sessions yet
    # Sessions are created per-chat in the /superagent/stream endpoint
    try:
        if sa._global_browser:
            logger.info("Initializing Playwright (CDP will connect on first chat)...")
            await sa._global_browser._start()  # Initialize Playwright only
            logger.info("Playwright Ready! �")
    except Exception as e:
        logger.error(f"Playwright Init Failed: {e}")
        
    yield
    # Cleanup: close all browser sessions
    if sa._global_browser:
        await sa._global_browser._cleanup()

    # Stop any dynamically loaded MCP servers
    try:
        if "gateway" in sa._mcp_clients:
            sa.unload_mcp_server(server_id="gateway")
    except Exception as e:
        logger.debug(f"MCP gateway cleanup: {e}")

app = FastAPI(
    title="Ron Browser Search Chat API",
    description="Perplexity-powered search chat with persistent memory",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "api_key_configured": bool(PERPLEXITY_API_KEY)}

@app.post("/search/stream")
async def search_stream(request: SearchRequest):
    """Stream search results from Perplexity"""
    return StreamingResponse(
        perplexity_search(
            query=request.query,
            search_filter=request.search_filter,
            search_domain_filter=request.search_domain_filter,
        ),
        media_type="text/event-stream",
    )

@app.post("/chat/start")
async def start_chat(request: ChatRequest):
    """Start a new chat session with search context"""
    session_id = memory.create_session(request.search_context)
    return {"session_id": session_id}

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat response with conversation memory"""
    
    # Get or create session
    session_id = request.session_id
    if not session_id:
        session_id = memory.create_session(request.search_context)
    
    # Add user message to memory
    memory.add_message(session_id, "user", request.message)
    
    # Build context from memory
    messages = memory.build_context(session_id)
    
    # Add current message if not already in history
    if not messages or messages[-1].get("content") != request.message:
        messages.append({"role": "user", "content": request.message})
    
    async def generate():
        full_response = ""
        citations = []
        
        async for chunk in stream_perplexity_chat(messages, request.model):
            data = json.loads(chunk)
            
            if data.get("type") == "content":
                full_response += data["content"]
                yield f"data: {chunk}\n\n"
                
            elif data.get("type") == "done":
                citations = data.get("citations", [])
                # Save assistant response to memory
                memory.add_message(session_id, "assistant", full_response, citations)
                yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'citations': citations})}\n\n"
                
            elif data.get("error"):
                yield f"data: {chunk}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id,
        }
    )

@app.get("/sessions")
async def list_sessions():
    """List all available chat sessions"""
    try:
        results = memory.list_sessions(limit=100)
        
        return [
            {
                "session_id": s["session_id"],
                "created_at": s["created_at"],
                "updated_at": s.get("updated_at", s["created_at"]),
                "summary": s.get("search_query", "New Chat")[:50] or "New Chat"
            }
            for s in results
        ]
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        return []

@app.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    session = memory.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = memory.get_messages(session_id)

    return {
        "session_id": session_id,
        "search_context": {
            "query": session.get("search_query"),
            "answer": session.get("search_answer"),
            "sources": json.loads(session.get("sources_json", "[]")),
        },
        "messages": [
            {
                "role": msg["role"],
                "content": msg["content"],
                "citations": json.loads(msg.get("citations_json", "[]")),
                "created_at": msg.get("created_at"),
            }
            for msg in messages
        ]
    }

@app.post("/api/sonar-reasoning-pro/stream")
async def sonar_reasoning_pro_stream(request: Request):
    """Streaming endpoint for Perplexity sonar-reasoning-pro model with reasoning tokens"""
    try:
        body = await request.json()
        messages = body.get("messages", [])
        reasoning_effort = body.get("reasoning_effort", "high")
        search_domain_filter = body.get("search_domain_filter", [])
        search_recency_filter = body.get("search_recency_filter")
        temperature = body.get("temperature", 0.2)
        max_tokens = body.get("max_tokens", 8192)

        if reasoning_effort not in ["low", "medium", "high"]:
            reasoning_effort = "high"
        temperature = max(0.0, min(0.5, temperature))

        perplexity_key = os.getenv("PERPLEXITY_API_KEY")
        if not perplexity_key:
            return JSONResponse(status_code=500, content={"error": "PERPLEXITY_API_KEY not configured"})

        client = OpenAI(api_key=perplexity_key, base_url="https://api.perplexity.ai")

        async def generate():
            try:
                params = {
                    "model": "sonar-reasoning-pro",
                    "messages": messages,
                    "stream": True,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "reasoning_effort": reasoning_effort,
                    "return_citations": True,
                    "return_images": True,
                }

                if search_domain_filter:
                    params["search_domain_filter"] = search_domain_filter
                if search_recency_filter:
                    params["search_recency_filter"] = search_recency_filter

                stream = client.chat.completions.create(**params)
                citations = []
                images = []
                search_results = []
                reasoning_content = ""
                main_content = ""

                for chunk in stream:
                    if not chunk.choices:
                        continue

                    choice = chunk.choices[0]

                    if choice.delta and choice.delta.content:
                        content = choice.delta.content

                        if "<think>" in content or "</think>" in content:
                            if "<think>" in content:
                                parts = content.split("<think>")
                                if len(parts) > 1:
                                    main_content += parts[0]
                                    reasoning_content += parts[1]
                                    if parts[0]:
                                        yield f"data: {json.dumps({'type': 'content', 'content': parts[0]})}\n\n"
                                    yield f"data: {json.dumps({'type': 'reasoning_start'})}\n\n"

                            if "</think>" in content:
                                parts = content.split("</think>")
                                reasoning_content += parts[0]
                                yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning_content})}\n\n"
                                yield f"data: {json.dumps({'type': 'reasoning_end'})}\n\n"
                                reasoning_content = ""
                                if len(parts) > 1:
                                    main_content += parts[1]
                                    yield f"data: {json.dumps({'type': 'content', 'content': parts[1]})}\n\n"
                        else:
                            if reasoning_content:
                                reasoning_content += content
                            else:
                                main_content += content
                                yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"

                    if hasattr(chunk, 'citations') and chunk.citations:
                        citations = chunk.citations
                    if hasattr(chunk, 'images') and chunk.images:
                        images = chunk.images
                    if hasattr(chunk, 'search_results') and chunk.search_results:
                        search_results = [{"title": r.get("title", ""), "url": r.get("url", ""), "date": r.get("date", ""), "snippet": r.get("snippet", "")} for r in chunk.search_results]

                    if choice.finish_reason:
                        metadata = {"type": "metadata", "citations": citations, "images": images, "search_results": search_results, "finish_reason": choice.finish_reason}
                        yield f"data: {json.dumps(metadata)}\n\n"
                        break

                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# ─────────────────────────────────────────────────────────────────────────────
# Search Agent Endpoint (AI Elements format for SearchAgentDisplay)
# ─────────────────────────────────────────────────────────────────────────────

class SearchAgentRequest(BaseModel):
    query: str
    session_id: Optional[str] = "search-default"


@app.post("/api/search-agent/stream")
async def search_agent_stream(request: Request):
    """
    Search agent endpoint that streams Strands search agent output in AI SDK UIMessageStream format.
    Expected by SearchAgentDisplay.tsx component.
    """
    body = await request.json()
    query = body.get("query", "")
    session_id = body.get("session_id", "search-default")

    if not query:
        return JSONResponse(status_code=400, content={"error": "Query is required"})

    queue = asyncio.Queue()
    saw_finish = False
    saw_done = False
    saw_callback_events = False
    using_stream_fallback = False
    fallback_logged = False
    emitter = AISDKStreamEmitter()

    def emit_common(sse_event: str):
        nonlocal saw_finish, saw_done
        if '"type": "finish"' in sse_event:
            saw_finish = True
        if "[DONE]" in sse_event:
            saw_done = True
        queue.put_nowait(sse_event)

    def emit_from_callback(sse_event: str):
        nonlocal saw_callback_events
        if using_stream_fallback:
            return
        saw_callback_events = True
        emit_common(sse_event)

    def emit_from_stream(sse_event: str):
        nonlocal using_stream_fallback, fallback_logged
        if not using_stream_fallback:
            using_stream_fallback = True
            if not fallback_logged:
                logger.warning(f"[SearchAgent] No callback events detected; using stream_async event fallback.")
                fallback_logged = True
        emit_common(sse_event)

    def emit_any(sse_event: str):
        if using_stream_fallback:
            emit_from_stream(sse_event)
        else:
            emit_from_callback(sse_event)

    callback_handler = UICallbackHandler(emit_from_callback)
    fallback_handler = UICallbackHandler(emit_from_stream)

    search_agent = create_search_agent(callback_handler=callback_handler, session_id=session_id)

    # Set current agent for global tool access
    # NOTE: MCP gateway is NOT pre-loaded to avoid exceeding tool limits (200 max)
    # The agent has load_mcp_server() available and can load tools dynamically when needed
    sa._current_agent = search_agent

    async def run_agent():
        """Run the search agent stream and let the callback handler emit SSE events."""
        async for event in search_agent.stream_async(query):
            if not saw_callback_events:
                _forward_stream_event(event, fallback_handler, emit_from_stream)

    async def emit_terminal_events_and_drain(finish_reason: str = "stop"):
        """Ensure finish + [DONE] events are emitted and drain queued output."""
        events = []
        active_handler = fallback_handler if using_stream_fallback else callback_handler
        emit_fn = emit_from_stream if using_stream_fallback else emit_from_callback
        if not active_handler.is_finished:
            active_handler.finalize(finish_reason=finish_reason)
        if not saw_finish:
            emit_fn(emitter.emit_finish(finish_reason))
        if not saw_done:
            emit_fn(emitter.emit_done())
        while not queue.empty():
            events.append(queue.get_nowait())
        return events

    async def generate():
        agent_task = asyncio.create_task(run_agent())
        agent_timed_out = False
        agent_error = None
        last_activity_time = asyncio.get_event_loop().time()
        yield_count = 0
        try:
            while not agent_task.done():
                time_since_activity = asyncio.get_event_loop().time() - last_activity_time
                if AGENT_TIMEOUT_SECONDS > 0 and time_since_activity > AGENT_TIMEOUT_SECONDS:
                    logger.error(f"[SearchAgent] Agent silent for {time_since_activity:.1f}s - timeout")
                    agent_timed_out = True
                    agent_task.cancel()
                    try:
                        await agent_task
                    except asyncio.CancelledError:
                        pass
                    break

                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield_count += 1
                    if not _is_reasoning_event(event):
                        last_activity_time = asyncio.get_event_loop().time()
                    yield event
                except asyncio.TimeoutError:
                    if time_since_activity >= 10:
                        ping_event = emitter.emit_ping()
                        yield_count += 1
                        yield ping_event
                    continue

            if not agent_task.cancelled():
                try:
                    await agent_task
                except Exception as e:
                    logger.error(f"[SearchAgent] Agent execution error: {e}")
                    agent_error = e
                    emit_any(emitter.emit_error(str(e)))

            # Drain remaining events
            while not queue.empty():
                yield_count += 1
                yield queue.get_nowait()

            finish_reason = "timeout" if agent_timed_out else "error" if agent_error else "stop"
            if agent_timed_out and not saw_finish:
                emit_any(emitter.emit_error(f"Agent silent for {AGENT_TIMEOUT_SECONDS}s - no response"))

            if not saw_finish or not saw_done:
                terminal_events = await emit_terminal_events_and_drain(finish_reason)
                for event in terminal_events:
                    yield_count += 1
                    yield event
        except Exception as e:
            logger.error(f"[SearchAgent] Streaming error: {e}")
            emit_any(emitter.emit_error(str(e)))
            terminal_events = await emit_terminal_events_and_drain("error")
            for event in terminal_events:
                yield event

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# Superagent Endpoint (Strands-based orchestration)
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from superagent import get_or_create_session_agent, UICallbackHandler
from search_agent import create_search_agent
from task_agent import get_or_create_task_agent
from aisdk_stream import AISDKStreamEmitter
import superagent as sa

# Per-session stream locks to prevent concurrent streams clobbering handlers
_SESSION_LOCKS: dict[str, asyncio.Lock] = {}


def _get_session_lock(session_id: str) -> asyncio.Lock:
    lock = _SESSION_LOCKS.get(session_id)
    if lock is None:
        lock = asyncio.Lock()
        _SESSION_LOCKS[session_id] = lock
    return lock

# Agent silence timeout in seconds (0 disables)
# Timeout resets on each non-reasoning event - only triggers if agent goes silent.
# If agent is streaming tokens, it can run indefinitely.
AGENT_TIMEOUT_SECONDS = int(os.getenv("AGENT_TIMEOUT_SECONDS", "0"))
SANDBOX_AGENT_URL = os.getenv("SANDBOX_AGENT_URL", "http://localhost:9000")
SANDBOX_AGENT_TIMEOUT_SECONDS = int(
    os.getenv("SANDBOX_AGENT_TIMEOUT_SECONDS", str(AGENT_TIMEOUT_SECONDS))
)

def _extract_a2a_text_parts(message: A2AMessage | None) -> list[str]:
    if message is None:
        return []
    parts = getattr(message, "parts", None)
    if parts is None and isinstance(message, dict):
        parts = message.get("parts", [])
    if not parts:
        return []
    chunks: list[str] = []
    for part in parts:
        kind = getattr(part, "kind", None)
        text = getattr(part, "text", None)
        if isinstance(part, dict):
            kind = part.get("kind", kind)
            text = part.get("text", text)
        if kind == "text" and text:
            chunks.append(str(text))
    return chunks


def _is_reasoning_event(sse_event: Any) -> bool:
    if not isinstance(sse_event, str):
        return False
    if not sse_event.startswith("data:"):
        return False
    payload = sse_event[len("data:") :].strip()
    if not payload or payload == "[DONE]":
        return False
    try:
        data = json.loads(payload)
    except Exception:
        return False
    if not isinstance(data, dict):
        return False
    return data.get("type") in {"reasoning-start", "reasoning-delta", "reasoning-end"}


def _extract_a2a_text_chunks(result: Any) -> list[str]:
    if isinstance(result, TaskStatusUpdateEvent):
        message = getattr(result.status, "message", None)
        return _extract_a2a_text_parts(message)
    if isinstance(result, A2AMessage):
        return _extract_a2a_text_parts(result)
    if isinstance(result, TaskArtifactUpdateEvent):
        # Ignore artifacts for now (no UI mapping)
        return []
    return []


def _normalize_sse_chunk(chunk: str) -> str:
    if not chunk:
        return ""
    stripped = chunk.lstrip()
    if stripped.startswith("data:") or stripped.startswith(":"):
        return chunk if chunk.endswith("\n\n") else f"{chunk}\n\n"
    # Wrap raw text so frontend can append it safely
    return f"data: {json.dumps({'data': chunk})}\n\n"

# UIMessageStream v1 event types (AI SDK)
_UI_MESSAGE_EVENT_TYPES = {
    "start",
    "start-step",
    "text-start",
    "text-delta",
    "text-end",
    "reasoning-start",
    "reasoning-delta",
    "reasoning-end",
    "tool-input-start",
    "tool-input-available",
    "tool-output-available",
    "tool-output-error",
    "finish-step",
    "finish",
    "error",
    "workflow_visualization",
}

def _is_ui_message_event_type(event_type: str) -> bool:
    if not event_type:
        return False
    if event_type in _UI_MESSAGE_EVENT_TYPES:
        return True
    return event_type.startswith("data-")

def _coerce_stream_event_payload(event: Any) -> Optional[Dict[str, Any]]:
    """Best-effort conversion of stream_async events to plain dict payloads."""
    if event is None:
        return None
    if isinstance(event, dict):
        return event
    if isinstance(event, str):
        # Let caller decide how to handle raw strings
        return None
    if hasattr(event, "model_dump") and callable(getattr(event, "model_dump")):
        try:
            payload = event.model_dump()
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass
    if hasattr(event, "dict") and callable(getattr(event, "dict")):
        try:
            payload = event.dict()
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass
    if hasattr(event, "__dict__"):
        payload = {k: v for k, v in vars(event).items() if not k.startswith("_")}
        return payload or None
    return None

def _forward_stream_event(event: Any, fallback_handler, emit_fn) -> bool:
    """
    Forward a stream_async event through the fallback handler or emit it directly.
    Returns True if the event was handled.
    """
    if event is None:
        return False
    if isinstance(event, str):
        if event.lstrip().startswith(("data:", ":")):
            emit_fn(_normalize_sse_chunk(event))
        else:
            # Treat raw text as a standard data chunk
            fallback_handler(data=event)
        return True

    payload = _coerce_stream_event_payload(event)
    if not payload:
        return False

    event_type = payload.get("type")
    if isinstance(event_type, str) and _is_ui_message_event_type(event_type):
        emit_fn(_normalize_sse_chunk(f"data: {json.dumps(payload)}"))
        return True

    # Default: treat as Strands-style callback payload
    fallback_handler(**payload)
    return True


@app.post("/superagent/stream")
async def superagent_stream(request: Request):
    """
    Stream superagent responses in AI SDK v5 UIMessageStream format.
    Uses permanent agent with per-session conversation history.
    
    CRITICAL: Per AGENTS.md UIMessageStream contract, this endpoint MUST emit
    terminal events (finish + [DONE]) even on errors, timeouts, or early exits.
    If terminal events are missing, the UI stays in a non-ready state and blocks.
    """
    body = await request.json()
    logger.info(f"Received request body: {json.dumps(body, indent=2)}")

    # AI SDK v6 sends messages array with parts
    messages = body.get("messages", [])
    message = ""
    if messages:
        last_msg = messages[-1]
        # AI SDK v6 format: messages[].parts[].text
        parts = last_msg.get("parts", [])
        for part in parts:
            p_type = part.get("type")
            if p_type == "text":
                msg_text = part.get("text", "")
                if msg_text:
                    message += f"\n{msg_text}" if message else msg_text
            elif p_type in ["attachment", "file"]:
                # Handle file attachments (AI SDK v6 FileUIPart format)
                # FileUIPart = { type: 'file', mediaType: string, filename?: string, url: string }
                # The 'url' field contains a data URL (base64 encoded content)
                
                # Try direct text fields first (legacy formats)
                content = part.get("text") or part.get("content") or part.get("data")
                
                # If not found, decode from data URL
                if not content and part.get("url"):
                    url = part.get("url")
                    if url.startswith("data:"):
                        try:
                            # Parse data URL: data:[<mediatype>][;base64],<data>
                            import base64
                            comma_idx = url.find(",")
                            if comma_idx != -1:
                                header = url[5:comma_idx]  # Skip "data:"
                                encoded_data = url[comma_idx + 1:]
                                
                                if ";base64" in header:
                                    # Base64 encoded
                                    decoded_bytes = base64.b64decode(encoded_data)
                                    content = decoded_bytes.decode("utf-8", errors="replace")
                                else:
                                    # URL encoded
                                    from urllib.parse import unquote
                                    content = unquote(encoded_data)
                        except Exception as e:
                            logger.error(f"Failed to decode attachment URL: {e}")
                            content = ""
                
                filename = part.get("filename", "attachment")
                if content:
                    message += f"\n\n[Attachment: {filename}]\n{content}\n" if message else f"[Attachment: {filename}]\n{content}\n"
        # Fallback to content string (older format)
        if not message and isinstance(last_msg.get("content"), str):
            message = last_msg["content"].strip()

    # Fallback to direct message field
    if not message:
        message = body.get("message", "").strip()

    # Get session_id for this conversation (frontend must provide this)
    session_id = body.get("session_id", "default")
    logger.info(f"Session: {session_id}, Message: '{message}'")

    if not message:
        return JSONResponse(status_code=400, content={"error": "Message cannot be empty"})

    queue = asyncio.Queue()

    emit_count = 0  # Track number of events emitted for debugging
    saw_finish = False
    saw_done = False
    saw_callback_events = False
    using_stream_fallback = False
    fallback_logged = False
    emitter = AISDKStreamEmitter()

    def emit_common(sse_event: str):
        nonlocal emit_count, saw_finish, saw_done
        emit_count += 1
        if '"type": "finish"' in sse_event:
            saw_finish = True
        if "[DONE]" in sse_event:
            saw_done = True
        logger.debug(f"[Session {session_id}] Emit #{emit_count}: {sse_event[:80]}...")
        queue.put_nowait(sse_event)

    def emit_from_callback(sse_event: str):
        nonlocal saw_callback_events
        if using_stream_fallback:
            return
        saw_callback_events = True
        emit_common(sse_event)

    def emit_from_stream(sse_event: str):
        nonlocal using_stream_fallback, fallback_logged
        if not using_stream_fallback:
            using_stream_fallback = True
            if not fallback_logged:
                logger.warning(f"[Session {session_id}] No callback events detected; using stream_async event fallback.")
                fallback_logged = True
        emit_common(sse_event)

    def emit_any(sse_event: str):
        if using_stream_fallback:
            emit_from_stream(sse_event)
        else:
            emit_from_callback(sse_event)

    callback_handler = UICallbackHandler(emit_from_callback)
    fallback_handler = UICallbackHandler(emit_from_stream)

    # Use per-session agent to persist across the entire chat
    agent_session_id = SUPERAGENT_SESSION_ID if SUPERAGENT_LOCK_SESSION else session_id
    browser_session_override = SUPERAGENT_BROWSER_SESSION if SUPERAGENT_LOCK_SESSION else None
    agent, agent_created, browser_session_name = get_or_create_session_agent(
        session_id=agent_session_id,
        callback_handler=callback_handler,
        memory=None,
        browser_session_name=browser_session_override
    )

    # Save original callback handler and set per-request handler
    original_callback_handler = getattr(agent, 'callback_handler', None)
    agent.callback_handler = callback_handler

    # Load history only once per session agent
    storage_session_id = agent_session_id if SUPERAGENT_LOCK_SESSION else session_id
    if agent_created:
        db_messages = memory.get_messages(storage_session_id, limit=1000)
        session_history = []
        for msg in db_messages:
            content = msg["content"]
            if isinstance(content, str):
                content = [{"text": content}]
            session_history.append({"role": msg["role"], "content": content})
        logger.info(f"Loaded {len(session_history)} messages for session {storage_session_id}")
        agent.messages = session_history

    # Save user message immediately to prevent data loss on crash
    memory.add_message(storage_session_id, "user", message)
    logger.info(f"Saved user message to session {storage_session_id}")

    initial_msg_count = len(agent.messages)

    # Ensure this agent is set as the 'current' one for global tool access
    sa._current_agent = agent

    # NOTE: MCP gateway is NOT pre-loaded to avoid exceeding tool limits (200 max)
    # The agent has load_mcp_server() available and can load tools dynamically when needed

    # Auto-create browser session for this chat (if not exists)
    browser = sa._global_browser
    
    async def ensure_browser_session():
        """Create browser session for this chat if it doesn't exist."""
        if browser and browser_session_name not in browser._sessions:
            try:
                from strands_tools.browser.models import InitSessionAction
                action = InitSessionAction(
                    type="init_session",
                    session_name=browser_session_name,
                    description=f"Browser session for chat {session_id}"
                )
                result = await browser.init_session(action)
                logger.info(f"Created browser session: {browser_session_name} -> {result}")
                # Don't inject messages - the agent resolves session name automatically via defaults
            except Exception as e:
                logger.warning(f"Failed to create browser session: {e}")

    async def emit_terminal_events_and_drain(finish_reason: str = "stop"):
        """
        CRITICAL: Emit terminal events and yield them to ensure UI receives them.
        Per AGENTS.md: Every stream MUST emit finish + [DONE] even on errors/early exits.
        """
        nonlocal saw_finish, saw_done

        active_handler = fallback_handler if using_stream_fallback else callback_handler
        emit_fn = emit_from_stream if using_stream_fallback else emit_from_callback

        # Ask the active handler to finalize first (closes open blocks + finish-step)
        if hasattr(active_handler, "finalize"):
            active_handler.finalize(finish_reason=finish_reason)

        # Emit terminal events if not already seen (fallback)
        if not saw_finish:
            emit_fn(emitter.emit_finish(finish_reason))
        if not saw_done:
            emit_fn(emitter.emit_done())
        
        # Yield all remaining events including terminal events
        events_to_yield = []
        while not queue.empty():
            events_to_yield.append(queue.get_nowait())
        return events_to_yield

    session_lock = _get_session_lock(agent_session_id)

    async def generate():
        """
        Async generator that streams agent responses.
        
        CRITICAL GUARANTEE: This generator ALWAYS yields terminal events before returning,
        regardless of success, error, or timeout. This is required by UIMessageStream protocol.
        """
        nonlocal saw_finish, saw_done
        lock_acquired = False
        
        try:
            # Prevent concurrent streams for the same session
            try:
                await asyncio.wait_for(session_lock.acquire(), timeout=0.01)
                lock_acquired = True
            except asyncio.TimeoutError:
                emit_any(emitter.emit_error("Another request is already streaming for this session"))
                terminal_events = await emit_terminal_events_and_drain("error")
                for event in terminal_events:
                    yield event
                return

            # Use stream_async for native async tool support (browser, etc.)
            # This allows proper await of async tool methods without deadlock

            # Ensure browser session exists for this chat (with timeout to prevent hang)
            try:
                await asyncio.wait_for(ensure_browser_session(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(f"[Session {session_id}] Browser session creation timed out, continuing without it")
            except Exception as e:
                logger.warning(f"[Session {session_id}] Browser session error: {e}")

            logger.info(f"[Session {session_id}] Starting agent stream for message: {message[:100]}...")

            agent_error = None
            agent_timed_out = False

            async def run_agent():
                """Run agent once per request (no Ralph loop)."""
                nonlocal agent_error
                event_count = 0
                try:
                    async for event in agent.stream_async(message):
                        event_count += 1
                        logger.debug(f"[Session {session_id}] Agent stream event #{event_count}: {str(event)[:80]}")
                        if not saw_callback_events:
                            _forward_stream_event(event, fallback_handler, emit_from_stream)
                except Exception as e:
                    logger.error(f"[Session {session_id}] Agent stream error: {e}", exc_info=True)
                    agent_error = e
                    emit_any(emitter.emit_error(str(e)))
                    raise

                logger.info(f"[Session {session_id}] Agent stream complete. Events: {event_count}")

            # Run agent as async task with activity-based timeout
            # Timeout resets on non-reasoning events - only triggers on silence
            agent_task = asyncio.create_task(run_agent())
            last_activity_time = asyncio.get_event_loop().time()

            yield_count = 0
            try:
                # Stream events as they arrive, with activity-based timeout
                while not agent_task.done():
                    # Check time since last activity (not total elapsed)
                    time_since_activity = asyncio.get_event_loop().time() - last_activity_time
                    if AGENT_TIMEOUT_SECONDS > 0 and time_since_activity > AGENT_TIMEOUT_SECONDS:
                        logger.error(f"[Session {session_id}] Agent silent for {time_since_activity:.1f}s - timeout")
                        agent_timed_out = True
                        agent_task.cancel()
                        try:
                            await agent_task
                        except asyncio.CancelledError:
                            pass
                        break
                    
                    try:
                        # Increased timeout from 0.1s to 0.5s to handle LLM latency
                        sse_event = await asyncio.wait_for(queue.get(), timeout=0.5)
                        yield_count += 1
                        # Reset activity timer on non-reasoning events only
                        if not _is_reasoning_event(sse_event):
                            last_activity_time = asyncio.get_event_loop().time()
                        logger.debug(f"[Session {session_id}] Yielding SSE event #{yield_count}")
                        yield sse_event
                    except asyncio.TimeoutError:
                        # Emit keepalive to prevent idle proxy timeouts; do not reset activity timer
                        if time_since_activity >= 10:
                            ping_event = emitter.emit_ping()
                            yield_count += 1
                            yield ping_event
                        logger.debug(f"[Session {session_id}] Timeout waiting for event, agent still running...")
                        continue
                    except Exception as e:
                        logger.error(f"[Session {session_id}] Error yielding event: {e}")
                        break

                # Await task to propagate any exceptions (if not already cancelled)
                if not agent_task.cancelled():
                    try:
                        await agent_task
                        logger.info(f"[Session {session_id}] Agent task completed successfully")
                    except Exception as e:
                        logger.error(f"[Session {session_id}] Agent task failed: {e}", exc_info=True)
                        agent_error = e

            except Exception as e:
                logger.error(f"[Session {session_id}] Unexpected error in stream loop: {e}", exc_info=True)
                agent_error = e

            # Drain any remaining events after agent completes (before terminal events)
            drain_count = queue.qsize()
            if drain_count > 0:
                logger.info(f"[Session {session_id}] Draining {drain_count} remaining events from queue")
            while not queue.empty():
                yield_count += 1
                yield queue.get_nowait()

            # Determine finish reason based on what happened
            if agent_timed_out:
                finish_reason = "timeout"
                if not saw_finish:
                    emit_any(emitter.emit_error(f"Agent silent for {AGENT_TIMEOUT_SECONDS}s - no response"))
            elif agent_error:
                finish_reason = "error"
            else:
                finish_reason = "stop"

            # CRITICAL: Emit and yield terminal events
            # This MUST happen regardless of success/error/timeout
            terminal_events = await emit_terminal_events_and_drain(finish_reason)
            for event in terminal_events:
                yield_count += 1
                yield event

            logger.info(f"[Session {session_id}] Stream complete. Emitted: {emit_count}, Yielded: {yield_count}, "
                       f"Finish: {saw_finish}, Done: {saw_done}, TimedOut: {agent_timed_out}, Error: {agent_error is not None}")

            # After execution, sync new messages to this session's LanceDB storage
            # Do this AFTER yielding all events so client isn't blocked
            try:
                new_messages = agent.messages[initial_msg_count:]
                logger.info(f"Syncing {len(new_messages)} new messages to session {storage_session_id}")
                
                for msg in new_messages:
                    role = msg.get("role")
                    content = msg.get("content")
                    
                    # Strands might have complex types or tool calls.
                    if isinstance(content, list):
                        # Convert list of content blocks to string if possible
                        text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                        content_str = "\n".join(text_parts)
                    else:
                        content_str = str(content) if content else ""
                    
                    # Only persist assistant messages here (user already saved at start)
                    if role == "assistant" and content_str:
                        memory.add_message(storage_session_id, role, content_str)
            except Exception as e:
                logger.error(f"[Session {session_id}] Failed to sync messages to DB: {e}")
        finally:
            # Restore original callback handler to prevent race conditions with concurrent requests
            agent.callback_handler = original_callback_handler
            if lock_acquired:
                session_lock.release()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",  # Required for AI SDK v5
        }
    )

# ─────────────────────────────────────────────────────────────────────────────
# Task Agent Endpoint (Project Manager flavor of SuperAgent)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/task-agent/stream")
async def task_agent_stream(request: Request):
    """
    Stream task agent responses in AI SDK v5 UIMessageStream format.
    Uses task-focused agent with per-session conversation history.
    """
    body = await request.json()
    logger.info(f"[TaskAgent] Received request body: {json.dumps(body, indent=2)}")

    # AI SDK v6 sends messages array with parts
    messages = body.get("messages", [])
    message = ""
    if messages:
        last_msg = messages[-1]
        # AI SDK v6 format: messages[].parts[].text
        parts = last_msg.get("parts", [])
        for part in parts:
            p_type = part.get("type")
            if p_type == "text":
                msg_text = part.get("text", "")
                if msg_text:
                    message += f"\n{msg_text}" if message else msg_text
            elif p_type in ["attachment", "file"]:
                # Handle file attachments (AI SDK v6 FileUIPart format)
                content = part.get("text") or part.get("content") or part.get("data")

                if not content and part.get("url"):
                    url = part.get("url")
                    if url.startswith("data:"):
                        try:
                            import base64
                            comma_idx = url.find(",")
                            if comma_idx != -1:
                                header = url[5:comma_idx]
                                encoded_data = url[comma_idx + 1:]
                                if ";base64" in header:
                                    decoded_bytes = base64.b64decode(encoded_data)
                                    content = decoded_bytes.decode("utf-8", errors="replace")
                                else:
                                    from urllib.parse import unquote
                                    content = unquote(encoded_data)
                        except Exception as e:
                            logger.error(f"[TaskAgent] Failed to decode attachment URL: {e}")
                            content = ""

                filename = part.get("filename", "attachment")
                if content:
                    message += f"\n\n[Attachment: {filename}]\n{content}\n" if message else f"[Attachment: {filename}]\n{content}\n"
        if not message and isinstance(last_msg.get("content"), str):
            message = last_msg["content"].strip()

    if not message:
        message = body.get("message", "").strip()

    session_id = body.get("session_id", "task-default")
    logger.info(f"[TaskAgent] Session: {session_id}, Message: '{message}'")

    if not message:
        return JSONResponse(status_code=400, content={"error": "Message cannot be empty"})

    queue = asyncio.Queue()

    emit_count = 0
    saw_finish = False
    saw_done = False
    saw_callback_events = False
    using_stream_fallback = False
    fallback_logged = False
    emitter = AISDKStreamEmitter()

    def emit_common(sse_event: str):
        nonlocal emit_count, saw_finish, saw_done
        emit_count += 1
        if '"type": "finish"' in sse_event:
            saw_finish = True
        if "[DONE]" in sse_event:
            saw_done = True
        logger.debug(f"[TaskAgent Session {session_id}] Emit #{emit_count}: {sse_event[:80]}...")
        queue.put_nowait(sse_event)

    def emit_from_callback(sse_event: str):
        nonlocal saw_callback_events
        if using_stream_fallback:
            return
        saw_callback_events = True
        emit_common(sse_event)

    def emit_from_stream(sse_event: str):
        nonlocal using_stream_fallback, fallback_logged
        if not using_stream_fallback:
            using_stream_fallback = True
            if not fallback_logged:
                logger.warning(f"[TaskAgent Session {session_id}] No callback events detected; using stream_async event fallback.")
                fallback_logged = True
        emit_common(sse_event)

    def emit_any(sse_event: str):
        if using_stream_fallback:
            emit_from_stream(sse_event)
        else:
            emit_from_callback(sse_event)

    callback_handler = UICallbackHandler(emit_from_callback)
    fallback_handler = UICallbackHandler(emit_from_stream)

    agent_session_id = TASK_AGENT_SESSION_ID if TASK_AGENT_LOCK_SESSION else session_id
    browser_session_override = TASK_AGENT_BROWSER_SESSION if TASK_AGENT_LOCK_SESSION else None
    agent, agent_created, browser_session_name = get_or_create_task_agent(
        session_id=agent_session_id,
        callback_handler=callback_handler,
        memory=None,
        browser_session_name=browser_session_override
    )

    original_callback_handler = getattr(agent, 'callback_handler', None)
    agent.callback_handler = callback_handler

    storage_session_id = agent_session_id if TASK_AGENT_LOCK_SESSION else session_id
    if agent_created:
        db_messages = memory.get_messages(storage_session_id, limit=1000)
        session_history = []
        for msg in db_messages:
            content = msg["content"]
            if isinstance(content, str):
                content = [{"text": content}]
            session_history.append({"role": msg["role"], "content": content})
        logger.info(f"[TaskAgent] Loaded {len(session_history)} messages for session {storage_session_id}")
        agent.messages = session_history

    memory.add_message(storage_session_id, "user", message)
    logger.info(f"[TaskAgent] Saved user message to session {storage_session_id}")

    initial_msg_count = len(agent.messages)
    sa._current_agent = agent

    browser = sa._global_browser

    async def ensure_browser_session():
        if browser and browser_session_name not in browser._sessions:
            try:
                from strands_tools.browser.models import InitSessionAction
                action = InitSessionAction(
                    type="init_session",
                    session_name=browser_session_name,
                    description=f"Browser session for task chat {session_id}"
                )
                result = await browser.init_session(action)
                logger.info(f"[TaskAgent] Created browser session: {browser_session_name} -> {result}")
            except Exception as e:
                logger.warning(f"[TaskAgent] Failed to create browser session: {e}")

    async def emit_terminal_events_and_drain(finish_reason: str = "stop"):
        nonlocal saw_finish, saw_done

        active_handler = fallback_handler if using_stream_fallback else callback_handler
        emit_fn = emit_from_stream if using_stream_fallback else emit_from_callback

        if hasattr(active_handler, "finalize"):
            active_handler.finalize(finish_reason=finish_reason)

        if not saw_finish:
            emit_fn(emitter.emit_finish(finish_reason))
        if not saw_done:
            emit_fn(emitter.emit_done())

        events_to_yield = []
        while not queue.empty():
            events_to_yield.append(queue.get_nowait())
        return events_to_yield

    session_lock = _get_session_lock(agent_session_id)

    async def generate():
        nonlocal saw_finish, saw_done
        lock_acquired = False

        try:
            try:
                await asyncio.wait_for(session_lock.acquire(), timeout=0.01)
                lock_acquired = True
            except asyncio.TimeoutError:
                emit_any(emitter.emit_error("Another request is already streaming for this session"))
                terminal_events = await emit_terminal_events_and_drain("error")
                for event in terminal_events:
                    yield event
                return

            try:
                await asyncio.wait_for(ensure_browser_session(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(f"[TaskAgent Session {session_id}] Browser session creation timed out, continuing without it")
            except Exception as e:
                logger.warning(f"[TaskAgent Session {session_id}] Browser session error: {e}")

            logger.info(f"[TaskAgent Session {session_id}] Starting agent stream for message: {message[:100]}...")

            agent_error = None
            agent_timed_out = False

            async def run_agent():
                """Run task agent once per request (no Ralph loop)."""
                nonlocal agent_error
                event_count = 0
                try:
                    async for event in agent.stream_async(message):
                        event_count += 1
                        logger.debug(
                            f"[TaskAgent Session {session_id}] Agent stream event #{event_count}: {str(event)[:80]}"
                        )
                        if not saw_callback_events:
                            _forward_stream_event(event, fallback_handler, emit_from_stream)
                except Exception as e:
                    logger.error(f"[TaskAgent Session {session_id}] Agent stream error: {e}", exc_info=True)
                    agent_error = e
                    emit_any(emitter.emit_error(str(e)))
                    raise

                logger.info(f"[TaskAgent Session {session_id}] Agent stream complete. Events: {event_count}")

            agent_task = asyncio.create_task(run_agent())
            last_activity_time = asyncio.get_event_loop().time()

            yield_count = 0
            try:
                while not agent_task.done():
                    time_since_activity = asyncio.get_event_loop().time() - last_activity_time
                    if AGENT_TIMEOUT_SECONDS > 0 and time_since_activity > AGENT_TIMEOUT_SECONDS:
                        logger.error(f"[TaskAgent Session {session_id}] Agent silent for {time_since_activity:.1f}s - timeout")
                        agent_timed_out = True
                        agent_task.cancel()
                        try:
                            await agent_task
                        except asyncio.CancelledError:
                            pass
                        break

                    try:
                        sse_event = await asyncio.wait_for(queue.get(), timeout=0.5)
                        yield_count += 1
                        if not _is_reasoning_event(sse_event):
                            last_activity_time = asyncio.get_event_loop().time()
                        logger.debug(f"[TaskAgent Session {session_id}] Yielding SSE event #{yield_count}")
                        yield sse_event
                    except asyncio.TimeoutError:
                        if time_since_activity >= 10:
                            ping_event = emitter.emit_ping()
                            yield_count += 1
                            yield ping_event
                        logger.debug(f"[TaskAgent Session {session_id}] Timeout waiting for event, agent still running...")
                        continue
                    except Exception as e:
                        logger.error(f"[TaskAgent Session {session_id}] Error yielding event: {e}")
                        break

                if not agent_task.cancelled():
                    try:
                        await agent_task
                        logger.info(f"[TaskAgent Session {session_id}] Agent task completed successfully")
                    except Exception as e:
                        logger.error(f"[TaskAgent Session {session_id}] Agent task failed: {e}", exc_info=True)
                        agent_error = e

            except Exception as e:
                logger.error(f"[TaskAgent Session {session_id}] Unexpected error in stream loop: {e}", exc_info=True)
                agent_error = e

            drain_count = queue.qsize()
            if drain_count > 0:
                logger.info(f"[TaskAgent Session {session_id}] Draining {drain_count} remaining events from queue")
            while not queue.empty():
                yield_count += 1
                yield queue.get_nowait()

            if agent_timed_out:
                finish_reason = "timeout"
                if not saw_finish:
                    emit_any(emitter.emit_error(f"Agent silent for {AGENT_TIMEOUT_SECONDS}s - no response"))
            elif agent_error:
                finish_reason = "error"
            else:
                finish_reason = "stop"

            terminal_events = await emit_terminal_events_and_drain(finish_reason)
            for event in terminal_events:
                yield_count += 1
                yield event

            logger.info(f"[TaskAgent Session {session_id}] Stream complete. Emitted: {emit_count}, Yielded: {yield_count}, "
                       f"Finish: {saw_finish}, Done: {saw_done}, TimedOut: {agent_timed_out}, Error: {agent_error is not None}")

            try:
                new_messages = agent.messages[initial_msg_count:]
                logger.info(f"[TaskAgent] Syncing {len(new_messages)} new messages to session {storage_session_id}")

                for msg in new_messages:
                    role = msg.get("role")
                    content = msg.get("content")

                    if isinstance(content, list):
                        text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                        content_str = "\n".join(text_parts)
                    else:
                        content_str = str(content) if content else ""

                    if role == "assistant" and content_str:
                        memory.add_message(storage_session_id, role, content_str)
            except Exception as e:
                logger.error(f"[TaskAgent Session {session_id}] Failed to sync messages to DB: {e}")
        finally:
            agent.callback_handler = original_callback_handler
            if lock_acquired:
                session_lock.release()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
        }
    )

# ─────────────────────────────────────────────────────────────────────────────
# Sandbox / Desktop Agent Endpoint (A2A bridge)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/sandbox-agent/stream")
async def sandbox_agent_stream(request: Request):
    """
    Stream sandbox (desktop) agent responses in AI SDK v5 UIMessageStream format.
    Bridges to the A2A sandbox agent on SANDBOX_AGENT_URL.
    """
    body = await request.json()
    logger.info(f"[SandboxAgent] Received request body: {json.dumps(body, indent=2)}")

    # AI SDK v6 message extraction
    messages = body.get("messages", [])
    message = ""
    if messages:
        last_msg = messages[-1]
        parts = last_msg.get("parts", [])
        for part in parts:
            p_type = part.get("type")
            if p_type == "text":
                msg_text = part.get("text", "")
                if msg_text:
                    message += f"\n{msg_text}" if message else msg_text
            elif p_type in ["attachment", "file"]:
                content = part.get("text") or part.get("content") or part.get("data")
                if not content and part.get("url"):
                    url = part.get("url")
                    if url.startswith("data:"):
                        try:
                            import base64
                            comma_idx = url.find(",")
                            if comma_idx != -1:
                                header = url[5:comma_idx]
                                encoded_data = url[comma_idx + 1:]
                                if ";base64" in header:
                                    decoded_bytes = base64.b64decode(encoded_data)
                                    content = decoded_bytes.decode("utf-8", errors="replace")
                                else:
                                    from urllib.parse import unquote
                                    content = unquote(encoded_data)
                        except Exception as e:
                            logger.error(f"[SandboxAgent] Failed to decode attachment URL: {e}")
                            content = ""
                filename = part.get("filename", "attachment")
                if content:
                    message += f"\n\n[Attachment: {filename}]\n{content}\n" if message else f"[Attachment: {filename}]\n{content}\n"
        if not message and isinstance(last_msg.get("content"), str):
            message = last_msg["content"].strip()

    if not message:
        message = body.get("message", "").strip()

    session_id = body.get("session_id", "sandbox-default")
    logger.info(f"[SandboxAgent] Session: {session_id}, Message: '{message}'")

    if not message:
        return JSONResponse(status_code=400, content={"error": "Message cannot be empty"})

    queue = asyncio.Queue()
    emit_count = 0
    saw_finish = False
    saw_done = False
    emitter = AISDKStreamEmitter()

    def emit(sse_event: str):
        nonlocal emit_count, saw_finish, saw_done
        emit_count += 1
        if '"type": "finish"' in sse_event:
            saw_finish = True
        if "[DONE]" in sse_event:
            saw_done = True
        logger.debug(f"[SandboxAgent Session {session_id}] Emit #{emit_count}: {sse_event[:80]}...")
        queue.put_nowait(sse_event)

    async def emit_terminal_events_and_drain(finish_reason: str = "stop"):
        nonlocal saw_finish, saw_done
        if not saw_finish:
            emit(emitter.emit_finish(finish_reason))
        if not saw_done:
            emit(emitter.emit_done())
        events_to_yield = []
        while not queue.empty():
            events_to_yield.append(queue.get_nowait())
        return events_to_yield

    async def run_a2a():
        try:
            async with httpx.AsyncClient(timeout=API_TOOL_TIMEOUT_SECONDS) as httpx_client:
                a2a_client = A2AClient(httpx_client, url=SANDBOX_AGENT_URL)
                a2a_message = A2AMessage(
                    message_id=str(uuid.uuid4()),
                    role=Role.user,
                    parts=[TextPart(text=message)],
                    context_id=session_id,
                )
                params = MessageSendParams(message=a2a_message)
                req = SendStreamingMessageRequest(id=str(uuid.uuid4()), params=params)

                async for resp in a2a_client.send_message_streaming(req, http_kwargs={"timeout": API_TOOL_TIMEOUT_SECONDS}):
                    root = resp.root
                    error_obj = getattr(root, "error", None)
                    if error_obj:
                        error_text = getattr(error_obj, "message", None) or "A2A stream error"
                        emit(emitter.emit_error(error_text))
                        return

                    result = getattr(root, "result", None)
                    if result is None:
                        continue

                    for chunk in _extract_a2a_text_chunks(result):
                        normalized = _normalize_sse_chunk(chunk)
                        if normalized:
                            emit(normalized)
        except Exception as e:
            logger.error(f"[SandboxAgent Session {session_id}] A2A stream error: {e}", exc_info=True)
            emit(emitter.emit_error(str(e)))

    async def generate():
        nonlocal saw_finish, saw_done
        agent_timed_out = False
        agent_error = None

        agent_task = asyncio.create_task(run_a2a())
        last_activity_time = asyncio.get_event_loop().time()
        yield_count = 0

        try:
            while not agent_task.done():
                time_since_activity = asyncio.get_event_loop().time() - last_activity_time
                if SANDBOX_AGENT_TIMEOUT_SECONDS > 0 and time_since_activity > SANDBOX_AGENT_TIMEOUT_SECONDS:
                    logger.error(f"[SandboxAgent Session {session_id}] Agent silent for {time_since_activity:.1f}s - timeout")
                    agent_timed_out = True
                    agent_task.cancel()
                    try:
                        await agent_task
                    except asyncio.CancelledError:
                        pass
                    break

                try:
                    sse_event = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield_count += 1
                    if not _is_reasoning_event(sse_event):
                        last_activity_time = asyncio.get_event_loop().time()
                    yield sse_event
                except asyncio.TimeoutError:
                    if time_since_activity >= 10:
                        ping_event = emitter.emit_ping()
                        yield_count += 1
                        yield ping_event
                    continue
                except Exception as e:
                    agent_error = e
                    logger.error(f"[SandboxAgent Session {session_id}] Error yielding event: {e}")
                    break

            if not agent_task.cancelled():
                try:
                    await agent_task
                except Exception as e:
                    agent_error = e

        except Exception as e:
            agent_error = e
            logger.error(f"[SandboxAgent Session {session_id}] Unexpected error in stream loop: {e}", exc_info=True)

        while not queue.empty():
            yield_count += 1
            yield queue.get_nowait()

        if agent_timed_out:
            finish_reason = "timeout"
            if not saw_finish:
                emit(emitter.emit_error(f"Agent silent for {SANDBOX_AGENT_TIMEOUT_SECONDS}s - no response"))
        elif agent_error:
            finish_reason = "error"
        else:
            finish_reason = "stop"

        terminal_events = await emit_terminal_events_and_drain(finish_reason)
        for event in terminal_events:
            yield_count += 1
            yield event

        logger.info(
            f"[SandboxAgent Session {session_id}] Stream complete. Emitted: {emit_count}, Yielded: {yield_count}, "
            f"Finish: {saw_finish}, Done: {saw_done}, TimedOut: {agent_timed_out}, Error: {agent_error is not None}"
        )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "x-vercel-ai-ui-message-stream": "v1",
        }
    )

# ─────────────────────────────────────────────────────────────────────────────
# Run server
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
