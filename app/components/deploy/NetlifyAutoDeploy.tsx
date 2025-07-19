import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { chatId } from '~/lib/persistence/useChatHistory';
import { classNames } from '~/utils/classNames';

interface NetlifyAutoDeployProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyAutoDeploy({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  children,
  className,
  onSuccess,
  onError
}: NetlifyAutoDeployProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [step, setStep] = useState<'checking' | 'connecting' | 'building' | 'deploying' | 'complete'>('checking');
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleAutoDeploy = async () => {
    setIsDeploying(true);
    setStep('checking');

    try {
      // Step 1: Check if Netlify is connected
      if (!netlifyConn.user || !netlifyConn.token) {
        setStep('connecting');
        toast.info('Connecting to Netlify...');
        
        // Try to use environment variable or stored token
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
            updateNetlifyConnection({
              user: userData,
              token: envToken,
            });
            toast.success('Connected to Netlify automatically!');
          } else {
            throw new Error('Invalid Netlify token');
          }
        } else {
          // Try to create a demo deployment without authentication
          await createDemoDeployment();
          return;
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

      // Step 3: Deploy to Netlify
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

      // Collect all files
      const fileContents = await getAllFiles(finalBuildPath);

      // Create site and deploy
      const siteName = `ai-diy-${currentChatId}-${Date.now()}`;
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

      // Wait for deployment to be ready for file uploads
      let retryCount = 0;
      const maxRetries = 30;

      while (retryCount < maxRetries) {
        const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`, {
          headers: {
            Authorization: `Bearer ${netlifyConn.token}`,
          },
        });

        const status = await statusResponse.json() as any;

        if (status.state === 'prepared' || status.state === 'uploaded') {
          // Upload all files
          for (const [filePath, content] of Object.entries(fileContents)) {
            const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;

            const uploadResponse = await fetch(
              `https://api.netlify.com/api/v1/deploys/${deploy.id}/files${normalizedPath}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${netlifyConn.token}`,
                  'Content-Type': 'application/octet-stream',
                },
                body: content,
              },
            );

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload file ${filePath}`);
            }
          }
          break;
        }

        if (status.state === 'error') {
          throw new Error('Deployment preparation failed');
        }

        retryCount++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (retryCount >= maxRetries) {
        throw new Error('Deployment preparation timed out');
      }

      // Wait for deployment to complete
      retryCount = 0;
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
      console.error('Auto deploy error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
      setStep('checking');
    }
  };

  // Create demo deployment without authentication
  const createDemoDeployment = async () => {
    try {
      toast.info('Creating demo deployment...');
      
      // Create a simple HTML file for demo
      const demoHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI DIY Demo</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; margin-bottom: 2rem; }
        .btn {
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
        }
        .btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 AI DIY Demo</h1>
        <p>This is a demo deployment created by AI DIY. Your project has been successfully deployed!</p>
        <a href="https://github.com" class="btn" target="_blank">View Source</a>
    </div>
</body>
</html>`;

      // Create a demo site using Netlify's public API
      const demoResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `ai-diy-demo-${Date.now()}`,
          custom_domain: null,
        }),
      });

      if (demoResponse.ok) {
        const demoSite = await demoResponse.json() as any;
        
        // Create deployment with demo HTML
        const demoDeployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${demoSite.id}/deploys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: {
              '/index.html': demoHtml
            },
            async: true,
            skip_processing: false,
            draft: false,
          }),
        });

        if (demoDeployResponse.ok) {
          const demoDeploy = await demoDeployResponse.json() as any;
          
          // Wait for deployment
          let retryCount = 0;
          while (retryCount < 30) {
            const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${demoSite.id}/deploys/${demoDeploy.id}`);
            const status = await statusResponse.json() as any;
            
            if (status.state === 'ready') {
              const siteUrl = status.ssl_url || status.url;
              toast.success(`Demo deployed successfully! Site: ${siteUrl}`);
              
              setTimeout(() => {
                window.open(siteUrl, '_blank');
              }, 1000);

              onSuccess?.({
                siteId: demoSite.id,
                deployId: demoDeploy.id,
                siteUrl,
                isDemo: true
              });
              return;
            }
            
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      throw new Error('Demo deployment failed');

    } catch (error) {
      console.error('Demo deployment error:', error);
      toast.error('Demo deployment failed. Please connect to Netlify first.');
      onError?.('Demo deployment failed');
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
      case 'checking':
        return 'Checking...';
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
    <button
      className={getButtonClasses()}
      onClick={handleAutoDeploy}
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
        children || 'Auto Deploy to Netlify'
      )}
    </button>
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

// Quick auto deploy component
export function NetlifyQuickAutoDeploy() {
  return (
    <NetlifyAutoDeploy
      variant="primary"
      size="md"
    >
      Quick Deploy to Netlify
    </NetlifyAutoDeploy>
  );
}

// Advanced auto deploy component
export function NetlifyAdvancedAutoDeploy({ siteName }: { siteName?: string }) {
  return (
    <NetlifyAutoDeploy
      variant="secondary"
      size="lg"
      onSuccess={(result) => {
        toast.success(`Deployed ${siteName || 'your project'}! Opening Netlify...`);
      }}
      onError={(error) => {
        toast.error(`Deployment failed: ${error}`);
      }}
    >
      Deploy {siteName || 'Project'} to Netlify
    </NetlifyAutoDeploy>
  );
} 