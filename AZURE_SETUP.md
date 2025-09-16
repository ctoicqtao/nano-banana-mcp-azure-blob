# Azure Blob Storage Setup Guide

This guide will help you configure Azure Blob Storage for the Nano-Banana MCP server.

## 🚀 Quick Setup

### 1. Create Azure Storage Account

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource" → "Storage account"
3. Fill in the required details:
   - **Resource group**: Create new or use existing
   - **Storage account name**: Choose a unique name (e.g., `nanobananastorage`)
   - **Region**: Choose closest to your location
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally-redundant storage) for cost efficiency

### 2. Get Connection String

1. Navigate to your storage account
2. Go to **Security + networking** → **Access keys**
3. Copy the **Connection string** from key1 or key2

### 3. Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Copy from .env.example
cp .env.example .env
```

Edit `.env` and add your Azure details:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=nano-banana-images
```

### 4. Test Configuration

Run the test script to verify your setup:

```bash
node test-azure-integration.js
```

## 🔧 MCP Client Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "npx",
      "args": ["nano-banana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key-here",
        "AZURE_STORAGE_CONNECTION_STRING": "your-azure-connection-string",
        "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
      }
    }
  }
}
```

### Cursor

```json
{
  "nano-banana": {
    "command": "npx",
    "args": ["nano-banana-mcp"],
    "env": {
      "GEMINI_API_KEY": "your-gemini-api-key-here",
      "AZURE_STORAGE_CONNECTION_STRING": "your-azure-connection-string",
      "AZURE_STORAGE_CONTAINER_NAME": "nano-banana-images"
    }
  }
}
```

## 📋 Container Settings

The MCP server will automatically:
- Create the container if it doesn't exist
- Set public read access for generated images
- Use the container name from `AZURE_STORAGE_CONTAINER_NAME` (defaults to "nano-banana-images")

## 🔗 Image URLs

When Azure Blob Storage is configured, generated images will have URLs like:
```
https://yourstorageaccount.blob.core.windows.net/nano-banana-images/generated-2024-01-15T10-30-45-abc123.png
```

These URLs are publicly accessible and can be shared directly.

## 💰 Cost Considerations

Azure Blob Storage pricing (approximate):
- **Storage**: ~$0.018 per GB per month
- **Transactions**: ~$0.0004 per 10,000 operations
- **Data transfer**: First 5GB free per month

For typical image generation usage, costs are minimal (usually under $1/month).

## 🔒 Security Best Practices

1. **Use environment variables** - Never hardcode connection strings
2. **Limit access** - Use the least privileged access keys
3. **Monitor usage** - Set up Azure alerts for unusual activity
4. **Rotate keys** - Regularly regenerate access keys

## 🐛 Troubleshooting

### Connection Issues
- Verify connection string format
- Check network connectivity
- Ensure storage account is active

### Permission Issues
- Verify access key is correct
- Check if storage account allows blob access
- Ensure container permissions are set correctly

### Fallback Behavior
If Azure Blob Storage fails, the MCP will automatically fall back to local file storage without interrupting image generation.

## 📞 Support

If you encounter issues:
1. Run `node test-azure-integration.js` to diagnose problems
2. Check Azure Portal for storage account status
3. Review MCP server logs for error messages
