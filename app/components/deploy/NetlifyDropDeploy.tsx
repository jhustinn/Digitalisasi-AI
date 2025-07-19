import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';

interface NetlifyDropDeployProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyDropDeploy({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  children,
  className,
  onSuccess,
  onError
}: NetlifyDropDeployProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [step, setStep] = useState<'building' | 'zipping' | 'uploading' | 'complete'>('building');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentChatId = useStore(chatId);

  const handleDropDeploy = async () => {
    setIsDeploying(true);
    setStep('building');

    try {
      // Step 1: Build project
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

      // Step 2: Create ZIP file
      setStep('zipping');
      toast.info('Creating ZIP file...');

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
      const zipBlob = await createZipFromDirectory(finalBuildPath);

      // Step 3: Upload to Netlify Drop
      setStep('uploading');
      toast.info('Uploading to Netlify Drop...');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', zipBlob, 'project.zip');

      // Upload to Netlify Drop
      const uploadResponse = await fetch('https://api.netlify.com/api/v1/deploys', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to Netlify Drop');
      }

      const deploy = await uploadResponse.json() as any;
      setUploadProgress(50);

      // Wait for deployment to complete
      let retryCount = 0;
      const maxRetries = 60;

      while (retryCount < maxRetries) {
        const statusResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`);
        const status = await statusResponse.json() as any;
        
        setUploadProgress(50 + (retryCount / maxRetries) * 50);

        if (status.state === 'ready' || status.state === 'uploaded') {
          const siteUrl = status.ssl_url || status.url;
          
          setStep('complete');
          setUploadProgress(100);
          toast.success(`Deployed successfully! Site: ${siteUrl}`);
          
          // Redirect to deployed site
          setTimeout(() => {
            window.open(siteUrl, '_blank');
          }, 1000);

          onSuccess?.({
            deployId: deploy.id,
            siteUrl,
            isDropDeploy: true
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
      console.error('Drop deploy error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
      setStep('building');
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return;

    setIsDeploying(true);
    setStep('uploading');

    try {
      const file = files[0];
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      toast.info('Uploading to Netlify Drop...');

      // Upload to Netlify Drop
      const uploadResponse = await fetch('https://api.netlify.com/api/v1/deploys', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to Netlify Drop');
      }

      const deploy = await uploadResponse.json() as any;
      setUploadProgress(50);

      // Wait for deployment to complete
      let retryCount = 0;
      const maxRetries = 60;

      while (retryCount < maxRetries) {
        const statusResponse = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`);
        const status = await statusResponse.json() as any;
        
        setUploadProgress(50 + (retryCount / maxRetries) * 50);

        if (status.state === 'ready' || status.state === 'uploaded') {
          const siteUrl = status.ssl_url || status.url;
          
          setStep('complete');
          setUploadProgress(100);
          toast.success(`Deployed successfully! Site: ${siteUrl}`);
          
          // Redirect to deployed site
          setTimeout(() => {
            window.open(siteUrl, '_blank');
          }, 1000);

          onSuccess?.({
            deployId: deploy.id,
            siteUrl,
            isDropDeploy: true
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
      console.error('File upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
      setStep('building');
      setUploadProgress(0);
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
      case 'zipping':
        return 'Creating ZIP...';
      case 'uploading':
        return 'Uploading to Netlify Drop...';
      case 'complete':
        return 'Deployed successfully!';
      default:
        return 'Deploy to Netlify Drop';
    }
  };

  return (
    <>
      <button
        className={getButtonClasses()}
        onClick={handleDropDeploy}
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
          children || 'Deploy to Netlify Drop'
        )}
      </button>

      {isDeploying && step === 'uploading' && (
        <div className="mt-2">
          <div className="w-full bg-bolt-elements-background-depth-2 rounded-full h-2">
            <div 
              className="bg-bolt-elements-button-primary-background h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-xs text-bolt-elements-textSecondary mt-1">
            {uploadProgress.toFixed(0)}% Complete
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.html,.css,.js,.json,.txt,.md,.png,.jpg,.jpeg,.gif,.svg"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        className="hidden"
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

// Quick drop deploy component
export function NetlifyQuickDropDeploy() {
  return (
    <NetlifyDropDeploy
      variant="primary"
      size="md"
    >
      Quick Deploy to Netlify Drop
    </NetlifyDropDeploy>
  );
}

// Advanced drop deploy component
export function NetlifyAdvancedDropDeploy({ siteName }: { siteName?: string }) {
  return (
    <NetlifyDropDeploy
      variant="secondary"
      size="lg"
      onSuccess={(result) => {
        toast.success(`Deployed ${siteName || 'your project'}! Opening site...`);
      }}
      onError={(error) => {
        toast.error(`Deployment failed: ${error}`);
      }}
    >
      Deploy {siteName || 'Project'} to Netlify Drop
    </NetlifyDropDeploy>
  );
} 