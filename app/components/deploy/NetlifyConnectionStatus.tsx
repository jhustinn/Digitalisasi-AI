import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { NetlifyConnectionDialog } from './NetlifyConnectionDialog';
import { classNames } from '~/utils/classNames';

interface NetlifyConnectionStatusProps {
  showConnectButton?: boolean;
  className?: string;
}

export function NetlifyConnectionStatus({ 
  showConnectButton = true, 
  className 
}: NetlifyConnectionStatusProps) {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const connection = useStore(netlifyConnection);

  const handleConnect = () => {
    setShowConnectionDialog(true);
  };

  const handleDisconnect = () => {
    // Clear the connection
    netlifyConnection.set({
      user: null,
      token: '',
      stats: undefined,
    });
  };

  if (!connection.user) {
    return (
      <div className={classNames('flex items-center gap-3', className)}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-sm text-bolt-elements-textSecondary">
            Not connected to Netlify
          </span>
        </div>
        
        {showConnectButton && (
          <button
            onClick={handleConnect}
            className="px-3 py-1 text-xs bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md transition-colors"
          >
            Connect
          </button>
        )}

        <NetlifyConnectionDialog
          isOpen={showConnectionDialog}
          onClose={() => setShowConnectionDialog(false)}
        />
      </div>
    );
  }

  return (
    <div className={classNames('flex items-center gap-3', className)}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-sm text-bolt-elements-textSecondary">
          Connected as {connection.user.full_name || connection.user.email}
        </span>
      </div>
      
      {showConnectButton && (
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 text-xs bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded-md transition-colors"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

// Quick connect button component
export function NetlifyQuickConnectButton({ 
  onSuccess,
  children 
}: { 
  onSuccess?: () => void;
  children?: React.ReactNode;
}) {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const connection = useStore(netlifyConnection);

  const handleConnectionSuccess = () => {
    setShowConnectionDialog(false);
    onSuccess?.();
  };

  if (connection.user) {
    return (
      <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span>Connected to Netlify</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConnectionDialog(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md transition-colors"
      >
        <img
          src="https://cdn.simpleicons.org/netlify"
          alt="Netlify"
          className="w-4 h-4"
        />
        {children || 'Connect to Netlify'}
      </button>

      <NetlifyConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
        onSuccess={handleConnectionSuccess}
      />
    </>
  );
} 