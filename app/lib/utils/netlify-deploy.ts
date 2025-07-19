import { toast } from 'react-toastify';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';

export interface NetlifyDeployOptions {
  chatId?: string;
  siteName?: string;
  buildCommand?: string;
  buildOutputDir?: string;
  customDomain?: string;
  environment?: 'production' | 'preview';
}

export interface NetlifyDeployResult {
  success: boolean;
  siteUrl?: string;
  siteId?: string;
  deployId?: string;
  error?: string;
}

/**
 * Deploy project to Netlify
 * @param options - Deployment options
 * @returns Promise<NetlifyDeployResult>
 */
export async function deployToNetlify(options: NetlifyDeployOptions = {}): Promise<NetlifyDeployResult> {
  const {
    chatId,
    siteName,
    buildCommand = 'npm run build',
    buildOutputDir,
    customDomain,
    environment = 'production'
  } = options;

  // Check Netlify connection
  const netlifyConn = netlifyConnection.get();
  if (!netlifyConn.user || !netlifyConn.token) {
    return {
      success: false,
      error: 'Please connect to Netlify first in the settings tab!'
    };
  }

  try {
    // Get current artifact
    const artifact = workbenchStore.firstArtifact;
    if (!artifact) {
      return {
        success: false,
        error: 'No active project found'
      };
    }

    // Create deployment artifact for visual feedback
    const deploymentId = `netlify-deploy-${Date.now()}`;
    workbenchStore.addArtifact({
      id: deploymentId,
      messageId: deploymentId,
      title: 'Netlify Deployment',
      type: 'standalone',
    });

    const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

    // Start build process
    deployArtifact.runner.handleDeployAction('building', 'running', { source: 'netlify' });

    // Set up build action
    const actionId = `build-${Date.now()}`;
    const actionData: ActionCallbackData = {
      messageId: 'netlify build',
      artifactId: artifact.id,
      actionId,
      action: {
        type: 'build' as const,
        content: buildCommand,
      },
    };

    // Add and run build action
    artifact.runner.addAction(actionData);
    await artifact.runner.runAction(actionData);

    if (!artifact.runner.buildOutput) {
      deployArtifact.runner.handleDeployAction('building', 'failed', {
        error: 'Build failed. Check the terminal for details.',
        source: 'netlify',
      });
      return {
        success: false,
        error: 'Build failed'
      };
    }

    // Build succeeded, start deployment
    deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });

    // Get build files
    const container = await webcontainer;
    const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');
    
    // Determine build output directory
    let finalBuildPath = buildOutputDir || buildPath;
    const commonOutputDirs = [finalBuildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

    // Find existing build directory
    let buildPathExists = false;
    for (const dir of commonOutputDirs) {
      try {
        await container.fs.readdir(dir);
        finalBuildPath = dir;
        buildPathExists = true;
        console.log(`Using build directory: ${finalBuildPath}`);
        break;
      } catch (error) {
        console.log(`Directory ${dir} doesn't exist, trying next option.`);
        continue;
      }
    }

    if (!buildPathExists) {
      return {
        success: false,
        error: 'Could not find build output directory. Please check your build configuration.'
      };
    }

    // Collect all files from build directory
    const fileContents = await getAllFiles(finalBuildPath);

    // Get existing site ID or create new site
    const currentChatId = chatId || 'default';
    const existingSiteId = localStorage.getItem(`netlify-site-${currentChatId}`);

    // Deploy to Netlify
    const response = await fetch('/api/netlify-deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: existingSiteId || undefined,
        files: fileContents,
        token: netlifyConn.token,
        chatId: currentChatId,
        siteName: siteName || `digitalisasi-ai-${currentChatId}-${Date.now()}`,
        customDomain,
        environment
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.deploy || !data.site) {
      deployArtifact.runner.handleDeployAction('deploying', 'failed', {
        error: data.error || 'Invalid deployment response',
        source: 'netlify',
      });
      return {
        success: false,
        error: data.error || 'Invalid deployment response'
      };
    }

    // Wait for deployment to complete
    const deploymentResult = await waitForDeployment(data.site.id, data.deploy.id, netlifyConn.token);
    
    if (!deploymentResult.success) {
      deployArtifact.runner.handleDeployAction('deploying', 'failed', {
        error: deploymentResult.error || 'Deployment failed',
        source: 'netlify',
      });
      return deploymentResult;
    }

    // Store site ID
    if (data.site) {
      localStorage.setItem(`netlify-site-${currentChatId}`, data.site.id);
    }

    // Deployment successful
    deployArtifact.runner.handleDeployAction('complete', 'complete', {
      url: deploymentResult.siteUrl,
      source: 'netlify',
    });

    return {
      success: true,
      siteUrl: deploymentResult.siteUrl,
      siteId: data.site.id,
      deployId: data.deploy.id
    };

  } catch (error) {
    console.error('Netlify deploy error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed'
    };
  }
}

/**
 * Get all files from a directory recursively
 */
async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
  const container = await webcontainer;
  const files: Record<string, string> = {};
  const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isFile()) {
      const content = await container.fs.readFile(fullPath, 'utf-8');
      const deployPath = fullPath.replace(dirPath, '');
      files[deployPath] = content;
    } else if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      Object.assign(files, subFiles);
    }
  }

  return files;
}

/**
 * Wait for deployment to complete
 */
async function waitForDeployment(siteId: string, deployId: string, token: string): Promise<{ success: boolean; siteUrl?: string; error?: string }> {
  const maxAttempts = 60; // 2 minutes timeout
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const statusResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const deploymentStatus = await statusResponse.json();

      if (deploymentStatus.state === 'ready' || deploymentStatus.state === 'uploaded') {
        return {
          success: true,
          siteUrl: deploymentStatus.ssl_url || deploymentStatus.url
        };
      }

      if (deploymentStatus.state === 'error') {
        return {
          success: false,
          error: 'Deployment failed: ' + (deploymentStatus.error_message || 'Unknown error')
        };
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Status check error:', error);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  return {
    success: false,
    error: 'Deployment timed out'
  };
}

/**
 * Quick deploy function with minimal options
 */
export async function quickDeployToNetlify(chatId?: string): Promise<NetlifyDeployResult> {
  return deployToNetlify({ chatId });
}

/**
 * Deploy with custom site name
 */
export async function deployWithCustomName(siteName: string, chatId?: string): Promise<NetlifyDeployResult> {
  return deployToNetlify({ 
    chatId, 
    siteName,
    buildCommand: 'npm run build'
  });
}

/**
 * Deploy with custom build configuration
 */
export async function deployWithCustomBuild(
  buildCommand: string,
  buildOutputDir: string,
  chatId?: string
): Promise<NetlifyDeployResult> {
  return deployToNetlify({
    chatId,
    buildCommand,
    buildOutputDir
  });
} 