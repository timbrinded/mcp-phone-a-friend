import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  spawnServer,
  sendRequest,
  initializeServer,
  listTools,
  callTool,
  isValidJsonRpcResponse,
  type MCPServerProcess
} from "./helpers";

describe("MCP Integration Tests", () => {
  let server: MCPServerProcess;

  beforeEach(async () => {
    server = await spawnServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe("Full Conversation Flow", () => {
    test("should handle complete conversation flow", async () => {
      // Step 1: Initialize
      let response = await initializeServer(server);
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result.serverInfo.name).toBe("phone-a-friend");
      
      // Step 2: List tools
      response = await listTools(server);
      expect(response.result.tools.length).toBe(3);
      
      // Step 3: Call models tool
      response = await callTool(server, "models");
      const models = JSON.parse(response.result.content[0].text);
      expect(models.count).toBeGreaterThan(0);
      
      // Step 4: Call models-status tool
      response = await callTool(server, "models-status");
      const status = JSON.parse(response.result.content[0].text);
      expect(status.summary.readyToUse).toBe(true);
      
      // Step 5: Call advice tool (with error expected)
      response = await callTool(server, "advice", {
        model: "invalid:model",
        prompt: "test"
      });
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // ModelNotFound
    });
  });

  describe("Concurrent Requests", () => {
    test("should handle multiple concurrent tool calls", async () => {
      await initializeServer(server);
      
      // Send multiple requests concurrently
      const promises = [
        callTool(server, "models"),
        callTool(server, "models-status"),
        listTools(server)
      ];
      
      const responses = await Promise.all(promises);
      
      // All should succeed
      for (const response of responses) {
        expect(isValidJsonRpcResponse(response)).toBe(true);
        expect(response.result).toBeDefined();
      }
      
      // Verify each response is correct
      const modelsData = JSON.parse(responses[0].result.content[0].text);
      expect(modelsData.models).toBeDefined();
      
      const statusData = JSON.parse(responses[1].result.content[0].text);
      expect(statusData.providers).toBeDefined();
      
      expect(responses[2].result.tools).toBeDefined();
    });

    test("should maintain separate request contexts", async () => {
      await initializeServer(server);
      
      // Send requests with different IDs
      const request1 = sendRequest(server, "tools/call", {
        name: "models",
        arguments: {}
      }, 100);
      
      const request2 = sendRequest(server, "tools/call", {
        name: "models-status",
        arguments: {}
      }, 200);
      
      const [response1, response2] = await Promise.all([request1, request2]);
      
      // Each response should have the correct ID
      expect(response1.id).toBe(100);
      expect(response2.id).toBe(200);
      
      // Each response should have different content
      const data1 = JSON.parse(response1.result.content[0].text);
      const data2 = JSON.parse(response2.result.content[0].text);
      
      expect(data1.models).toBeDefined();
      expect(data2.providers).toBeDefined();
    });
  });

  describe("Session Management", () => {
    test("should handle server restart gracefully", async () => {
      // Initialize first session
      let response = await initializeServer(server);
      expect(response.result).toBeDefined();
      
      // Close server
      await server.close();
      
      // Start new server
      server = await spawnServer();
      
      // Should be able to initialize again
      response = await initializeServer(server);
      expect(response.result).toBeDefined();
      
      // And use tools
      response = await callTool(server, "models");
      expect(response.result).toBeDefined();
    });

    test("should handle rapid sequential requests", async () => {
      await initializeServer(server);
      
      // Send many requests rapidly
      const requestCount = 10;
      const responses = [];
      
      for (let i = 0; i < requestCount; i++) {
        responses.push(await callTool(server, "models"));
      }
      
      // All should succeed
      expect(responses.length).toBe(requestCount);
      for (const response of responses) {
        expect(isValidJsonRpcResponse(response)).toBe(true);
        expect(response.result).toBeDefined();
      }
    });
  });

  describe("Error Recovery", () => {
    test("should recover from error states", async () => {
      await initializeServer(server);
      
      // Cause an error
      let response = await callTool(server, "advice", {
        model: "unknown:model",
        prompt: "test"
      });
      expect(response.error).toBeDefined();
      
      // Server should still work
      response = await callTool(server, "models");
      expect(isValidJsonRpcResponse(response)).toBe(true);
      expect(response.result).toBeDefined();
      
      // Can still call other tools
      response = await listTools(server);
      expect(response.result.tools).toBeDefined();
    });

    test("should handle mixed valid and invalid requests", async () => {
      await initializeServer(server);
      
      const responses = await Promise.all([
        callTool(server, "models"),                    // Valid
        callTool(server, "unknown-tool"),              // Invalid tool
        callTool(server, "models-status"),             // Valid
        callTool(server, "advice", { model: "bad" })   // Invalid params
      ]);
      
      // First and third should succeed
      expect(responses[0].result).toBeDefined();
      expect(responses[2].result).toBeDefined();
      
      // Second and fourth should be errors
      expect(responses[1].error).toBeDefined();
      expect(responses[3].error).toBeDefined();
    });
  });

  describe("Provider Configuration", () => {
    test("should work with partial provider configuration", async () => {
      // Create server with only OpenAI configured
      const partialServer = await spawnServer({
        OPENAI_API_KEY: "test-openai",
        GOOGLE_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        XAI_API_KEY: "",
        GROK_API_KEY: ""
      });
      
      await initializeServer(partialServer);
      
      // Should still list tools
      let response = await listTools(partialServer);
      expect(response.result.tools.length).toBe(3);
      
      // Models should only show OpenAI
      response = await callTool(partialServer, "models");
      const models = JSON.parse(response.result.content[0].text);
      expect(models.models.every((m: string) => m.startsWith("openai:"))).toBe(true);
      
      // Status should reflect partial configuration
      response = await callTool(partialServer, "models-status");
      const status = JSON.parse(response.result.content[0].text);
      expect(status.summary.totalProvidersConfigured).toBe(1);
      expect(status.providers.openai.configured).toBe(true);
      expect(status.providers.google.configured).toBe(false);
      
      await partialServer.close();
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
      
      // Should still work but with empty models
      let response = await callTool(noKeyServer, "models");
      const models = JSON.parse(response.result.content[0].text);
      expect(models.count).toBe(0);
      expect(models.models).toEqual([]);
      
      // Status should show setup instructions
      response = await callTool(noKeyServer, "models-status");
      const status = JSON.parse(response.result.content[0].text);
      expect(status.summary.readyToUse).toBe(false);
      expect(status.quickSetup.length).toBeGreaterThan(0);
      
      await noKeyServer.close();
    });
  });
});