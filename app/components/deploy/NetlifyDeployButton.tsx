import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { chatId } from '~/lib/persistence/useChatHistory';
import { 
  deployToNetlify, 
  quickDeployToNetlify, 
  deployWithCustomName,
  type NetlifyDeployOptions,
  type NetlifyDeployResult 
} from '~/lib/utils/netlify-deploy';
import { classNames } from '~/utils/classNames';
import { NetlifyConnectionDialog } from './NetlifyConnectionDialog';

interface NetlifyDeployButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  customOptions?: NetlifyDeployOptions;
  onSuccess?: (result: NetlifyDeployResult) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function NetlifyDeployButton({
  variant = 'primary',
  size = 'md',
  showIcon = true,
  customOptions,
  onSuccess,
  onError,
  children,
  className
}: NetlifyDeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleDeploy = async () => {
    // Check if Netlify is connected
    if (!netlifyConn.user || !netlifyConn.token) {
      setShowConnectionDialog(true);
      return;
    }

    setIsDeploying(true);

    try {
      let result: NetlifyDeployResult;

      if (customOptions) {
        result = await deployToNetlify({
          ...customOptions,
          chatId: customOptions.chatId || currentChatId
        });
      } else {
        result = await quickDeployToNetlify(currentChatId);
      }

      if (result.success) {
        toast.success(`Deployed successfully! Site URL: ${result.siteUrl}`);
        onSuccess?.(result);
      } else {
        toast.error(result.error || 'Deployment failed');
        onError?.(result.error || 'Deployment failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleConnectionSuccess = () => {
    setShowConnectionDialog(false);
    // Automatically start deployment after successful connection
    handleDeploy();
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
        'opacity-50 cursor-not-allowed': isDeploying || !netlifyConn.user,
        'cursor-not-allowed': isDeploying || !netlifyConn.user
      },
      className
    );
  };

  return (
    <>
      <button
        className={getButtonClasses()}
        onClick={handleDeploy}
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
            Deploying...
          </>
        ) : (
          children || (netlifyConn.user ? 'Deploy to Netlify' : 'Connect to Netlify')
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

// Quick deploy button component
export function QuickNetlifyDeployButton({ chatId }: { chatId?: string }) {
  return (
    <NetlifyDeployButton
      variant="primary"
      size="md"
      customOptions={{ chatId }}
    >
      Quick Deploy
    </NetlifyDeployButton>
  );
}

// Custom name deploy button component
export function CustomNameNetlifyDeployButton({ 
  siteName, 
  chatId 
}: { 
  siteName: string; 
  chatId?: string 
}) {
  return (
    <NetlifyDeployButton
      variant="secondary"
      size="md"
      customOptions={{ 
        chatId, 
        siteName,
        buildCommand: 'npm run build'
      }}
    >
      Deploy as {siteName}
    </NetlifyDeployButton>
  );
}

// Custom build deploy button component
export function CustomBuildNetlifyDeployButton({
  buildCommand,
  buildOutputDir,
  chatId
}: {
  buildCommand: string;
  buildOutputDir: string;
  chatId?: string;
}) {
  return (
    <NetlifyDeployButton
      variant="outline"
      size="md"
      customOptions={{
        chatId,
        buildCommand,
        buildOutputDir
      }}
    >
      Custom Build Deploy
    </NetlifyDeployButton>
  );
} 