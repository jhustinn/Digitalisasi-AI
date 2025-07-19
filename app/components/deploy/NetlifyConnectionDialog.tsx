import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';

interface NetlifyConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NetlifyConnectionDialog({ isOpen, onClose, onSuccess }: NetlifyConnectionDialogProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'intro' | 'token' | 'success'>('intro');
  const connection = useStore(netlifyConnection);

  const handleConnect = async () => {
    if (!tokenInput.trim()) {
      toast.error('Please enter your Netlify API token');
      return;
    }

    setIsConnecting(true);

    try {
      // Test the token by fetching user info
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Invalid token or network error (${response.status})`);
      }

      const userData = await response.json();

      // Update the connection store
      updateNetlifyConnection({
        user: userData,
        token: tokenInput,
      });

      setStep('success');
      toast.success('Connected to Netlify successfully!');
      
      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);

    } catch (error) {
      console.error('Error connecting to Netlify:', error);
      toast.error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <img
                  src="https://cdn.simpleicons.org/netlify"
                  alt="Netlify"
                  className="w-8 h-8"
                />
              </div>
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-2">
                Connect to Netlify
              </h2>
              <p className="text-bolt-elements-textSecondary">
                To deploy your project to Netlify, you need to connect your Netlify account first.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  How to get your API token:
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-bolt-elements-textSecondary">
                  <li>Go to <a href="https://app.netlify.com/user/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-bolt-elements-item-contentAccent hover:underline">Netlify User Settings</a></li>
                  <li>Click "New access token"</li>
                  <li>Give it a name (e.g., "AI DIY Deploy")</li>
                  <li>Copy the generated token</li>
                  <li>Paste it in the next step</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('token')}
                  className="flex-1 px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md font-medium transition-colors"
                >
                  Continue
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        );

      case 'token':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-2">
                Enter Your API Token
              </h2>
              <p className="text-bolt-elements-textSecondary">
                Paste your Netlify API token below to connect your account.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                  API Token
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter your Netlify API token"
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive"
                  disabled={isConnecting}
                />
              </div>

              <div className="text-xs text-bolt-elements-textTertiary">
                Your token is encrypted and stored locally. We never store it on our servers.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !tokenInput.trim()}
                  className="flex-1 px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <div className="i-svg-spinners:90-ring-with-bg w-4 h-4 mr-2" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Account'
                  )}
                </button>
                <button
                  onClick={() => setStep('intro')}
                  className="px-4 py-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                  disabled={isConnecting}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <div className="i-ph:check-circle text-green-600 text-2xl" />
            </div>
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
              Connected Successfully!
            </h2>
            <p className="text-bolt-elements-textSecondary">
              Your Netlify account is now connected. You can deploy your projects to Netlify.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-xl z-50 w-full max-w-md mx-4 p-6">
          {renderStep()}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
} 