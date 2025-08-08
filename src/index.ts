#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Command } from 'commander';
import axios, { AxiosInstance } from 'axios';
const swaggerParser = require('swagger-parser');
import https from 'https';

interface ServerConfig {
  swaggerUrl?: string;
  swaggerFile?: string;
  toolPrefix?: string;
  baseUrl?: string;
  ignoreSsl: boolean;
  authHeader?: string;
}

interface SwaggerTool {
  name: string;
  description: string;
  inputSchema: any;
  method: string;
  path: string;
  parameters: any[];
}

class SwaggerMCPServer {
  private server: Server;
  private config: ServerConfig;
  private tools: SwaggerTool[] = [];
  private httpClient: AxiosInstance;
  private swaggerDoc: any;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'swagger-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Create HTTP client with SSL handling
    this.httpClient = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: !config.ignoreSsl,
      }),
      headers: config.authHeader ? { Authorization: config.authHeader } : {},
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      return await this.callApiTool(tool, args || {});
    });
  }

  private async callApiTool(tool: SwaggerTool, args: any): Promise<CallToolResult> {
    try {
      // Build the URL with path parameters
      const url = this.buildUrl(tool.path, args);
      
      // Extract query parameters
      const queryParams: any = {};
      const bodyData: any = {};
      
      tool.parameters.forEach(param => {
        if (args[param.name] !== undefined) {
          switch (param.in) {
            case 'query':
              queryParams[param.name] = args[param.name];
              break;
            case 'body':
              Object.assign(bodyData, args[param.name]);
              break;
            // path parameters are already handled in buildUrl
          }
        }
      });

      const requestConfig: any = {
        method: tool.method,
        url,
        params: queryParams,
      };

      if (Object.keys(bodyData).length > 0) {
        requestConfig.data = bodyData;
        requestConfig.headers = { 'Content-Type': 'application/json' };
      }

      const response = await this.httpClient.request(requestConfig);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      const errorMessage = error.response 
        ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data, null, 2)}`
        : error.message;
      
      return {
        content: [
          {
            type: 'text',
            text: `Error calling ${tool.name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private buildUrl(path: string, args: any): string {
    let url = path;
    
    // Replace path parameters
    Object.keys(args).forEach(key => {
      url = url.replace(`{${key}}`, encodeURIComponent(args[key]));
    });

    // Combine with base URL
    const baseUrl = this.config.baseUrl || this.getBaseUrlFromSwagger();
    
    // Properly join base URL and path
    // If path starts with /, we need to append it to the base URL
    // rather than using URL constructor which would replace the base path
    if (url.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      // Ensure base path ends with / and remove leading / from url to avoid double /
      const basePath = baseUrlObj.pathname.endsWith('/') ? baseUrlObj.pathname : baseUrlObj.pathname + '/';
      const cleanPath = url.startsWith('/') ? url.substring(1) : url;
      baseUrlObj.pathname = basePath + cleanPath;
      return baseUrlObj.toString();
    } else {
      // For relative paths, use URL constructor as before
      return new URL(url, baseUrl).toString();
    }
  }

  private getBaseUrlFromSwagger(): string {
    if (!this.swaggerDoc) {
      throw new Error('No swagger document loaded');
    }

    const schemes = this.swaggerDoc.schemes || ['https'];
    const host = this.swaggerDoc.host || 'localhost';
    const basePath = this.swaggerDoc.basePath || '';
    
    return `${schemes[0]}://${host}${basePath}`;
  }

  private async loadSwaggerDoc(): Promise<void> {
    try {
      let swaggerDoc: any;

      if (this.config.swaggerUrl) {
        console.error(`Loading swagger from URL: ${this.config.swaggerUrl}`);
        const response = await this.httpClient.get(this.config.swaggerUrl);
        swaggerDoc = response.data;
      } else if (this.config.swaggerFile) {
        console.error(`Loading swagger from file: ${this.config.swaggerFile}`);
        swaggerDoc = await swaggerParser.parse(this.config.swaggerFile);
      } else {
        throw new Error('Either swaggerUrl or swaggerFile must be provided');
      }

      this.swaggerDoc = await swaggerParser.dereference(swaggerDoc);
      console.error(`Successfully loaded and parsed swagger document`);
    } catch (error: any) {
      throw new Error(`Failed to load swagger document: ${error.message}`);
    }
  }

  private generateTools(): void {
    if (!this.swaggerDoc || !this.swaggerDoc.paths) {
      throw new Error('No valid swagger document loaded');
    }

    const prefix = this.config.toolPrefix ? `${this.config.toolPrefix}_` : '';

    Object.entries(this.swaggerDoc.paths).forEach(([path, pathItem]: [string, any]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const toolName = this.generateToolName(prefix, method, path, operation);
          const tool = this.createToolFromOperation(toolName, method, path, operation);
          this.tools.push(tool);
        }
      });
    });

    console.error(`Generated ${this.tools.length} tools from swagger document`);
  }

  private generateToolName(prefix: string, method: string, path: string, operation: any): string {
    // Try to use operationId if available
    if (operation.operationId) {
      return `${prefix}${operation.operationId}`;
    }

    // Generate from method and path, including path parameters in the name
    const pathParts = path
      .split('/')
      .filter(part => part)
      .map(part => {
        if (part.startsWith('{') && part.endsWith('}')) {
          return `by_${part.slice(1, -1)}`;
        }
        return part.replace(/[^a-zA-Z0-9]/g, '_');
      });
    
    const methodName = method.toLowerCase();
    return `${prefix}${methodName}_${pathParts.join('_')}`;
  }

  private createToolFromOperation(name: string, method: string, path: string, operation: any): SwaggerTool {
    const parameters = operation.parameters || [];
    const properties: any = {};
    const required: string[] = [];

    parameters.forEach((param: any) => {
      properties[param.name] = {
        type: this.mapSwaggerType(param.type || param.schema?.type || 'string'),
        description: param.description || `${param.name} parameter`,
      };

      if (param.required) {
        required.push(param.name);
      }
    });

    return {
      name,
      description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
      inputSchema: {
        type: 'object',
        properties,
        required,
      },
      method: method.toUpperCase(),
      path,
      parameters,
    };
  }

  private mapSwaggerType(swaggerType: string): string {
    switch (swaggerType) {
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }

  async initialize(): Promise<void> {
    await this.loadSwaggerDoc();
    this.generateTools();
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Swagger MCP Server running on stdio');
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('mcp-swagger')
    .description('MCP server that converts REST APIs with Swagger documentation into MCP tools')
    .version('1.0.0')
    .option('-u, --swagger-url <url>', 'URL to swagger documentation', process.env.SWAGGER_URL)
    .option('-f, --swagger-file <file>', 'Path to local swagger file', process.env.SWAGGER_FILE)
    .option('-p, --tool-prefix <prefix>', 'Custom prefix for generated tools', process.env.SWAGGER_TOOL_PREFIX)
    .option('-b, --base-url <url>', 'Override base URL for API calls', process.env.SWAGGER_BASE_URL)
    .option('--ignore-ssl', 'Ignore SSL certificate errors', process.env.SWAGGER_IGNORE_SSL === 'true')
    .option('-a, --auth-header <header>', 'Authentication header (e.g., "Bearer token")', process.env.SWAGGER_AUTH_HEADER)
    .parse();

  const options = program.opts();

  if (!options.swaggerUrl && !options.swaggerFile) {
    console.error('Error: Either --swagger-url or --swagger-file must be provided');
    process.exit(1);
  }

  const config: ServerConfig = {
    swaggerUrl: options.swaggerUrl,
    swaggerFile: options.swaggerFile,
    toolPrefix: options.toolPrefix,
    baseUrl: options.baseUrl,
    ignoreSsl: options.ignoreSsl,
    authHeader: options.authHeader,
  };

  try {
    const server = new SwaggerMCPServer(config);
    await server.initialize();
    await server.run();
  } catch (error: any) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { SwaggerMCPServer };