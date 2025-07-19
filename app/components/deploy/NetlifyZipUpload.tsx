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

interface NetlifyZipUploadProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyZipUpload({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  children,
  className,
  onSuccess,
  onError
}: NetlifyZipUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleZipUpload = async () => {
    // Check if Netlify is connected
    if (!netlifyConn.user || !netlifyConn.token) {
      setShowConnectionDialog(true);
      return;
    }

    setIsUploading(true);

    try {
      // Get current artifact
      const artifact = workbenchStore.firstArtifact;
      if (!artifact) {
        throw new Error('No active project found');
      }

      // Build the project first
      toast.info('Building project...');
      
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

      // Add and run build action
      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        throw new Error('Build failed. Please check your project configuration.');
      }

      // Get build files
      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');
      
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
      toast.info('Creating ZIP file...');
      const zipBlob = await createZipFromDirectory(finalBuildPath);

      // Get existing site ID or create new site
      const existingSiteId = localStorage.getItem(`netlify-site-${currentChatId}`);
      const siteName = `digitalisasi-ai-${currentChatId}-${Date.now()}`;

      // Create site if needed
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

      // Create deployment with ZIP
      toast.info('Uploading ZIP to Netlify...');
      const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${netlifyConn.token}`,
          'Content-Type': 'application/zip',
        },
        body: zipBlob,
      });

      if (!deployResponse.ok) {
        throw new Error('Failed to upload ZIP to Netlify');
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
          
          toast.success(`Deployed successfully! Redirecting to Netlify...`);
          
          // Redirect to Netlify dashboard
          setTimeout(() => {
            window.open(`https://app.netlify.com/sites/${targetSiteId}`, '_blank');
          }, 1000);

          onSuccess?.({
            siteId: targetSiteId,
            deployId: deploy.id,
            siteUrl,
            netlifyUrl: `https://app.netlify.com/sites/${targetSiteId}`
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

    } catch (error) {
      console.error('ZIP upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConnectionSuccess = () => {
    setShowConnectionDialog(false);
    // Automatically start upload after successful connection
    handleZipUpload();
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
        'opacity-50 cursor-not-allowed': isUploading,
        'cursor-not-allowed': isUploading
      },
      className
    );
  };

  return (
    <>
      <button
        className={getButtonClasses()}
        onClick={handleZipUpload}
        disabled={isUploading}
      >
        {showIcon && (
          <img
            className="w-4 h-4 mr-2"
            src="https://cdn.simpleicons.org/netlify"
            alt="Netlify"
          />
        )}
        {isUploading ? (
          <>
            <div className="i-svg-spinners:90-ring-with-bg w-4 h-4 mr-2" />
            Uploading ZIP to Netlify...
          </>
        ) : (
          children || (netlifyConn.user ? 'Upload ZIP to Netlify' : 'Connect & Upload')
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

// Quick ZIP upload component
export function NetlifyQuickZipUpload() {
  return (
    <NetlifyZipUpload
      variant="primary"
      size="md"
    >
      Quick ZIP Upload to Netlify
    </NetlifyZipUpload>
  );
}

// Advanced ZIP upload component
export function NetlifyAdvancedZipUpload({ siteName }: { siteName?: string }) {
  return (
    <NetlifyZipUpload
      variant="secondary"
      size="lg"
      onSuccess={(result) => {
        toast.success(`Uploaded ${siteName || 'your project'}! Opening Netlify...`);
      }}
      onError={(error) => {
        toast.error(`Upload failed: ${error}`);
      }}
    >
      Upload {siteName || 'Project'} ZIP to Netlify
    </NetlifyZipUpload>
  );
} 