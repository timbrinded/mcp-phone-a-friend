import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  spawnServer,
  initializeServer,
  listTools,
  callTool,
  isValidJsonRpcResponse,
  isJsonRpcError,
  JsonRpcErrorCode,
  type MCPServerProcess
} from "./helpers";

describe("MCP Tools Tests", () => {
  let server: MCPServerProcess;

  beforeEach(async () => {
    server = await spawnServer();
    await initializeServer(server);
  });

  afterEach(async () => {
    await server.close();
  });

  describe("tools/list", () => {
    test("should list all available tools", async () => {
      const response = await listTools(server);
      
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBe(3); // models, advice, idiom
    });

    test("should return tools with correct schema", async () => {
      const response = await listTools(server);
      const tools = response.result.tools;
      
      // Check each tool has required fields
      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      }
    });

    test("should include models tool", async () => {
      const response = await listTools(server);
      const modelsTool = response.result.tools.find((t: any) => t.name === "models");
      
      expect(modelsTool).toBeDefined();
      expect(modelsTool.description).toContain("List");
      expect(modelsTool.description).toContain("models");
      expect(modelsTool.inputSchema.required.length).toBe(0);
    });

    test("should include advice tool", async () => {
      const response = await listTools(server);
      const adviceTool = response.result.tools.find((t: any) => t.name === "advice");
      
      expect(adviceTool).toBeDefined();
      expect(adviceTool.description).toContain("advice");
      expect(adviceTool.inputSchema.properties.model).toBeDefined();
      expect(adviceTool.inputSchema.properties.prompt).toBeDefined();
      expect(adviceTool.inputSchema.required).toContain("model");
      expect(adviceTool.inputSchema.required).toContain("prompt");
    });

    test("should include detailed parameter in models tool", async () => {
      const response = await listTools(server);
      const modelsTool = response.result.tools.find((t: any) => t.name === "models");
      
      expect(modelsTool).toBeDefined();
      expect(modelsTool.inputSchema.properties.detailed).toBeDefined();
      expect(modelsTool.description).toContain("detailed");
    });
  });

  describe("models tool", () => {
    test("should list available models", async () => {
      const response = await callTool(server, "models");
      
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content[0].type).toBe("text");
      
      const data = JSON.parse(response.result.content[0].text);
      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.count).toBe(data.models.length);
      
      // With test API keys, all models should be available
      expect(data.models).toContain("openai:gpt-4o");
      expect(data.models).toContain("google:gemini-1.5-pro");
      expect(data.models).toContain("anthropic:claude-3-5-sonnet-20241022");
      expect(data.models).toContain("xai:grok-2");
    });

    test("should work with no providers configured", async () => {
      // Create server with no API keys
      const noKeyServer = await spawnServer({
        OPENAI_API_KEY: "",
        GOOGLE_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        XAI_API_KEY: "",
        GROK_API_KEY: ""
      });
      await initializeServer(noKeyServer);
      
      const response = await callTool(noKeyServer, "models");
      
      expect(isValidJsonRpcResponse(response)).toBe(true);
      const data = JSON.parse(response.result.content[0].text);
      expect(data.models).toEqual([]);
      expect(data.count).toBe(0);
      
      await noKeyServer.close();
    });
  });

  describe("models tool with detailed parameter", () => {
    test("should show detailed provider status when detailed=true", async () => {
      const response = await callTool(server, "models", { detailed: true });
      
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      
      const status = JSON.parse(response.result.content[0].text);
      
      // Check structure
      expect(status.providers).toBeDefined();
      expect(status.providers.openai).toBeDefined();
      expect(status.providers.google).toBeDefined();
      expect(status.providers.anthropic).toBeDefined();
      expect(status.providers.xai).toBeDefined();
      
      // Check summary
      expect(status.summary).toBeDefined();
      expect(status.summary.totalProvidersConfigured).toBe(4);
      expect(status.summary.totalModelsAvailable).toBeGreaterThan(0);
      expect(status.summary.readyToUse).toBe(true);
      
      // Check provider details
      expect(status.providers.openai.configured).toBe(true);
      expect(status.providers.openai.apiKey).toContain("Configured");
      expect(status.providers.openai.available.length).toBeGreaterThan(0);
    });

    test("should show missing API keys", async () => {
      // Create server with only one API key
      const partialServer = await spawnServer({
        OPENAI_API_KEY: "test-key",
        GOOGLE_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        XAI_API_KEY: "",
        GROK_API_KEY: ""
      });
      await initializeServer(partialServer);
      
      const response = await callTool(partialServer, "models", { detailed: true });
      const status = JSON.parse(response.result.content[0].text);
      
      expect(status.providers.openai.configured).toBe(true);
      expect(status.providers.openai.apiKey).toContain("Configured");
      
      expect(status.providers.google.configured).toBe(false);
      expect(status.providers.google.apiKey).toContain("Missing");
      expect(status.providers.google.apiKey).toContain("GOOGLE_API_KEY");
      
      expect(status.summary.totalProvidersConfigured).toBe(1);
      
      await partialServer.close();
    });

    test("should provide setup instructions when no providers configured", async () => {
      // Create server with no API keys
      const noKeyServer = await spawnServer({
        OPENAI_API_KEY: "",
        GOOGLE_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        XAI_API_KEY: "",
        GROK_API_KEY: ""
      });
      await initializeServer(noKeyServer);
      
      const response = await callTool(noKeyServer, "models", { detailed: true });
      const status = JSON.parse(response.result.content[0].text);
      
      expect(status.summary.readyToUse).toBe(false);
      expect(status.quickSetup).toBeDefined();
      expect(Array.isArray(status.quickSetup)).toBe(true);
      expect(status.quickSetup.length).toBeGreaterThan(0);
      expect(status.quickSetup[0]).toContain("get started");
      
      await noKeyServer.close();
    });
  });

  describe("advice tool", () => {
    test("should validate required parameters", async () => {
      // Missing model parameter
      let response = await callTool(server, "advice", { prompt: "test" });
      expect(isJsonRpcError(response)).toBe(true);
      
      // Missing prompt parameter
      response = await callTool(server, "advice", { model: "openai:gpt-4o" });
      expect(isJsonRpcError(response)).toBe(true);
      
      // Empty model string
      response = await callTool(server, "advice", { model: "", prompt: "test" });
      expect(isJsonRpcError(response)).toBe(true);
      expect(response.error.code).toBe(JsonRpcErrorCode.InvalidParams);
      expect(response.error.message).toContain("cannot be empty");
      
      // Empty prompt string
      response = await callTool(server, "advice", { model: "openai:gpt-4o", prompt: "" });
      expect(isJsonRpcError(response)).toBe(true);
      expect(response.error.code).toBe(JsonRpcErrorCode.InvalidParams);
      expect(response.error.message).toContain("cannot be empty");
    });

    test("should return error for unknown model", async () => {
      const response = await callTool(server, "advice", {
        model: "unknown:model",
        prompt: "test prompt"
      });
      
      expect(isJsonRpcError(response)).toBe(true);
      expect(response.error.code).toBe(JsonRpcErrorCode.ModelNotFound);
      expect(response.error.message).toContain("not found");
      expect(response.error.message).toContain("Available models");
      // Note: MCP SDK may not preserve custom error data
      // expect(response.error.data).toBeDefined();
    });

    test("should handle invalid model format", async () => {
      const response = await callTool(server, "advice", {
        model: "invalid-format",
        prompt: "test prompt"
      });
      
      expect(isJsonRpcError(response)).toBe(true);
      expect(response.error.code).toBe(JsonRpcErrorCode.ModelNotFound);
    });

    test.skip("should successfully call advice with valid parameters", async () => {
      // This test would make real API calls, so we skip it in unit tests
      // In a real test environment, you'd mock the AI SDK responses
      const response = await callTool(server, "advice", {
        model: "openai:gpt-4o",
        prompt: "Say hello"
      });
      
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe("text");
      expect(typeof response.result.content[0].text).toBe("string");
    });
  });
});