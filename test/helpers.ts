import { spawn, type Subprocess } from "bun";

export interface MCPServerProcess {
  process: Subprocess;
  send: (request: any) => void;
  receive: () => Promise<any>;
  close: () => Promise<void>;
}

/**
 * Spawn an MCP server process for testing
 */
export async function spawnServer(env?: Record<string, string>): Promise<MCPServerProcess> {
  const serverProcess = spawn(["bun", "run", "src/run.ts"], {
    stdin: "pipe",
    stdout: "pipe", 
    stderr: "pipe",
    env: {
      ...process.env,
      // Default test API keys to avoid real API calls
      OPENAI_API_KEY: "test-openai-key",
      GOOGLE_API_KEY: "test-google-key",
      GEMINI_API_KEY: "test-google-key",  // Also set GEMINI_API_KEY
      ANTHROPIC_API_KEY: "test-anthropic-key",
      XAI_API_KEY: "test-xai-key",
      GROK_API_KEY: "test-xai-key",  // Also set GROK_API_KEY
      ...env
    }
  });

  // Buffer for accumulating stdout data
  let responseBuffer = "";
  let responseResolvers: Array<{ resolve: (value: any) => void; reject: (error: any) => void }> = [];
  const decoder = new TextDecoder();

  // Process stdout data
  if (serverProcess.stdout) {
    const reader = serverProcess.stdout.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const data = decoder.decode(value);
          responseBuffer += data;
          
          // Process complete JSON-RPC messages (newline-delimited)
          const lines = responseBuffer.split('\n');
          responseBuffer = lines.pop() || ""; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const json = JSON.parse(line);
                const resolver = responseResolvers.shift();
                if (resolver) {
                  resolver.resolve(json);
                }
              } catch (e) {
                console.error("Failed to parse JSON:", line);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error reading stdout:", error);
      }
    })();
  }

  // Process stderr for debugging
  if (serverProcess.stderr && process.env.DEBUG_MCP_TESTS) {
    const stderrReader = serverProcess.stderr.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          const text = decoder.decode(value);
          console.error("[SERVER LOG]", text);
        }
      } catch (error) {
        console.error("Error reading stderr:", error);
      }
    })();
  }

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    process: serverProcess,
    
    send(request: any) {
      if (serverProcess.stdin) {
        const data = JSON.stringify(request) + '\n';
        serverProcess.stdin.write(data);
      }
    },
    
    async receive(): Promise<any> {
      return new Promise((resolve, reject) => {
        responseResolvers.push({ resolve, reject });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          const index = responseResolvers.findIndex(r => r.resolve === resolve);
          if (index !== -1) {
            responseResolvers.splice(index, 1);
            reject(new Error("Response timeout"));
          }
        }, 5000);
      });
    },
    
    async close() {
      serverProcess.kill();
      await serverProcess.exited;
    }
  };
}

/**
 * Send a JSON-RPC request and wait for response
 */
export async function sendRequest(
  server: MCPServerProcess,
  method: string,
  params?: any,
  id?: number
): Promise<any> {
  const request = {
    jsonrpc: "2.0",
    method,
    params: params || {},
    id: id ?? Math.floor(Math.random() * 10000)
  };
  
  server.send(request);
  return server.receive();
}

/**
 * Initialize an MCP server connection
 */
export async function initializeServer(server: MCPServerProcess): Promise<any> {
  return sendRequest(server, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  });
}

/**
 * List available tools from server
 */
export async function listTools(server: MCPServerProcess): Promise<any> {
  return sendRequest(server, "tools/list");
}

/**
 * Call a tool on the server
 */
export async function callTool(
  server: MCPServerProcess,
  toolName: string,
  args: any = {}
): Promise<any> {
  return sendRequest(server, "tools/call", {
    name: toolName,
    arguments: args
  });
}

/**
 * Test helper to check if response is a valid JSON-RPC response
 */
export function isValidJsonRpcResponse(response: any): boolean {
  return (
    response &&
    typeof response === "object" &&
    response.jsonrpc === "2.0" &&
    (response.result !== undefined || response.error !== undefined)
  );
}

/**
 * Test helper to check if response is a JSON-RPC error
 */
export function isJsonRpcError(response: any): boolean {
  return (
    isValidJsonRpcResponse(response) &&
    response.error !== undefined &&
    typeof response.error.code === "number" &&
    typeof response.error.message === "string"
  );
}

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  
  // MCP custom error codes
  ModelNotFound: -32001,
  ProviderError: -32002,
  RateLimitError: -32003,
  AuthenticationError: -32004
} as const;