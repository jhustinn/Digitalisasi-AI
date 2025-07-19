import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { NetlifyDeployButton, QuickNetlifyDeployButton, CustomNameNetlifyDeployButton } from './NetlifyDeployButton';
import { NetlifyConnectionStatus, NetlifyQuickConnectButton } from './NetlifyConnectionStatus';
import { NetlifyConnectionDialog } from './NetlifyConnectionDialog';
import { deployToNetlify, quickDeployToNetlify } from '~/lib/utils/netlify-deploy';

export function NetlifyDeployExample() {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);

  const handleDeploySuccess = (result: any) => {
    toast.success(`Deployed successfully! Site: ${result.siteUrl}`);
  };

  const handleDeployError = (error: string) => {
    toast.error(`Deployment failed: ${error}`);
  };

  const handleConnectionSuccess = () => {
    toast.success('Connected to Netlify! You can now deploy your projects.');
  };

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">
          Netlify Deployment Examples
        </h1>
        <p className="text-bolt-elements-textSecondary">
          Connect your Netlify account and deploy your projects with ease.
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Connection Status
        </h2>
        <NetlifyConnectionStatus />
      </div>

      {/* Quick Connect */}
      <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Quick Connect
        </h2>
        <NetlifyQuickConnectButton onSuccess={handleConnectionSuccess}>
          Connect Your Netlify Account
        </NetlifyQuickConnectButton>
      </div>

      {/* Deployment Buttons */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">
          Deployment Options
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Deploy */}
          <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Basic Deployment
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Deploy with default settings
            </p>
            <NetlifyDeployButton
              onSuccess={handleDeploySuccess}
              onError={handleDeployError}
            >
              Deploy to Netlify
            </NetlifyDeployButton>
          </div>

          {/* Quick Deploy */}
          <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Quick Deploy
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Fast deployment with minimal options
            </p>
            <QuickNetlifyDeployButton />
          </div>

          {/* Custom Name Deploy */}
          <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Custom Site Name
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Deploy with a custom site name
            </p>
            <CustomNameNetlifyDeployButton siteName="my-awesome-app" />
          </div>

          {/* Advanced Deploy */}
          <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Advanced Deployment
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Full control over deployment options
            </p>
            <NetlifyDeployButton
              variant="outline"
              customOptions={{
                siteName: 'advanced-app',
                buildCommand: 'npm run build:prod',
                buildOutputDir: '/dist',
                environment: 'production'
              }}
              onSuccess={handleDeploySuccess}
              onError={handleDeployError}
            >
              Advanced Deploy
            </NetlifyDeployButton>
          </div>
        </div>
      </div>

      {/* Manual Connection Dialog */}
      <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Manual Connection
        </h2>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          You can also manually trigger the connection dialog
        </p>
        <button
          onClick={() => setShowConnectionDialog(true)}
          className="px-4 py-2 bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded-md transition-colors"
        >
          Open Connection Dialog
        </button>
      </div>

      {/* Connection Dialog */}
      <NetlifyConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
        onSuccess={handleConnectionSuccess}
      />
    </div>
  );
}

// Example of programmatic deployment
export function ProgrammaticDeployExample() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleProgrammaticDeploy = async () => {
    setIsDeploying(true);
    try {
      const deployResult = await quickDeployToNetlify();
      setResult(deployResult);
      
      if (deployResult.success) {
        toast.success(`Deployed successfully! Site: ${deployResult.siteUrl}`);
      } else {
        toast.error(deployResult.error || 'Deployment failed');
      }
    } catch (error) {
      toast.error('Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAdvancedDeploy = async () => {
    setIsDeploying(true);
    try {
      const deployResult = await deployToNetlify({
        siteName: 'programmatic-app',
        buildCommand: 'npm run build',
        buildOutputDir: '/dist',
        environment: 'production'
      });
      setResult(deployResult);
      
      if (deployResult.success) {
        toast.success(`Advanced deployment successful! Site: ${deployResult.siteUrl}`);
      } else {
        toast.error(deployResult.error || 'Deployment failed');
      }
    } catch (error) {
      toast.error('Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">
        Programmatic Deployment
      </h2>
      
      <div className="space-y-4">
        <button
          onClick={handleProgrammaticDeploy}
          disabled={isDeploying}
          className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md transition-colors disabled:opacity-50"
        >
          {isDeploying ? 'Deploying...' : 'Quick Deploy (Programmatic)'}
        </button>

        <button
          onClick={handleAdvancedDeploy}
          disabled={isDeploying}
          className="px-4 py-2 bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded-md transition-colors disabled:opacity-50"
        >
          {isDeploying ? 'Deploying...' : 'Advanced Deploy (Programmatic)'}
        </button>
      </div>

      {result && (
        <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
          <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
            Deployment Result
          </h3>
          <pre className="text-sm text-bolt-elements-textSecondary overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 