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
from openai import OpenAI

# LanceDB for persistent memory
import lancedb
import pyarrow as pa

# Load environment variables
load_dotenv()

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
EMBEDDING_MODEL = "text-embedding-3-small"  # For semantic search

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

    async def initialize(self):
        """Initialize LanceDB Cloud connection and tables"""
        self.db = lancedb.connect(
            uri=LANCEDB_URI,
            api_key=LANCEDB_API_KEY,
            region=LANCEDB_REGION
        )
        
        # Create sessions table if not exists
        if "sessions" not in self.db.table_names():
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
        
        # Create messages table if not exists  
        if "messages" not in self.db.table_names():
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
        
        logger.info(f"LanceDB Cloud connected to {LANCEDB_URI}")
        
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
        
        self.sessions_table.add([session_data])
        logger.info(f"Created session: {session_id}")
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session by ID"""
        try:
            results = self.sessions_table.search().where(
                f"session_id = '{session_id}'"
            ).limit(1).to_list()
            return results[0] if results else None
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
        
        self.messages_table.add([message_data])
        
        # Update session timestamp
        # Note: LanceDB doesn't support updates well, so we track via messages
        
    def get_messages(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent messages for a session"""
        try:
            results = self.messages_table.search().where(
                f"session_id = '{session_id}'"
            ).limit(limit).to_list()
            
            # Sort by created_at
            results.sort(key=lambda x: x.get("created_at", ""))
            return results
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
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
    
    async with httpx.AsyncClient(timeout=60.0) as client:
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
    
    async with httpx.AsyncClient(timeout=60.0) as client:
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
    yield
    # Cleanup if needed

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
# Superagent Endpoint (Strands-based orchestration)
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from superagent import create_superagent, UICallbackHandler

@app.post("/superagent/stream")
async def superagent_stream(request: Request):
    """
    Stream superagent responses in AI SDK v5 UIMessageStream format.

    Returns SSE stream compatible with Vercel AI SDK useChat hook.
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
            if part.get("type") == "text":
                message = part.get("text", "").strip()
                break
        # Fallback to content string (older format)
        if not message and isinstance(last_msg.get("content"), str):
            message = last_msg["content"].strip()

    # Fallback to direct message field
    if not message:
        message = body.get("message", "").strip()

    session_id = body.get("session_id")
    logger.info(f"Extracted message: '{message}'")

    if not message:
        return JSONResponse(status_code=400, content={"error": "Message cannot be empty"})

    queue = asyncio.Queue()

    def emit(sse_event: str):
        """Receive complete SSE strings from AISDKCallbackHandler."""
        queue.put_nowait(sse_event)

    agent = create_superagent(callback_handler=UICallbackHandler(emit))

    async def generate():
        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(None, lambda: agent(message))

        while not task.done():
            try:
                sse_event = await asyncio.wait_for(queue.get(), timeout=0.1)
                yield sse_event
            except asyncio.TimeoutError:
                continue

        # Drain remaining events
        while not queue.empty():
            sse_event = queue.get_nowait()
            yield sse_event

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
# Run server
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
