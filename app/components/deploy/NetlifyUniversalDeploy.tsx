import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';
import { NetlifyConnectionDialog } from './NetlifyConnectionDialog';
import { classNames } from '~/utils/classNames';

interface NetlifyUniversalDeployProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyUniversalDeploy({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  children,
  className,
  onSuccess,
  onError
}: NetlifyUniversalDeployProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [step, setStep] = useState<'checking' | 'connecting' | 'building' | 'deploying' | 'complete'>('checking');
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleUniversalDeploy = async () => {
    setIsDeploying(true);
    setStep('checking');

    try {
      // Step 1: Check connection and choose deployment method
      let deploymentMethod: 'authenticated' | 'drop' | 'demo' = 'drop';
      
      if (netlifyConn.user && netlifyConn.token) {
        deploymentMethod = 'authenticated';
      } else {
        // Try to use environment variable
        const envToken = process.env.NETLIFY_TOKEN || localStorage.getItem('netlify-token');
        if (envToken) {
          // Test the token
          const testResponse = await fetch('https://api.netlify.com/api/v1/user', {
            headers: {
              Authorization: `Bearer ${envToken}`,
            },
          });

          if (testResponse.ok) {
            const userData = await testResponse.json();
            netlifyConnection.set({
              user: userData,
              token: envToken,
            });
            deploymentMethod = 'authenticated';
            toast.success('Connected to Netlify automatically!');
          }
        }
      }

      // Step 2: Build project
      setStep('building');
      toast.info('Building project...');
      
      const artifact = workbenchStore.firstArtifact;
      if (!artifact) {
        throw new Error('No active project found');
      }

      const actionId = 'build-' + Date.now();
      const actionData = {
        messageId: 'netlify build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        throw new Error('Build failed. Please check your project configuration.');
      }

      // Step 3: Deploy based on method
      setStep('deploying');
      
      if (deploymentMethod === 'authenticated') {
        await deployWithAuthentication();
      } else {
        await deployWithDrop();
      }

    } catch (error) {
      console.error('Universal deploy error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
      setStep('checking');
    }
  };

  const deployWithAuthentication = async () => {
    toast.info('Deploying to Netlify (Authenticated)...');

    const container = await webcontainer;
    const buildPath = workbenchStore.firstArtifact?.runner.buildOutput?.path.replace('/home/project', '') || '';
    
    // Find build output directory
    let finalBuildPath = buildPath;
    const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

    let buildPathExists = false;
    for (const dir of commonOutputDirs) {
      try {
        await container.fs.readdir(dir);
        finalBuildPath = dir;
        buildPathExists = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!buildPathExists) {
      throw new Error('Could not find build output directory. Please check your build configuration.');
    }

    // Collect all files
    const fileContents = await getAllFiles(finalBuildPath);

    // Create site and deploy
    const siteName = `digitalisasi-ai-${currentChatId}-${Date.now()}`;
    const existingSiteId = localStorage.getItem(`netlify-site-${currentChatId}`);

    let targetSiteId = existingSiteId;
    if (!targetSiteId) {
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${netlifyConn.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: siteName,
          custom_domain: null,
        }),
      });

      if (!createSiteResponse.ok) {
        throw new Error('Failed to create Netlify site');
      }

      const newSite = await createSiteResponse.json() as any;
      targetSiteId = newSite.id;
      localStorage.setItem(`netlify-site-${currentChatId}`, targetSiteId || '');
    }

    // Create deployment
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${netlifyConn.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: fileContents,
        async: true,
        skip_processing: false,
        draft: false,
      }),
    });

    if (!deployResponse.ok) {
      throw new Error('Failed to create deployment');
    }

    const deploy = await deployResponse.json() as any;

    // Wait for deployment to complete
    let retryCount = 0;
    const maxRetries = 60;

    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`, {
        headers: {
          Authorization: `Bearer ${netlifyConn.token}`,
        },
      });

      const status = await statusResponse.json() as any;

      if (status.state === 'ready' || status.state === 'uploaded') {
        const siteUrl = status.ssl_url || status.url;
        
        setStep('complete');
        toast.success(`Deployed successfully! Site: ${siteUrl}`);
        
        // Redirect to Netlify dashboard
        setTimeout(() => {
          window.open(`https://app.netlify.com/sites/${targetSiteId}`, '_blank');
        }, 1000);

        onSuccess?.({
          siteId: targetSiteId,
          deployId: deploy.id,
          siteUrl,
          netlifyUrl: `https://app.netlify.com/sites/${targetSiteId}`,
          method: 'authenticated'
        });

        return;
      }

      if (status.state === 'error') {
        throw new Error('Deployment failed: ' + (status.error_message || 'Unknown error'));
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Deployment timed out');
  };

  const deployWithDrop = async () => {
    toast.info('Deploying to Netlify Drop...');

    const container = await webcontainer;
    const buildPath = workbenchStore.firstArtifact?.runner.buildOutput?.path.replace('/home/project', '') || '';
    
    // Find build output directory
    let finalBuildPath = buildPath;
    const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

    let buildPathExists = false;
    for (const dir of commonOutputDirs) {
      try {
        await container.fs.readdir(dir);
        finalBuildPath = dir;
        buildPathExists = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!buildPathExists) {
      throw new Error('Could not find build output directory. Please check your build configuration.');
    }

    // Create ZIP file
    const zipBlob = await createZipFromDirectory(finalBuildPath);

    // Upload to Netlify Drop
    const formData = new FormData();
    formData.append('file', zipBlob, 'project.zip');

    const uploadResponse = await fetch('https://api.netlify.com/api/v1/deploys', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to Netlify Drop');
    }

    const deploy = await uploadResponse.json() as any;

    // Wait for deployment to complete
    let retryCount = 0;
    const maxRetries = 60;

    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`);
      const status = await statusResponse.json() as any;

      if (status.state === 'ready' || status.state === 'uploaded') {
        const siteUrl = status.ssl_url || status.url;
        
        setStep('complete');
        toast.success(`Deployed successfully! Site: ${siteUrl}`);
        
        // Redirect to deployed site
        setTimeout(() => {
          window.open(siteUrl, '_blank');
        }, 1000);

        onSuccess?.({
          deployId: deploy.id,
          siteUrl,
          method: 'drop'
        });

        return;
      }

      if (status.state === 'error') {
        throw new Error('Deployment failed: ' + (status.error_message || 'Unknown error'));
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Deployment timed out');
  };

  const handleConnectionSuccess = () => {
    setShowConnectionDialog(false);
    // Automatically start deployment after successful connection
    handleUniversalDeploy();
  };

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    const variantClasses = {
      primary: 'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text focus:ring-bolt-elements-button-primary-background',
      secondary: 'bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text focus:ring-bolt-elements-button-secondary-background',
      outline: 'border border-bolt-elements-borderColor bg-transparent hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary focus:ring-bolt-elements-borderColor'
    };

    return classNames(
      baseClasses,
      sizeClasses[size],
      variantClasses[variant],
      {
        'opacity-50 cursor-not-allowed': isDeploying,
        'cursor-not-allowed': isDeploying
      },
      className
    );
  };

  const getStepText = () => {
    switch (step) {
      case 'checking':
        return 'Checking deployment method...';
      case 'connecting':
        return 'Connecting to Netlify...';
      case 'building':
        return 'Building project...';
      case 'deploying':
        return 'Deploying to Netlify...';
      case 'complete':
        return 'Deployed successfully!';
      default:
        return 'Deploy to Netlify';
    }
  };

  return (
    <>
      <button
        className={getButtonClasses()}
        onClick={handleUniversalDeploy}
        disabled={isDeploying}
      >
        {showIcon && (
          <img
            className="w-4 h-4 mr-2"
            src="https://cdn.simpleicons.org/netlify"
            alt="Netlify"
          />
        )}
        {isDeploying ? (
          <>
            <div className="i-svg-spinners:90-ring-with-bg w-4 h-4 mr-2" />
            {getStepText()}
          </>
        ) : (
          children || 'Deploy to Netlify'
        )}
      </button>

      <NetlifyConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
        onSuccess={handleConnectionSuccess}
      />
    </>
  );
}

// Helper function to get all files from a directory
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

// Helper function to create ZIP from directory
async function createZipFromDirectory(dirPath: string): Promise<Blob> {
  const container = await webcontainer;
  const files: Array<{ name: string; content: string }> = [];

  // Recursively get all files
  async function getAllFiles(currentPath: string, basePath: string) {
    const entries = await container.fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = fullPath.replace(basePath, '').replace(/^\/+/, '');

      if (entry.isFile()) {
        const content = await container.fs.readFile(fullPath, 'utf-8');
        files.push({
          name: relativePath,
          content
        });
      } else if (entry.isDirectory()) {
        await getAllFiles(fullPath, basePath);
      }
    }
  }

  await getAllFiles(dirPath, dirPath);

  // Create ZIP using JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Add all files to ZIP
  files.forEach(file => {
    zip.file(file.name, file.content);
  });

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

// Quick universal deploy component
export function NetlifyQuickUniversalDeploy() {
  return (
    <NetlifyUniversalDeploy
      variant="primary"
      size="md"
    >
      Quick Deploy to Netlify
    </NetlifyUniversalDeploy>
  );
}

// Advanced universal deploy component
export function NetlifyAdvancedUniversalDeploy({ siteName }: { siteName?: string }) {
  return (
    <NetlifyUniversalDeploy
      variant="secondary"
      size="lg"
      onSuccess={(result) => {
        toast.success(`Deployed ${siteName || 'your project'}! Opening site...`);
      }}
      onError={(error) => {
        toast.error(`Deployment failed: ${error}`);
      }}
    >
      Deploy {siteName || 'Project'} to Netlify
    </NetlifyUniversalDeploy>
  );
} 