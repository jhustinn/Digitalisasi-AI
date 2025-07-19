import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { NetlifyDirectDeploy, NetlifyQuickDeploy, NetlifyAdvancedDeploy } from './NetlifyDirectDeploy';
import { NetlifyZipUpload, NetlifyQuickZipUpload, NetlifyAdvancedZipUpload } from './NetlifyZipUpload';
import { NetlifyDragDropUpload, NetlifyQuickDragDrop } from './NetlifyDragDropUpload';
import { NetlifyConnectionStatus } from './NetlifyConnectionStatus';

export function NetlifyUploadExamples() {
  const [activeTab, setActiveTab] = useState<'direct' | 'zip' | 'dragdrop'>('direct');

  const handleSuccess = (result: any) => {
    toast.success(`Deployed successfully! Site: ${result.siteUrl}`);
    console.log('Deployment result:', result);
  };

  const handleError = (error: string) => {
    toast.error(`Deployment failed: ${error}`);
    console.error('Deployment error:', error);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">
          Netlify Upload & Deploy Options
        </h1>
        <p className="text-bolt-elements-textSecondary">
          Choose your preferred method to upload and deploy your project to Netlify
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          Connection Status
        </h2>
        <NetlifyConnectionStatus />
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-bolt-elements-background-depth-3 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('direct')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'direct'
              ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
              : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
          }`}
        >
          Direct Deploy
        </button>
        <button
          onClick={() => setActiveTab('zip')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'zip'
              ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
              : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
          }`}
        >
          ZIP Upload
        </button>
        <button
          onClick={() => setActiveTab('dragdrop')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'dragdrop'
              ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
              : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
          }`}
        >
          Drag & Drop
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'direct' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
              Direct Deploy Options
            </h2>
            <p className="text-bolt-elements-textSecondary">
              Deploy your project directly to Netlify with automatic build and file upload
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Quick Deploy
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Fast deployment with default settings
                </p>
                <NetlifyQuickDeploy />
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Advanced Deploy
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Custom deployment with specific options
                </p>
                <NetlifyAdvancedDeploy siteName="my-awesome-app" />
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Custom Deploy
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Full control over deployment process
                </p>
                <NetlifyDirectDeploy
                  variant="outline"
                  onSuccess={handleSuccess}
                  onError={handleError}
                >
                  Custom Deploy
                </NetlifyDirectDeploy>
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Large Deploy
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  For larger projects with progress tracking
                </p>
                <NetlifyDirectDeploy
                  variant="secondary"
                  size="lg"
                  onSuccess={handleSuccess}
                  onError={handleError}
                >
                  Deploy Large Project
                </NetlifyDirectDeploy>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'zip' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
              ZIP Upload Options
            </h2>
            <p className="text-bolt-elements-textSecondary">
              Create and upload ZIP files directly to Netlify
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Quick ZIP Upload
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Fast ZIP creation and upload
                </p>
                <NetlifyQuickZipUpload />
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Advanced ZIP Upload
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Custom ZIP upload with options
                </p>
                <NetlifyAdvancedZipUpload siteName="my-zip-app" />
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Custom ZIP Upload
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Full control over ZIP creation and upload
                </p>
                <NetlifyZipUpload
                  variant="outline"
                  onSuccess={handleSuccess}
                  onError={handleError}
                >
                  Custom ZIP Upload
                </NetlifyZipUpload>
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Large ZIP Upload
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  For large projects with ZIP compression
                </p>
                <NetlifyZipUpload
                  variant="secondary"
                  size="lg"
                  onSuccess={handleSuccess}
                  onError={handleError}
                >
                  Upload Large ZIP
                </NetlifyZipUpload>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dragdrop' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
              Drag & Drop Upload
            </h2>
            <p className="text-bolt-elements-textSecondary">
              Drag and drop files directly to upload to Netlify
            </p>

            <div className="space-y-4">
              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Quick Drag & Drop
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Simple drag and drop interface
                </p>
                <NetlifyQuickDragDrop />
              </div>

              <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
                <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
                  Custom Drag & Drop
                </h3>
                <p className="text-sm text-bolt-elements-textSecondary mb-4">
                  Advanced drag and drop with callbacks
                </p>
                <NetlifyDragDropUpload
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="bg-bolt-elements-background-depth-3 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">
          How to Use
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Direct Deploy
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Automatically builds your project and uploads files directly to Netlify. 
              Best for projects with build processes.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              ZIP Upload
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Creates a ZIP file from your build output and uploads it to Netlify. 
              Good for static sites and pre-built projects.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
              Drag & Drop
            </h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Drag and drop files directly to upload. Supports individual files or ZIP files. 
              Perfect for quick uploads and manual file selection.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <div className="i-ph:rocket text-blue-600" />
          </div>
          <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
            Fast Deployment
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary">
            Deploy your projects quickly with automatic build and upload processes
          </p>
        </div>

        <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-3">
            <div className="i-ph:shield-check text-green-600" />
          </div>
          <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
            Secure Upload
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary">
            All uploads are encrypted and secure. Your API tokens are stored locally only
          </p>
        </div>

        <div className="bg-bolt-elements-background-depth-3 rounded-lg p-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
            <div className="i-ph:gear text-purple-600" />
          </div>
          <h3 className="font-medium text-bolt-elements-textPrimary mb-2">
            Multiple Options
          </h3>
          <p className="text-sm text-bolt-elements-textSecondary">
            Choose from direct deploy, ZIP upload, or drag & drop based on your needs
          </p>
        </div>
      </div>
    </div>
  );
} 