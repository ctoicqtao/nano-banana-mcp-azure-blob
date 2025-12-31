#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { config as dotenvConfig } from "dotenv";
import os from "os";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

// Load environment variables
dotenvConfig();

const ConfigSchema = z.object({
  geminiApiKey: z.string().min(1, "Gemini API key is required"),
  azureStorageConnectionString: z.string().optional(),
  azureStorageContainerName: z.string().default("nano-banana-images"),
});

type Config = z.infer<typeof ConfigSchema>;

class NanoBananaMCP {
  private server: Server;
  private genAI: GoogleGenAI | null = null;
  private config: Config | null = null;
  private configSource: 'environment' | 'config_file' | 'not_configured' = 'not_configured';
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "nano-banana-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Helper method to trigger garbage collection if available
   * This helps prevent memory leaks by cleaning up after large operations
   */
  private triggerGC(): void {
    if (global.gc) {
      global.gc();
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      console.log(`🧹 GC triggered - Heap: ${heapUsedMB}MB, RSS: ${rssMB}MB`);
    } else {
      // Schedule a microtask to give GC a chance to run
      setImmediate(() => {});
    }
  }

  /**
   * Force aggressive garbage collection
   * Triggers GC multiple times to ensure memory is freed
   */
  private async forceAggressiveGC(): Promise<void> {
    if (global.gc) {
      // Multiple GC passes for more thorough cleanup
      for (let i = 0; i < 3; i++) {
        global.gc();
        await new Promise(resolve => setImmediate(resolve));
      }
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      console.log(`🧹 Aggressive GC completed - Heap: ${heapUsedMB}MB, RSS: ${rssMB}MB`);
    }
  }

  /**
   * Monitor memory and trigger GC if usage is high
   */
  private checkMemoryAndGC(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    // If heap usage is over 70%, trigger GC
    if (usagePercent > 70 && global.gc) {
      console.log(`⚠️  High memory usage detected (${Math.round(usagePercent)}%), triggering GC...`);
      global.gc();
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "configure_gemini_token",
            description: "Configure your Gemini API token for nano-banana image generation",
            inputSchema: {
              type: "object",
              properties: {
                apiKey: {
                  type: "string",
                  description: "Your Gemini API key from Google AI Studio",
                },
              },
              required: ["apiKey"],
            },
          },
          {
            name: "generate_image",
            description: "Generate a NEW image from text prompt. Use this ONLY when creating a completely new image, not when modifying an existing one.",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the NEW image to create from scratch",
                },
              },
              required: ["prompt"],
            },
          },
          {
            name: "edit_image",
            description: "Edit a SPECIFIC existing image file, optionally using additional reference images. Use this when you have the exact file path of an image to modify.",
            inputSchema: {
              type: "object",
              properties: {
                imagePath: {
                  type: "string",
                  description: "Full file path to the main image file to edit",
                },
                prompt: {
                  type: "string",
                  description: "Text describing the modifications to make to the existing image",
                },
                referenceImages: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Optional array of file paths to additional reference images to use during editing (e.g., for style transfer, adding elements, etc.)",
                },
              },
              required: ["imagePath", "prompt"],
            },
          },
          {
            name: "get_configuration_status",
            description: "Check if Gemini API token is configured",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
      try {
        switch (request.params.name) {
          case "configure_gemini_token":
            return await this.configureGeminiToken(request);
          
          case "generate_image":
            return await this.generateImage(request);
          
          case "edit_image":
            return await this.editImage(request);
          
          case "get_configuration_status":
            return await this.getConfigurationStatus();
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private async configureGeminiToken(request: CallToolRequest): Promise<CallToolResult> {
    const { apiKey } = request.params.arguments as { apiKey: string };
    
    try {
      ConfigSchema.parse({ geminiApiKey: apiKey });
      
      this.config = { geminiApiKey: apiKey, azureStorageContainerName: "nano-banana-images" };
      this.genAI = new GoogleGenAI({ apiKey });
      this.configSource = 'config_file'; // Manual configuration via tool
      
      await this.saveConfig();
      await this.initializeAzureStorage();
      
      return {
        content: [
          {
            type: "text",
            text: "✅ Gemini API token configured successfully! You can now use nano-banana image generation features.",
          },
        ],
        isError: false,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid API key: ${error.errors[0]?.message}`);
      }
      throw error;
    }
  }

  private async generateImage(request: CallToolRequest): Promise<CallToolResult> {
    if (!this.ensureConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, "Gemini API token not configured. Use configure_gemini_token first.");
    }

    const { prompt } = request.params.arguments as { prompt: string };
    
    // Check memory before operation
    this.checkMemoryAndGC();
    
    try {
      // Ensure Azure Storage is initialized if connection string is available
      await this.ensureAzureStorageInitialized();
      
      let response: any = await this.genAI!.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });
      
      // Process response to extract image data
      const savedFiles: string[] = [];
      let textContent = "";
      
      // Get appropriate save directory based on OS
      const imagesDir = this.getImagesDirectory();
      
      // Create directory
      await fs.mkdir(imagesDir, { recursive: true, mode: 0o755 });
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Process text content
          if (part.text) {
            textContent += part.text;
          }
          
          // Process image data
          if (part.inlineData?.data) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const randomId = Math.random().toString(36).substring(2, 8);
            const fileName = `generated-${timestamp}-${randomId}.png`;
            
            // Create buffer from base64
            let imageBuffer: Buffer | null = Buffer.from(part.inlineData.data, 'base64');
            
            // Try to upload to Azure Blob Storage first
            const blobUrl = await this.uploadToAzureBlob(imageBuffer, fileName);
            
            if (blobUrl) {
              // Successfully uploaded to Azure
              savedFiles.push(blobUrl);
              console.log(`✅ Image uploaded to Azure Blob Storage: ${blobUrl}`);
            } else {
              // Fallback to local storage
              const filePath = path.join(imagesDir, fileName);
              await fs.writeFile(filePath, imageBuffer);
              savedFiles.push(filePath);
              console.log(`📁 Image saved locally: ${filePath}`);
            }
            
            // Explicitly release buffer reference
            imageBuffer = null;
            
            // Clear the base64 data from response to free memory immediately
            part.inlineData.data = '';
          }
        }
      }
      
      // Explicitly clear the response object to free memory
      response = null;
      
      // Log status information to console
      console.log(`🎨 Image generated with nano-banana (Gemini 2.5 Flash Image)!`);
      console.log(`Prompt: "${prompt}"`);
      
      if (textContent) {
        console.log(`Description: ${textContent}`);
      }
      
      let azureUrl = null;
      
      if (savedFiles.length > 0) {
        const isAzureStorage = savedFiles[0].startsWith('https://');
        if (isAzureStorage) {
          azureUrl = savedFiles[0];
          console.log(`☁️ Image uploaded to Azure Blob Storage:`);
          savedFiles.forEach(f => console.log(`- ${f}`));
          console.log(`💡 View the image by:`);
          console.log(`1. Opening the URL above in your browser`);
          console.log(`2. Clicking on "Called generate_image" in Cursor to expand the MCP call details`);
        } else {
          console.log(`📁 Image saved locally to:`);
          savedFiles.forEach(f => console.log(`- ${f}`));
          console.log(`💡 View the image by:`);
          console.log(`1. Opening the file at the path above`);
          console.log(`2. Clicking on "Called generate_image" in Cursor to expand the MCP call details`);
        }
      } else {
        console.log(`Note: No image was generated. The model may have returned only text.`);
        console.log(`💡 Tip: Try running the command again - sometimes the first call needs to warm up the model.`);
      }

      
      // Force aggressive garbage collection to free up memory immediately
      await this.forceAggressiveGC();
      
      // Return only the Azure URL as JSON
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ azureUrl }),
        }],
        isError: false 
      };
      
    } catch (error) {
      console.error("Error generating image:", error);
      // Trigger GC even on error to clean up any partial data
      await this.forceAggressiveGC();
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async editImage(request: CallToolRequest): Promise<CallToolResult> {
    if (!this.ensureConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, "Gemini API token not configured. Use configure_gemini_token first.");
    }

    const { imagePath, prompt, referenceImages } = request.params.arguments as { 
      imagePath: string; 
      prompt: string; 
      referenceImages?: string[];
    };
    
    // Check memory before operation
    this.checkMemoryAndGC();
    
    try {
      // Ensure Azure Storage is initialized if connection string is available
      await this.ensureAzureStorageInitialized();
      // Prepare the main image
      let imageBuffer: Buffer | null = null;
      let mimeType: string;
      
      if (imagePath.startsWith('https://')) {
        // Azure Blob Storage URL - fetch the image
        const response = await fetch(imagePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        mimeType = response.headers.get('content-type') || 'image/png';
      } else {
        // Local file
        imageBuffer = await fs.readFile(imagePath);
        mimeType = this.getMimeType(imagePath);
      }
      
      const imageBase64 = imageBuffer.toString('base64');
      
      // Prepare all image parts
      const imageParts: any[] = [
        { 
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          }
        }
      ];
      
      // Release main image buffer after converting to base64
      imageBuffer = null;
      
      // Add reference images if provided
      if (referenceImages && referenceImages.length > 0) {
        for (const refPath of referenceImages) {
          try {
            let refBuffer: Buffer | null = null;
            let refMimeType: string;
            
            if (refPath.startsWith('https://')) {
              // Azure Blob Storage URL - fetch the image
              const response = await fetch(refPath);
              if (!response.ok) {
                continue; // Skip this reference image
              }
              const arrayBuffer = await response.arrayBuffer();
              refBuffer = Buffer.from(arrayBuffer);
              refMimeType = response.headers.get('content-type') || 'image/png';
            } else {
              // Local file
              refBuffer = await fs.readFile(refPath);
              refMimeType = this.getMimeType(refPath);
            }
            
            const refBase64 = refBuffer.toString('base64');
            
            // Release reference buffer after converting to base64
            refBuffer = null;
            
            imageParts.push({
              inlineData: {
                data: refBase64,
                mimeType: refMimeType,
              }
            });
          } catch (error) {
            // Continue with other images, don't fail the entire operation
            continue;
          }
        }
      }
      
      // Add the text prompt
      imageParts.push({ text: prompt });
      
      // Use new API format with multiple images and text
      let response: any = await this.genAI!.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [
          {
            parts: imageParts
          }
        ],
      });
      
      // Clear imageParts to free memory immediately
      imageParts.length = 0;
      
      // Process response
      const savedFiles: string[] = [];
      let textContent = "";
      
      // Get appropriate save directory
      const imagesDir = this.getImagesDirectory();
      await fs.mkdir(imagesDir, { recursive: true, mode: 0o755 });
      
      // Extract image from response
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            textContent += part.text;
          }
          
          if (part.inlineData?.data) {
            // Save edited image
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const randomId = Math.random().toString(36).substring(2, 8);
            const fileName = `edited-${timestamp}-${randomId}.png`;
            
            // Create buffer from base64
            let editedImageBuffer: Buffer | null = Buffer.from(part.inlineData.data, 'base64');
            
            // Try to upload to Azure Blob Storage first
            const blobUrl = await this.uploadToAzureBlob(editedImageBuffer, fileName);
            
            if (blobUrl) {
              // Successfully uploaded to Azure
              savedFiles.push(blobUrl);
            } else {
              // Fallback to local storage
              const filePath = path.join(imagesDir, fileName);
              await fs.writeFile(filePath, editedImageBuffer);
              savedFiles.push(filePath);
            }
            
            // Explicitly release buffer reference
            editedImageBuffer = null;
            
            // Clear the base64 data from response to free memory immediately
            part.inlineData.data = '';
          }
        }
      }
      
      // Explicitly clear the response object to free memory
      response = null;
      
      // Log status information to console
      console.log(`🎨 Image edited with nano-banana!`);
      console.log(`Original: ${imagePath}`);
      console.log(`Edit prompt: "${prompt}"`);
      
      if (referenceImages && referenceImages.length > 0) {
        console.log(`Reference images used:`);
        referenceImages.forEach(f => console.log(`- ${f}`));
      }
      
      if (textContent) {
        console.log(`Description: ${textContent}`);
      }
      
      let azureUrl = null;
      
      if (savedFiles.length > 0) {
        const isAzureStorage = savedFiles[0].startsWith('https://');
        if (isAzureStorage) {
          azureUrl = savedFiles[0];
          console.log(`☁️ Edited image uploaded to Azure Blob Storage:`);
          savedFiles.forEach(f => console.log(`- ${f}`));
          console.log(`💡 View the edited image by:`);
          console.log(`1. Opening the URL above in your browser`);
          console.log(`2. Clicking on "Called edit_image" in Cursor to expand the MCP call details`);
        } else {
          console.log(`📁 Edited image saved locally to:`);
          savedFiles.forEach(f => console.log(`- ${f}`));
          console.log(`💡 View the edited image by:`);
          console.log(`1. Opening the file at the path above`);
          console.log(`2. Clicking on "Called edit_image" in Cursor to expand the MCP call details`);
        }
      } else {
        console.log(`Note: No edited image was generated.`);
        console.log(`💡 Tip: Try running the command again - sometimes the first call needs to warm up the model.`);
      }

      
      // Force aggressive garbage collection to free up memory immediately
      await this.forceAggressiveGC();
      
      // Return only the Azure URL as JSON
      return { 
        content: [{
          type: "text",
          text: JSON.stringify({ azureUrl }),
        }],
        isError: false 
      };
      
    } catch (error) {
      // Trigger GC even on error to clean up any partial data
      await this.forceAggressiveGC();
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to edit image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getConfigurationStatus(): Promise<CallToolResult> {
    const isConfigured = this.config !== null && this.genAI !== null;
    
    let statusText: string;
    let sourceInfo = "";
    
    if (isConfigured) {
      statusText = "✅ Gemini API token is configured and ready to use";
      
      switch (this.configSource) {
        case 'environment':
          sourceInfo = "\n📍 Source: Environment variable (GEMINI_API_KEY)\n💡 This is the most secure configuration method.";
          break;
        case 'config_file':
          sourceInfo = "\n📍 Source: Local configuration file (.nano-banana-config.json)\n💡 Consider using environment variables for better security.";
          break;
      }
    } else {
      statusText = "❌ Gemini API token is not configured";
      sourceInfo = `

📝 Configuration options (in priority order):
1. 🥇 MCP client environment variables (Recommended)
2. 🥈 System environment variable: GEMINI_API_KEY  
3. 🥉 Use configure_gemini_token tool

💡 For the most secure setup, add this to your MCP configuration:
"env": { "GEMINI_API_KEY": "your-api-key-here" }`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: statusText + sourceInfo,
        },
      ],
      isError: false,
    };
  }


  private ensureConfigured(): boolean {
    return this.config !== null && this.genAI !== null;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private async initializeAzureStorage(): Promise<void> {
    if (!this.config?.azureStorageConnectionString) {
      return; // Azure storage not configured, will fall back to local storage
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.config.azureStorageConnectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.config.azureStorageContainerName);
      
      // Create container if it doesn't exist
      await this.containerClient.createIfNotExists({
        access: 'blob' // Allow public read access to blobs
      });
      console.log(`✅ Azure Blob Storage initialized: container '${this.config.azureStorageContainerName}'`);
    } catch (error) {
      console.warn('Failed to initialize Azure Storage:', error);
      // Continue without Azure storage - will fall back to local storage
    }
  }

  private async ensureAzureStorageInitialized(): Promise<void> {
    // Check if Azure Storage connection string is available from environment
    const envAzureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const envAzureContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'nano-banana-images';
    
    if (envAzureConnectionString && !this.containerClient) {
      // Update config with environment variables if not already set
      if (this.config) {
        this.config.azureStorageConnectionString = envAzureConnectionString;
        this.config.azureStorageContainerName = envAzureContainerName;
      }
      
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(envAzureConnectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(envAzureContainerName);
        
        // Create container if it doesn't exist
        await this.containerClient.createIfNotExists({
          access: 'blob' // Allow public read access to blobs
        });
        console.log(`✅ Azure Blob Storage initialized from environment: container '${envAzureContainerName}'`);
      } catch (error) {
        console.warn('Failed to initialize Azure Storage from environment:', error);
        // Continue without Azure storage - will fall back to local storage
      }
    }
  }

  private async uploadToAzureBlob(imageBuffer: Buffer, fileName: string): Promise<string | null> {
    if (!this.containerClient) {
      console.log('🔍 Azure Blob Storage not configured, using local storage');
      return null;
    }

    try {
      console.log(`🚀 Uploading image to Azure Blob Storage: ${fileName}`);
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
        blobHTTPHeaders: {
          blobContentType: 'image/png'
        }
      });
      
      console.log(`✅ Successfully uploaded to Azure: ${blockBlobClient.url}`);
      return blockBlobClient.url;
    } catch (error) {
      console.error('❌ Failed to upload to Azure Blob Storage:', error);
      return null;
    }
  }

  private getImagesDirectory(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: Use Documents folder
      const homeDir = os.homedir();
      return path.join(homeDir, 'Documents', 'nano-banana-images');
    } else {
      // macOS/Linux: Use current directory or home directory if in system paths
      const cwd = process.cwd();
      const homeDir = os.homedir();
      
      // If in system directories, use home directory instead
      if (cwd.startsWith('/usr/') || cwd.startsWith('/opt/') || cwd.startsWith('/var/')) {
        return path.join(homeDir, 'nano-banana-images');
      }
      
      return path.join(cwd, 'generated_imgs');
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.config) {
      const configPath = path.join(process.cwd(), '.nano-banana-config.json');
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    }
  }

  private async loadConfig(): Promise<void> {
    // Try to load from environment variables first
    const envApiKey = process.env.GEMINI_API_KEY;
    const envAzureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const envAzureContainerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'nano-banana-images';
    
    if (envApiKey) {
      try {
        this.config = ConfigSchema.parse({ 
          geminiApiKey: envApiKey,
          azureStorageConnectionString: envAzureConnectionString,
          azureStorageContainerName: envAzureContainerName
        });
        this.genAI = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
        this.configSource = 'environment';
        await this.initializeAzureStorage();
        return;
      } catch (error) {
        // Invalid configuration in environment
      }
    }
    
    // Fallback to config file
    try {
      const configPath = path.join(process.cwd(), '.nano-banana-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      this.config = ConfigSchema.parse(parsedConfig);
      this.genAI = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
      this.configSource = 'config_file';
      await this.initializeAzureStorage();
    } catch {
      // Config file doesn't exist or is invalid, that's okay
      this.configSource = 'not_configured';
    }
  }

  public async run(): Promise<void> {
    await this.loadConfig();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new NanoBananaMCP();
server.run().catch(console.error);