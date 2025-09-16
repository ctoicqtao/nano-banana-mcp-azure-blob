# Nano-Banana MCP Server with Azure Blob Storage 🍌☁️

> **🔗 This project is forked from [nano-banana-mcp](https://github.com/conechoai/nano-banana-mcp)** with enhanced Azure Blob Storage support for cloud-based image storage.

A Model Context Protocol (MCP) server that provides AI image generation and editing capabilities using Google's Gemini 2.5 Flash Image API. Generate stunning images, edit existing ones, and iterate on your creations with simple text prompts. Images can be stored locally or uploaded to Azure Blob Storage for cloud access.

## ✨ Features

- 🎨 **Generate Images**: Create new images from text descriptions
- ✏️ **Edit Images**: Modify existing images with text prompts
- 🔄 **Iterative Editing**: Continue editing the last generated/edited image
- 🖼️ **Multiple Reference Images**: Use reference images for style transfer and guidance
- ☁️ **Azure Blob Storage**: Upload images to cloud storage with public URLs
- 📁 **Local Storage Fallback**: Automatic fallback to local storage if Azure is unavailable
- 🌍 **Cross-Platform**: Smart file paths for Windows, macOS, and Linux
- 🔧 **Easy Setup**: Simple configuration with API key
- 🔗 **Shareable URLs**: Cloud-stored images get public URLs for easy sharing

## 🔑 Setup

1. **Get your Gemini API key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Copy it for configuration

2. **Optional: Set up Azure Blob Storage** (for cloud storage):
   - See the detailed [Azure Setup Guide](AZURE_SETUP.md)
   - Create an Azure Storage Account
   - Get your connection string
   - Configure environment variables

3. **Configure the MCP server**:
   See configuration examples for your specific client below (Claude Code, Cursor, or other MCP clients).

## 💻 Usage with Claude Code

### Configuration:

Add this to your Claude Code MCP settings:

**Option A: With Azure Blob Storage (Recommended for cloud storage)**
```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["nano-banana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here",
        "AZURE_STORAGE_CONNECTION_STRING": "your-azure-storage-connection-string",
        "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
      }
    }
  }
}
```

**Option B: Local storage only**
```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["nano-banana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here"
      }
    }
  }
}
```

### Usage Examples:
```
Generate an image of a sunset over mountains
```

```
Edit this image to add some birds in the sky
```

```
Continue editing to make it more dramatic
```

## 🎯 Usage with Cursor

### Configuration:

Add to your Cursor MCP configuration:

**Option A: With Azure Blob Storage (Recommended for cloud storage)**
```json
{
  "nano-banana": {
    "command": "npx",
    "args": ["nano-banana-mcp"],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key-here",
      "AZURE_STORAGE_CONNECTION_STRING": "your-azure-storage-connection-string",
      "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
    }
  }
}
```

**Option B: Local storage only**
```json
{
  "nano-banana": {
    "command": "npx",
    "args": ["nano-banana-mcp"],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key-here"
    }
  }
}
```

### Usage Examples:
- Ask Cursor to generate images for your app
- Create mockups and prototypes  
- Generate assets for your projects

## 🔧 For Other MCP Clients

If you're using a different MCP client, you can configure nano-banana-mcp using any of these methods:

### Configuration Methods

**Method A: Environment Variable in MCP Config with Azure Blob Storage (Recommended)**
```json
{
  "nano-banana": {
    "command": "npx",
    "args": ["nano-banana-mcp"],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key-here",
      "AZURE_STORAGE_CONNECTION_STRING": "your-azure-storage-connection-string",
      "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
    }
  }
}
```

**Method B: System Environment Variable**
```bash
export GEMINI_API_KEY="your-gemini-api-key-here"
export AZURE_STORAGE_CONNECTION_STRING="your-azure-connection-string"
export AZURE_STORAGE_CONTAINER_NAME="nano-banana-images"
npx nano-banana-mcp
```

**Method C: Using the Configure Tool**
```bash
npx nano-banana-mcp
# The server will prompt you to configure when first used
# This creates a local .nano-banana-config.json file
```

## 🛠️ Available Commands

### `generate_image`
Create a new image from a text prompt. Images are automatically uploaded to Azure Blob Storage if configured, or saved locally as fallback.
```typescript
generate_image({
  prompt: "A futuristic city at night with neon lights"
})
```

### `edit_image`
Edit a specific image file (supports both local files and Azure Blob Storage URLs).
```typescript
edit_image({
  imagePath: "/path/to/image.png", // or Azure Blob URL
  prompt: "Add a rainbow in the sky",
  referenceImages?: ["/path/to/reference.jpg"] // optional
})
```

### `continue_editing`
Continue editing the last generated/edited image (works with both local and cloud-stored images).
```typescript
continue_editing({
  prompt: "Make it more colorful",
  referenceImages?: ["/path/to/style.jpg"] // optional
})
```

### `get_last_image_info`
Get information about the last generated image (shows storage location and access details).
```typescript
get_last_image_info()
```

### `configure_gemini_token`
Configure your Gemini API key.
```typescript
configure_gemini_token({
  apiKey: "your-gemini-api-key"
})
```

### `get_configuration_status`
Check if the API key is configured.
```typescript
get_configuration_status()
```

## ⚙️ Configuration Priority

The MCP server loads your API key in the following priority order:

1. **🥇 MCP Configuration Environment Variables** (Highest Priority)
   - Set in your `claude_desktop_config.json` or MCP client config
   - Most secure as it's contained within the MCP configuration
   - Example: `"env": { "GEMINI_API_KEY": "your-key" }`

2. **🥈 System Environment Variables**
   - Set in your shell/system environment
   - Example: `export GEMINI_API_KEY="your-key"`

3. **🥉 Local Configuration File** (Lowest Priority)
   - Created when using the `configure_gemini_token` tool
   - Stored as `.nano-banana-config.json` in current directory
   - Automatically ignored by Git and NPM

**💡 Recommendation**: Use Method 1 (MCP config env variables) for the best security and convenience.

## 📁 File Storage

### Azure Blob Storage (Recommended)

For cloud storage, configure Azure Blob Storage by adding these environment variables:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["nano-banana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here",
        "AZURE_STORAGE_CONNECTION_STRING": "your-azure-storage-connection-string",
        "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
      }
    }
  }
}
```

**Azure Setup:**
1. Create an Azure Storage Account in the [Azure Portal](https://portal.azure.com)
2. Go to **Access keys** and copy the connection string
3. Set `AZURE_STORAGE_CONNECTION_STRING` environment variable
4. Optionally set `AZURE_STORAGE_CONTAINER_NAME` (defaults to "nano-banana-images")

**Benefits:**
- ☁️ Images stored in the cloud with public URLs
- 🔗 Easy sharing and access from anywhere
- 📈 Scalable storage solution
- 🔒 Secure with Azure's enterprise-grade security

### Local Storage (Fallback)

If Azure Blob Storage is not configured, images are saved locally to platform-appropriate locations:

- **Windows**: `%USERPROFILE%\\Documents\\nano-banana-images\\`
- **macOS/Linux**: `./generated_imgs/` (in current directory)
- **System directories**: `~/nano-banana-images/` (when run from system paths)

File naming convention:
- Generated images: `generated-[timestamp]-[id].png`
- Edited images: `edited-[timestamp]-[id].png`

## 🎨 Example Workflows

### Basic Image Generation
1. `generate_image` - Create your base image
2. `continue_editing` - Refine and improve
3. `continue_editing` - Add final touches

### Style Transfer
1. `generate_image` - Create base content
2. `edit_image` - Use reference images for style
3. `continue_editing` - Fine-tune the result

### Iterative Design
1. `generate_image` - Start with a concept
2. `get_last_image_info` - Check current state
3. `continue_editing` - Make adjustments
4. Repeat until satisfied

## 🔧 Development

This project is forked from [nano-banana-mcp](https://github.com/conechoai/nano-banana-mcp) with additional Azure Blob Storage functionality. It uses these technologies:

- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment  
- **Zod** - Schema validation
- **Google GenAI** - Image generation API
- **MCP SDK** - Model Context Protocol
- **Azure Storage SDK** - Cloud storage integration

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/nano-banana-mcp-azure-blob.git
cd nano-banana-mcp-azure-blob

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Test Azure integration
node test-azure-integration.js
```

## 📋 Requirements

- Node.js 18.0.0 or higher
- Gemini API key from Google AI Studio
- Optional: Azure Storage Account (for cloud storage)
- Compatible with Claude Code, Cursor, and other MCP clients

## 🤝 Contributing

This project is forked from [nano-banana-mcp](https://github.com/conechoai/nano-banana-mcp) with Azure Blob Storage enhancements. Contributions are welcome! Please feel free to:

- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation
- Enhance Azure storage functionality

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Original nano-banana-mcp](https://github.com/conechoai/nano-banana-mcp)** - For the base project this is forked from
- **[Claude Code](https://claude.ai/code)** - For generating the original project
- **Google AI** - For the powerful Gemini 2.5 Flash Image API
- **Microsoft Azure** - For the reliable Blob Storage service
- **Anthropic** - For the Model Context Protocol
- **Open Source Community** - For the amazing tools and libraries

## 📞 Support

- 🐛 **Issues**: Create issues for bugs or feature requests
- 📖 **Documentation**: This README, [Azure Setup Guide](AZURE_SETUP.md), and inline code comments
- 💬 **Discussions**: For questions and community support
- 🔧 **Azure Setup**: See [AZURE_SETUP.md](AZURE_SETUP.md) for detailed Azure configuration

## 🆕 What's New in This Fork

- ☁️ **Azure Blob Storage Integration**: Upload images to cloud storage with public URLs
- 🔄 **Automatic Fallback**: Seamlessly falls back to local storage if Azure is unavailable
- 🌐 **Public URLs**: Generated images get shareable public URLs when using Azure
- 📋 **Enhanced Commands**: All existing commands work with both local and cloud storage
- 🛠️ **Easy Configuration**: Simple environment variable setup for Azure

---

*🍌 Enhanced with Azure Blob Storage for better image management and sharing!*