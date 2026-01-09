"""System tools wrapping Strands shell, file, and HTTP operations."""

from typing import Optional, Dict, Any
from pathlib import Path

try:
    from agents.Ron.tools.src.strands_tools.shell import shell
    from agents.Ron.tools.src.strands_tools.file_read import file_read
    from agents.Ron.tools.src.strands_tools.file_write import file_write
    from agents.Ron.tools.src.strands_tools.http_request import http_request
except ImportError:
    try:
        from strands_tools.shell import shell
        from strands_tools.file_read import file_read
        from strands_tools.file_write import file_write
        from strands_tools.http_request import http_request
    except ImportError:
        shell = None
        file_read = None
        file_write = None
        http_request = None


class SystemTools:
    """System tools for shell commands, file operations, and HTTP requests.

    Wraps Strands tools for DSPy agent use.
    """

    def __init__(self):
        """Initialize system tools."""
        if shell is None:
            raise ImportError(
                "Strands tools not available. Ensure strands-tools is installed."
            )

    def run_shell(self, command: str, timeout: int = 30) -> str:
        """Execute a shell command.

        Args:
            command: Shell command to execute
            timeout: Timeout in seconds

        Returns:
            Command output
        """
        try:
            result = shell(command=command, timeout=timeout)

            # Handle different result formats
            if isinstance(result, dict):
                if "output" in result:
                    return result["output"]
                if "stdout" in result:
                    return result["stdout"]
                return str(result)
            return str(result)

        except Exception as e:
            return f"Shell error: {str(e)}"

    def read_file(self, path: str, start_line: int = 0, end_line: Optional[int] = None) -> str:
        """Read contents of a file.

        Args:
            path: File path to read
            start_line: Starting line (0-indexed)
            end_line: Ending line (exclusive)

        Returns:
            File contents
        """
        try:
            args = {"path": path}
            if start_line > 0:
                args["start_line"] = start_line
            if end_line:
                args["end_line"] = end_line

            result = file_read(**args)

            if isinstance(result, dict) and "content" in result:
                return result["content"]
            return str(result)

        except FileNotFoundError:
            return f"File not found: {path}"
        except Exception as e:
            return f"Error reading file: {str(e)}"

    def write_file(self, path: str, content: str, mode: str = "write") -> str:
        """Write content to a file.

        Args:
            path: File path to write
            content: Content to write
            mode: 'write' (overwrite) or 'append'

        Returns:
            Write confirmation
        """
        try:
            result = file_write(path=path, content=content, mode=mode)

            if isinstance(result, dict) and result.get("status") == "success":
                return f"Successfully wrote to {path}"
            return f"Wrote to {path}"

        except Exception as e:
            return f"Error writing file: {str(e)}"

    def fetch_url(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        body: Optional[str] = None,
    ) -> str:
        """Make an HTTP request.

        Args:
            url: URL to fetch
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            headers: Optional request headers
            body: Optional request body

        Returns:
            Response content or error
        """
        try:
            args = {"url": url, "method": method}
            if headers:
                args["headers"] = headers
            if body:
                args["body"] = body

            result = http_request(**args)

            if isinstance(result, dict):
                # Extract response body
                if "body" in result:
                    body_content = result["body"]
                    # Truncate very long responses
                    if len(str(body_content)) > 5000:
                        return str(body_content)[:5000] + "... (truncated)"
                    return str(body_content)
                if "content" in result:
                    return str(result["content"])
                return str(result)
            return str(result)

        except Exception as e:
            return f"HTTP error: {str(e)}"

    def list_directory(self, path: str = ".") -> str:
        """List contents of a directory.

        Args:
            path: Directory path (default: current directory)

        Returns:
            Directory listing
        """
        return self.run_shell(f"ls -la {path}")

    def get_current_directory(self) -> str:
        """Get current working directory."""
        return self.run_shell("pwd")

    def search_files(self, pattern: str, path: str = ".") -> str:
        """Search for files matching a pattern.

        Args:
            pattern: Glob pattern or filename
            path: Directory to search in

        Returns:
            Matching files
        """
        return self.run_shell(f"find {path} -name '{pattern}' 2>/dev/null | head -20")

    def grep_content(self, pattern: str, path: str = ".", file_pattern: str = "*") -> str:
        """Search file contents for a pattern.

        Args:
            pattern: Search pattern (regex)
            path: Directory to search in
            file_pattern: File pattern to filter

        Returns:
            Matching lines
        """
        return self.run_shell(
            f"grep -r --include='{file_pattern}' '{pattern}' {path} 2>/dev/null | head -30"
        )
