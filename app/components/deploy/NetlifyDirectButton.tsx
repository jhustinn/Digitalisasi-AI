import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';

interface NetlifyDirectButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyDirectButton({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  children,
  className,
  onSuccess,
  onError
}: NetlifyDirectButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [step, setStep] = useState<'building' | 'deploying' | 'complete'>('building');
  const [progress, setProgress] = useState(0);
  const currentChatId = useStore(chatId);

  const handleDirectDeploy = async () => {
    setIsDeploying(true);
    setStep('building');
    setProgress(0);

    try {
      // Step 1: Build project
      toast.info('Building project...');
      setProgress(10);
      
      const artifact = workbenchStore.firstArtifact;
      if (!artifact) {
        throw new Error('No active project found');
      }

      // Check if we have a chatId, if not try to get it from URL
      if (!currentChatId) {
        const urlMatch = window.location.pathname.match(/\/chat\/([^/]+)/);
        const urlChatId = urlMatch ? urlMatch[1] : null;
        
        if (urlChatId) {
          // Set the chatId from URL
          chatId.set(urlChatId);
        }
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

      setProgress(40);

      // Step 2: Deploy to Netlify
      setStep('deploying');
      toast.info('Deploying to Netlify...');
      
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

      setProgress(60);

      // Collect all files
      const fileContents = await getAllFiles(finalBuildPath);
      setProgress(70);

      // Create site using public API
      const siteName = `ai-diy-${currentChatId || 'new'}-${Date.now()}`;
      
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
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
      const targetSiteId = newSite.id;
      setProgress(80);

      // Create deployment
      const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
        method: 'POST',
        headers: {
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
      setProgress(90);

      // Wait for deployment to complete
      let retryCount = 0;
      const maxRetries = 60;

      while (retryCount < maxRetries) {
        const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`);
        const status = await statusResponse.json() as any;
        
        setProgress(90 + (retryCount / maxRetries) * 10);

        if (status.state === 'ready' || status.state === 'uploaded') {
          const siteUrl = status.ssl_url || status.url;
          
          setStep('complete');
          setProgress(100);
          toast.success(`Deployed successfully! Site: ${siteUrl}`);
          
          // Redirect to deployed site
          setTimeout(() => {
            window.open(siteUrl, '_blank');
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
      console.error('Direct deploy error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
      setStep('building');
      setProgress(0);
    }
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
    <div className="flex flex-col items-center">
      <button
        className={getButtonClasses()}
        onClick={handleDirectDeploy}
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

      {isDeploying && (
        <div className="mt-3 w-full max-w-xs">
          <div className="w-full bg-bolt-elements-background-depth-2 rounded-full h-2">
            <div 
              className="bg-bolt-elements-button-primary-background h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-bolt-elements-textSecondary mt-1 text-center">
            {progress.toFixed(0)}% Complete
          </div>
        </div>
      )}
    </div>
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

// Quick deploy button
export function NetlifyQuickDeployButton() {
  return (
    <NetlifyDirectButton
      variant="primary"
      size="md"
    >
      Deploy to Netlify
    </NetlifyDirectButton>
  );
}

// Advanced deploy button
export function NetlifyAdvancedDeployButton({ siteName }: { siteName?: string }) {
  return (
    <NetlifyDirectButton
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
    </NetlifyDirectButton>
  );
} 