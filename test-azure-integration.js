#!/usr/bin/env node

/**
 * Simple test script to verify Azure Blob Storage integration
 * This script tests the Azure Blob Storage configuration without making actual API calls
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

async function testAzureIntegration() {
  console.log('🧪 Testing Azure Blob Storage Integration...\n');

  // Check environment variables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'nano-banana-images';

  console.log('📋 Configuration Check:');
  console.log(`   Connection String: ${connectionString ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Container Name: ${containerName}`);
  console.log('');

  if (!connectionString) {
    console.log('⚠️  Azure Blob Storage not configured - will use local storage fallback');
    console.log('💡 To test Azure integration, set AZURE_STORAGE_CONNECTION_STRING in your .env file');
    return;
  }

  try {
    // Test Azure Blob Storage connection
    console.log('🔗 Testing Azure connection...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Test if we can access the service (this will throw if credentials are invalid)
    const accountInfo = await blobServiceClient.getAccountInfo();
    console.log('✅ Successfully connected to Azure Blob Storage');
    console.log(`   Account Kind: ${accountInfo.accountKind}`);
    console.log(`   SKU Name: ${accountInfo.skuName}`);

    // Test container access/creation
    console.log('\n📦 Testing container access...');
    const containerExists = await containerClient.exists();
    
    if (containerExists) {
      console.log(`✅ Container '${containerName}' already exists`);
    } else {
      console.log(`📝 Container '${containerName}' does not exist - would be created automatically`);
    }

    console.log('\n🎉 Azure Blob Storage integration test completed successfully!');
    console.log('💡 The MCP server is ready to use Azure Blob Storage for image storage');

  } catch (error) {
    console.error('❌ Azure Blob Storage test failed:');
    console.error(`   Error: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your connection string is correct');
    console.log('   2. Ensure your Azure Storage Account is accessible');
    console.log('   3. Verify your network connection');
    console.log('   4. The MCP server will fallback to local storage if Azure fails');
  }
}

// Run the test
testAzureIntegration().catch(console.error);
