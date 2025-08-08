/**
 * MCP Protocol Schemas (2025-06-18 Specification)
 * Defines schemas for MCP protocol compliance using Effect Schema
 */

import { Schema } from "@effect/schema"

// ============================================================================
// Base MCP Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request ID
 */
export const RequestId = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Null
).annotations({
  identifier: "RequestId",
  description: "JSON-RPC 2.0 request identifier"
})

/**
 * MCP Protocol Version
 */
export const ProtocolVersion = Schema.Literal("2025-06-18").annotations({
  identifier: "ProtocolVersion",
  description: "MCP protocol version"
})

// ============================================================================
// MCP Tool Schemas
// ============================================================================

/**
 * Tool input schema definition
 */
export const ToolInputSchema = Schema.Struct({
  type: Schema.Literal("object"),
  properties: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  required: Schema.optional(Schema.Array(Schema.String)),
  additionalProperties: Schema.optional(Schema.Boolean)
}).annotations({
  identifier: "ToolInputSchema",
  description: "JSON Schema for tool input parameters"
})

/**
 * Tool definition according to MCP spec
 */
export const Tool = Schema.Struct({
  name: Schema.String.annotations({
    description: "Tool identifier",
    examples: ["models", "advice"]
  }),
  description: Schema.optional(Schema.String).annotations({
    description: "Human-readable tool description"
  }),
  inputSchema: ToolInputSchema
}).annotations({
  identifier: "Tool"
})

/**
 * Tool list response
 */
export const ToolListResponse = Schema.Struct({
  tools: Schema.Array(Tool)
}).annotations({
  identifier: "ToolListResponse"
})

/**
 * Tool call request
 */
export const ToolCallRequest = Schema.Struct({
  name: Schema.String,
  arguments: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}).annotations({
  identifier: "ToolCallRequest"
})

/**
 * Tool call response
 */
export const ToolCallResponse = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({
      type: Schema.Literal("text"),
      text: Schema.String
    })
  ),
  isError: Schema.optional(Schema.Boolean)
}).annotations({
  identifier: "ToolCallResponse"
})

// ============================================================================
// MCP Server Capabilities
// ============================================================================

/**
 * Server capabilities according to MCP spec
 */
export const ServerCapabilities = Schema.Struct({
  tools: Schema.optional(Schema.Struct({})),
  resources: Schema.optional(Schema.Struct({
    subscribe: Schema.optional(Schema.Boolean),
    listChanged: Schema.optional(Schema.Boolean)
  })),
  prompts: Schema.optional(Schema.Struct({
    listChanged: Schema.optional(Schema.Boolean)
  })),
  logging: Schema.optional(Schema.Struct({}))
}).annotations({
  identifier: "ServerCapabilities"
})

/**
 * Server information
 */
export const ServerInfo = Schema.Struct({
  name: Schema.String,
  version: Schema.String
}).annotations({
  identifier: "ServerInfo"
})

// ============================================================================
// MCP Messages
// ============================================================================

/**
 * Initialize request from client
 */
export const InitializeRequest = Schema.Struct({
  protocolVersion: ProtocolVersion,
  capabilities: Schema.Struct({
    tools: Schema.optional(Schema.Struct({})),
    sampling: Schema.optional(Schema.Struct({}))
  }),
  clientInfo: Schema.Struct({
    name: Schema.String,
    version: Schema.String
  })
}).annotations({
  identifier: "InitializeRequest"
})

/**
 * Initialize response from server
 */
export const InitializeResponse = Schema.Struct({
  protocolVersion: ProtocolVersion,
  capabilities: ServerCapabilities,
  serverInfo: ServerInfo
}).annotations({
  identifier: "InitializeResponse"
})

// ============================================================================
// JSON-RPC 2.0 Messages
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export const JsonRpcRequest = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
  params: Schema.optional(Schema.Unknown),
  id: RequestId
}).annotations({
  identifier: "JsonRpcRequest"
})

/**
 * JSON-RPC 2.0 Response
 */
export const JsonRpcResponse = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({
      code: Schema.Number,
      message: Schema.String,
      data: Schema.optional(Schema.Unknown)
    })
  ),
  id: RequestId
}).annotations({
  identifier: "JsonRpcResponse"
})

/**
 * JSON-RPC 2.0 Notification
 */
export const JsonRpcNotification = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
  params: Schema.optional(Schema.Unknown)
}).annotations({
  identifier: "JsonRpcNotification"
})

// ============================================================================
// MCP Error Codes
// ============================================================================

export const MCPErrorCode = {
  // JSON-RPC 2.0 standard error codes
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  
  // MCP-specific error codes
  ServerError: -32000,
  ResourceNotFound: -32001,
  ResourceAccessDenied: -32002,
  ToolNotFound: -32003,
  ToolExecutionError: -32004
} as const

export type MCPErrorCodeType = typeof MCPErrorCode[keyof typeof MCPErrorCode]

/**
 * MCP Error response
 */
export const MCPError = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown)
}).annotations({
  identifier: "MCPError"
})

// ============================================================================
// Type exports for convenience
// ============================================================================

export type Tool = Schema.Schema.Type<typeof Tool>
export type ToolListResponse = Schema.Schema.Type<typeof ToolListResponse>
export type ToolCallRequest = Schema.Schema.Type<typeof ToolCallRequest>
export type ToolCallResponse = Schema.Schema.Type<typeof ToolCallResponse>
export type ServerCapabilities = Schema.Schema.Type<typeof ServerCapabilities>
export type ServerInfo = Schema.Schema.Type<typeof ServerInfo>
export type InitializeRequest = Schema.Schema.Type<typeof InitializeRequest>
export type InitializeResponse = Schema.Schema.Type<typeof InitializeResponse>
export type JsonRpcRequest = Schema.Schema.Type<typeof JsonRpcRequest>
export type JsonRpcResponse = Schema.Schema.Type<typeof JsonRpcResponse>
export type JsonRpcNotification = Schema.Schema.Type<typeof JsonRpcNotification>
export type MCPError = Schema.Schema.Type<typeof MCPError>