import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { 
  deployToNetlify, 
  quickDeployToNetlify, 
  deployWithCustomName,
  deployWithCustomBuild,
  type NetlifyDeployResult 
} from './netlify-deploy';
import { NetlifyDeployButton, QuickNetlifyDeployButton, CustomNameNetlifyDeployButton, CustomBuildNetlifyDeployButton } from '~/components/deploy/NetlifyDeployButton';

/**
 * Example 1: Basic deployment
 * Simple deployment with default settings
 */
export function BasicDeployExample() {
  const [result, setResult] = useState<NetlifyDeployResult | null>(null);

  const handleBasicDeploy = async () => {
    const deployResult = await quickDeployToNetlify();
    
    if (deployResult.success) {
      toast.success(`Deployed successfully! Site: ${deployResult.siteUrl}`);
      setResult(deployResult);
    } else {
      toast.error(deployResult.error || 'Deployment failed');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Basic Deployment</h3>
      <button
        onClick={handleBasicDeploy}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Deploy to Netlify
      </button>
      
      {result && (
        <div className="p-4 bg-green-100 rounded">
          <p>✅ Deployment successful!</p>
          <p>Site URL: <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{result.siteUrl}</a></p>
          <p>Site ID: {result.siteId}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Custom site name deployment
 */
export function CustomNameDeployExample() {
  const [siteName, setSiteName] = useState('my-awesome-app');
  const [result, setResult] = useState<NetlifyDeployResult | null>(null);

  const handleCustomNameDeploy = async () => {
    const deployResult = await deployWithCustomName(siteName);
    
    if (deployResult.success) {
      toast.success(`Deployed as ${siteName}! Site: ${deployResult.siteUrl}`);
      setResult(deployResult);
    } else {
      toast.error(deployResult.error || 'Deployment failed');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Custom Site Name</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="Enter site name"
          className="px-3 py-2 border rounded"
        />
        <button
          onClick={handleCustomNameDeploy}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Deploy as {siteName}
        </button>
      </div>
      
      {result && (
        <div className="p-4 bg-green-100 rounded">
          <p>✅ Deployed as {siteName}!</p>
          <p>Site URL: <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{result.siteUrl}</a></p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Custom build configuration
 */
export function CustomBuildDeployExample() {
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [buildOutputDir, setBuildOutputDir] = useState('/dist');
  const [result, setResult] = useState<NetlifyDeployResult | null>(null);

  const handleCustomBuildDeploy = async () => {
    const deployResult = await deployWithCustomBuild(buildCommand, buildOutputDir);
    
    if (deployResult.success) {
      toast.success(`Custom build deployed! Site: ${deployResult.siteUrl}`);
      setResult(deployResult);
    } else {
      toast.error(deployResult.error || 'Deployment failed');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Custom Build Configuration</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">Build Command:</label>
          <input
            type="text"
            value={buildCommand}
            onChange={(e) => setBuildCommand(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Build Output Directory:</label>
          <input
            type="text"
            value={buildOutputDir}
            onChange={(e) => setBuildOutputDir(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <button
          onClick={handleCustomBuildDeploy}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Deploy with Custom Build
        </button>
      </div>
      
      {result && (
        <div className="p-4 bg-green-100 rounded">
          <p>✅ Custom build deployed!</p>
          <p>Site URL: <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{result.siteUrl}</a></p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Advanced deployment with all options
 */
export function AdvancedDeployExample() {
  const [options, setOptions] = useState({
    siteName: 'advanced-app',
    buildCommand: 'npm run build',
    buildOutputDir: '/dist',
    customDomain: '',
                environment: 'production' as 'production' | 'preview'
  });
  const [result, setResult] = useState<NetlifyDeployResult | null>(null);

  const handleAdvancedDeploy = async () => {
    const deployResult = await deployToNetlify(options);
    
    if (deployResult.success) {
      toast.success(`Advanced deployment successful! Site: ${deployResult.siteUrl}`);
      setResult(deployResult);
    } else {
      toast.error(deployResult.error || 'Deployment failed');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Advanced Deployment</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">Site Name:</label>
          <input
            type="text"
            value={options.siteName}
            onChange={(e) => setOptions({...options, siteName: e.target.value})}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Build Command:</label>
          <input
            type="text"
            value={options.buildCommand}
            onChange={(e) => setOptions({...options, buildCommand: e.target.value})}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Build Output Directory:</label>
          <input
            type="text"
            value={options.buildOutputDir}
            onChange={(e) => setOptions({...options, buildOutputDir: e.target.value})}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Custom Domain (optional):</label>
          <input
            type="text"
            value={options.customDomain}
            onChange={(e) => setOptions({...options, customDomain: e.target.value})}
            className="w-full px-3 py-2 border rounded"
            placeholder="example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Environment:</label>
          <select
            value={options.environment}
            onChange={(e) => setOptions({...options, environment: e.target.value as 'production' | 'preview'})}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="production">Production</option>
            <option value="preview">Preview</option>
          </select>
        </div>
        <button
          onClick={handleAdvancedDeploy}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
        >
          Advanced Deploy
        </button>
      </div>
      
      {result && (
        <div className="p-4 bg-green-100 rounded">
          <p>✅ Advanced deployment successful!</p>
          <p>Site URL: <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{result.siteUrl}</a></p>
          <p>Site ID: {result.siteId}</p>
          <p>Deploy ID: {result.deployId}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Using the React components
 */
export function ComponentExamples() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">React Component Examples</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">Basic Button:</h4>
          <NetlifyDeployButton />
        </div>
        
        <div>
          <h4 className="font-medium">Quick Deploy Button:</h4>
          <QuickNetlifyDeployButton />
        </div>
        
        <div>
          <h4 className="font-medium">Custom Name Button:</h4>
          <CustomNameNetlifyDeployButton siteName="my-custom-app" />
        </div>
        
        <div>
          <h4 className="font-medium">Custom Build Button:</h4>
          <CustomBuildNetlifyDeployButton 
            buildCommand="npm run build:prod" 
            buildOutputDir="/build" 
          />
        </div>
        
        <div>
          <h4 className="font-medium">Custom Button with Callbacks:</h4>
          <NetlifyDeployButton
            variant="outline"
            size="lg"
            onSuccess={(result) => {
              console.log('Deployment successful:', result);
              toast.success(`Deployed to ${result.siteUrl}`);
            }}
            onError={(error) => {
              console.error('Deployment failed:', error);
              toast.error(error);
            }}
          >
            Deploy with Callbacks
          </NetlifyDeployButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Usage Documentation
 */
export function NetlifyDeployDocumentation() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Netlify Deployment Functions</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Quick Deploy</h3>
          <p className="text-sm text-gray-600">Deploy with default settings:</p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
{`const result = await quickDeployToNetlify(chatId);
if (result.success) {
  console.log('Site URL:', result.siteUrl);
}`}
          </pre>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">Custom Name Deploy</h3>
          <p className="text-sm text-gray-600">Deploy with custom site name:</p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
{`const result = await deployWithCustomName('my-awesome-app', chatId);
if (result.success) {
  console.log('Site URL:', result.siteUrl);
}`}
          </pre>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">Custom Build Deploy</h3>
          <p className="text-sm text-gray-600">Deploy with custom build configuration:</p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
{`const result = await deployWithCustomBuild(
  'npm run build:prod',
  '/build',
  chatId
);
if (result.success) {
  console.log('Site URL:', result.siteUrl);
}`}
          </pre>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">Advanced Deploy</h3>
          <p className="text-sm text-gray-600">Deploy with all options:</p>
          <pre className="bg-gray-100 p-2 rounded text-sm">
{`const result = await deployToNetlify({
  chatId: 'chat-123',
  siteName: 'my-app',
  buildCommand: 'npm run build',
  buildOutputDir: '/dist',
  customDomain: 'example.com',
  environment: 'production'
});
if (result.success) {
  console.log('Site URL:', result.siteUrl);
}`}
          </pre>
        </div>
      </div>
    </div>
  );
} 