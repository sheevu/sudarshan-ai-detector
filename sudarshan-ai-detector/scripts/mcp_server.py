
"""
MCP Server Adapter for Sudarshan AI Detector
Implements tools:
- detect_ai_text
- analyze_document
- detect_mixed_authorship
- get_detection_report
- list_detection_models

Supports stdio transport for ChatGPT / Claude Desktop integration.
Falls back to simple JSON-RPC if mcp package not installed.
"""
import argparse
import json
import sys
import os
import asyncio
from typing import Dict, Any

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

from .detector import SudarshanDetector

detector = SudarshanDetector()

# Tool definitions
TOOLS = [
    {
        "name": "detect_ai_text",
        "description": "Detect AI-generated text. Returns classification, AI likelihood, language, methods used, and explainable evidence. Supports English, Hindi, Hinglish, and Indian languages.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to analyze (10-20000 chars)"},
                "language": {"type": "string", "description": "auto|en|hi|hinglish|bn|ta|te|mr|gu|kn|ml|pa", "default": "auto"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "analyze_document",
        "description": "Analyze full document with mixed-authorship detection and section-level AI likelihood.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Document text"},
                "language": {"type": "string", "default": "auto"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "detect_mixed_authorship",
        "description": "Identify potentially AI-generated vs human-written sections in mixed document.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Document with multiple paragraphs"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "get_detection_report",
        "description": "Get detailed structured JSON report with individual detector findings, uncertainty, and limitations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "language": {"type": "string", "default": "auto"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "list_detection_models",
        "description": "List available detection models, their versions, licenses, and hardware requirements.",
        "inputSchema": {"type": "object", "properties": {}}
    }
]

def handle_tool(name: str, args: Dict[str, Any]) -> Dict:
    if name == "detect_ai_text":
        text = args.get("text", "")
        lang = args.get("language", "auto")
        result = detector.detect(text, language=lang)
        clean = {k:v for k,v in result.items() if not k.startswith("_")}
        return clean
    elif name == "analyze_document":
        text = args.get("text", "")
        lang = args.get("language", "auto")
        result = detector.detect(text, language=lang)
        return {k:v for k,v in result.items() if not k.startswith("_")}
    elif name == "detect_mixed_authorship":
        text = args.get("text", "")
        result = detector.detect(text)
        return {"mixed_authorship": result.get("mixed_authorship"), "overall_classification": result.get("overall_classification"), "ai_likelihood": result.get("ai_likelihood")}
    elif name == "get_detection_report":
        text = args.get("text", "")
        lang = args.get("language", "auto")
        result = detector.detect(text, language=lang)
        return {k:v for k,v in result.items() if not k.startswith("_")}
    elif name == "list_detection_models":
        return {
            "models": [
                {"name": "perplexity", "model": "distilgpt2", "type": "statistical", "license": "MIT", "hardware": "CPU/GPU", "status": "available"},
                {"name": "burstiness", "model": "statistical", "type": "heuristic", "license": "Apache-2.0", "hardware": "CPU", "status": "available"},
                {"name": "stylometry", "model": "statistical", "type": "heuristic", "license": "Apache-2.0", "hardware": "CPU", "status": "available"},
                {"name": "zero_shot", "model": "likelihood", "type": "zero-shot", "license": "Apache-2.0", "hardware": "CPU", "status": "available"},
                {"name": "transformer", "model": "xlm-roberta-base / indicbert-v2", "type": "fine-tuned classifier", "license": "MIT", "hardware": "GPU recommended", "status": "requires training"},
                {"name": "perturbation", "model": "t5-small + distilgpt2", "type": "DetectGPT", "license": "Apache-2.0/MIT", "hardware": "GPU", "status": "experimental"},
                {"name": "watermark", "model": "Kirchenbauer et al.", "type": "statistical watermark", "license": "MIT", "hardware": "CPU", "status": "requires key"}
            ],
            "fusion": "weighted calibrated ensemble, low FPR prioritized"
        }
    else:
        raise ValueError(f"Unknown tool {name}")

# If MCP SDK available, run real MCP server
if MCP_AVAILABLE:
    server = Server("sudarshan-ai-detector")

    @server.list_tools()
    async def list_tools():
        return [Tool(name=t["name"], description=t["description"], inputSchema=t["inputSchema"]) for t in TOOLS]

    @server.call_tool()
    async def call_tool(name: str, arguments: Dict):
        result = handle_tool(name, arguments)
        return [TextContent(type="text", text=json.dumps(result, indent=2, ensure_ascii=False))]

    async def run_stdio():
        from mcp.server.stdio import stdio_server
        async with stdio_server() as streams:
            await server.run(streams[0], streams[1], server.create_initialization_options())

else:
    # Fallback simple JSON-RPC over stdio
    async def run_stdio():
        print("MCP SDK not installed, using fallback JSON-RPC. Install with pip install mcp", file=sys.stderr)
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            try:
                req = json.loads(line)
                method = req.get("method")
                if method == "list_tools":
                    print(json.dumps({"tools": TOOLS}))
                elif method == "call_tool":
                    params = req.get("params", {})
                    tool_name = params.get("name")
                    args = params.get("arguments", {})
                    result = handle_tool(tool_name, args)
                    print(json.dumps(result, ensure_ascii=False))
                else:
                    # direct tool call: {"tool": "detect_ai_text", "text": "..."}
                    tool = req.get("tool") or req.get("method")
                    if tool in [t["name"] for t in TOOLS]:
                        result = handle_tool(tool, req)
                        print(json.dumps(result, ensure_ascii=False))
                    else:
                        print(json.dumps({"error": f"Unknown method {method}"}))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({"error": str(e)}), file=sys.stderr)
                sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transport", default="stdio", choices=["stdio", "sse"])
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if args.transport == "stdio":
        asyncio.run(run_stdio())
    else:
        print("SSE transport not implemented in fallback, use stdio", file=sys.stderr)

if __name__ == "__main__":
    main()
