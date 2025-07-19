import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { chatId } from '~/lib/persistence/useChatHistory';
import { NetlifyConnectionDialog } from './NetlifyConnectionDialog';
import { classNames } from '~/utils/classNames';

interface NetlifyDragDropUploadProps {
  className?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function NetlifyDragDropUpload({
  className,
  onSuccess,
  onError
}: NetlifyDragDropUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const netlifyConn = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!netlifyConn.user || !netlifyConn.token) {
      setShowConnectionDialog(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileArray = Array.from(files);
      
      // Filter for ZIP files or create ZIP from multiple files
      let zipBlob: Blob;
      
      if (fileArray.length === 1 && fileArray[0].name.endsWith('.zip')) {
        zipBlob = fileArray[0];
      } else {
        // Create ZIP from multiple files
        toast.info('Creating ZIP from files...');
        zipBlob = await createZipFromFiles(fileArray);
      }

      // Get existing site ID or create new site
      const existingSiteId = localStorage.getItem(`netlify-site-${currentChatId}`);
      const siteName = `ai-diy-${currentChatId}-${Date.now()}`;

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

      // Upload ZIP to Netlify
      toast.info('Uploading to Netlify...');
      setUploadProgress(25);

      const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${netlifyConn.token}`,
          'Content-Type': 'application/zip',
        },
        body: zipBlob,
      });

      if (!deployResponse.ok) {
        throw new Error('Failed to upload to Netlify');
      }

      setUploadProgress(50);
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
        setUploadProgress(50 + (retryCount / maxRetries) * 50);

        if (status.state === 'ready' || status.state === 'uploaded') {
          const siteUrl = status.ssl_url || status.url;
          
          setUploadProgress(100);
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
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConnectionSuccess = () => {
    setShowConnectionDialog(false);
    // Re-trigger file upload after successful connection
    if (fileInputRef.current?.files) {
      handleFileUpload(fileInputRef.current.files);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  return (
    <>
      <div
        className={classNames(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          {
            'border-bolt-elements-borderColor bg-bolt-elements-background-depth-3': !isDragOver && !isUploading,
            'border-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundActive': isDragOver,
            'border-bolt-elements-button-primary-background bg-bolt-elements-button-primary-background': isUploading,
          },
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="space-y-4">
            <div className="i-svg-spinners:90-ring-with-bg w-8 h-8 mx-auto text-bolt-elements-button-primary-text" />
            <div className="text-bolt-elements-button-primary-text font-medium">
              Uploading to Netlify...
            </div>
            <div className="w-full bg-bolt-elements-background-depth-2 rounded-full h-2">
              <div 
                className="bg-bolt-elements-button-primary-background h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-sm text-bolt-elements-textSecondary">
              {uploadProgress.toFixed(0)}% Complete
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-bolt-elements-background-depth-2 rounded-full flex items-center justify-center">
              <img
                src="https://cdn.simpleicons.org/netlify"
                alt="Netlify"
                className="w-8 h-8"
              />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                Upload to Netlify
              </h3>
              <p className="text-bolt-elements-textSecondary mb-4">
                Drag and drop your files here, or click to select files
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-md font-medium transition-colors"
              >
                Select Files
              </button>
              
              <p className="text-xs text-bolt-elements-textTertiary">
                Supports ZIP files or individual files (will be zipped automatically)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.html,.css,.js,.json,.txt,.md,.png,.jpg,.jpeg,.gif,.svg"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      <NetlifyConnectionDialog
        isOpen={showConnectionDialog}
        onClose={() => setShowConnectionDialog(false)}
        onSuccess={handleConnectionSuccess}
      />
    </>
  );
}

// Helper function to create ZIP from files
async function createZipFromFiles(files: File[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Add all files to ZIP
  for (const file of files) {
    const content = await file.text();
    zip.file(file.name, content);
  }

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

// Quick drag & drop component
export function NetlifyQuickDragDrop() {
  return (
    <NetlifyDragDropUpload
      onSuccess={(result) => {
        toast.success(`Uploaded successfully! Opening Netlify...`);
      }}
      onError={(error) => {
        toast.error(`Upload failed: ${error}`);
      }}
    />
  );
} 