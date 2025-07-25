import type { ProviderInfo } from '~/types/model';
import { useEffect, useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
}

export default function ModelSelector({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  apiKeys,
  modelLoading,
}: ModelSelectorProps) {
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [focusedModelIndex, setFocusedModelIndex] = useState(-1);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const modelOptionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [focusedProviderIndex, setFocusedProviderIndex] = useState(-1);
  const providerSearchInputRef = useRef<HTMLInputElement>(null);
  const providerOptionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
        setProviderSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = [...modelList]
    .filter((e) => e.provider === provider?.name && e.name)
    .filter(
      (model) =>
        model.label.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()),
    );

  const filteredProviders = providerList.filter((p) =>
    p.name.toLowerCase().includes(providerSearchQuery.toLowerCase()),
  );

  useEffect(() => {
    setFocusedModelIndex(-1);
  }, [modelSearchQuery, isModelDropdownOpen]);

  useEffect(() => {
    setFocusedProviderIndex(-1);
  }, [providerSearchQuery, isProviderDropdownOpen]);

  useEffect(() => {
    if (isModelDropdownOpen && modelSearchInputRef.current) {
      modelSearchInputRef.current.focus();
    }
  }, [isModelDropdownOpen]);

  useEffect(() => {
    if (isProviderDropdownOpen && providerSearchInputRef.current) {
      providerSearchInputRef.current.focus();
    }
  }, [isProviderDropdownOpen]);

  const handleModelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isModelDropdownOpen) {
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedModelIndex((prev) => (prev + 1 >= filteredModels.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedModelIndex((prev) => (prev - 1 < 0 ? filteredModels.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedModelIndex >= 0 && focusedModelIndex < filteredModels.length) {
          const selectedModel = filteredModels[focusedModelIndex];
          setModel?.(selectedModel.name);
          setIsModelDropdownOpen(false);
          setModelSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
        break;
      case 'Tab':
        if (!e.shiftKey && focusedModelIndex === filteredModels.length - 1) {
          setIsModelDropdownOpen(false);
        }
        break;
    }
  };

  const handleProviderKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isProviderDropdownOpen) {
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev + 1 >= filteredProviders.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev - 1 < 0 ? filteredProviders.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedProviderIndex >= 0 && focusedProviderIndex < filteredProviders.length) {
          const selectedProvider = filteredProviders[focusedProviderIndex];
          setProvider?.(selectedProvider);
          setIsProviderDropdownOpen(false);
          setProviderSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsProviderDropdownOpen(false);
        setProviderSearchQuery('');
        break;
      case 'Tab':
        if (!e.shiftKey && focusedProviderIndex === filteredProviders.length - 1) {
          setIsProviderDropdownOpen(false);
        }
        break;
    }
  };

  useEffect(() => {
    if (providerList.length === 0) {
      return;
    }
    if (provider && !providerList.some((p) => p.name === provider.name)) {
      const firstEnabledProvider = providerList[0];
      setProvider?.(firstEnabledProvider);
      const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);
      if (firstModel) {
        setModel?.(firstModel.name);
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel]);

  if (providerList.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the chat.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-col sm:flex-row">
      {/* Provider Combobox */}
      <div className="relative flex w-full" onKeyDown={handleProviderKeyDown} ref={providerDropdownRef}>
        <div
          className={classNames(
            'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
            'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
            'transition-all cursor-pointer',
            isProviderDropdownOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
          )}
          onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsProviderDropdownOpen(!isProviderDropdownOpen);
            }
          }}
          role="combobox"
          aria-expanded={isProviderDropdownOpen}
          aria-controls="provider-listbox"
          aria-haspopup="listbox"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <div className="truncate">{provider?.name || 'Select provider'}</div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
                isProviderDropdownOpen ? 'rotate-180' : undefined,
              )}
            />
          </div>
        </div>
        {isProviderDropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg"
            role="listbox"
            id="provider-listbox"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <input
                  ref={providerSearchInputRef}
                  type="text"
                  value={providerSearchQuery}
                  onChange={(e) => setProviderSearchQuery(e.target.value)}
                  placeholder="Search providers..."
                  className={classNames(
                    'w-full pl-2 py-1.5 rounded-md text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                    'transition-all',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  role="searchbox"
                  aria-label="Search providers"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>
              </div>
            </div>
            {filteredProviders.length === 0 ? (
              <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">No providers found</div>
            ) : (
              filteredProviders.map((providerOption, index) => (
                <div
                  ref={(el) => (providerOptionsRef.current[index] = el)}
                  key={providerOption.name}
                  role="option"
                  aria-selected={provider?.name === providerOption.name}
                  className={classNames(
                    'px-3 py-2 text-sm cursor-pointer',
                    'hover:bg-bolt-elements-background-depth-3',
                    'text-bolt-elements-textPrimary',
                    'outline-none',
                    provider?.name === providerOption.name || focusedProviderIndex === index
                      ? 'bg-bolt-elements-background-depth-2'
                      : undefined,
                    focusedProviderIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (setProvider) {
                      setProvider(providerOption);
                      const firstModel = modelList.find((m) => m.provider === providerOption.name);
                      if (firstModel && setModel) {
                        setModel(firstModel.name);
                      }
                    }
                    setIsProviderDropdownOpen(false);
                    setProviderSearchQuery('');
                  }}
                  tabIndex={focusedProviderIndex === index ? 0 : -1}
                >
                  {providerOption.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {/* Model Combobox */}
      <div
        className={classNames(
          'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
          'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
          'transition-all cursor-pointer',
          isModelDropdownOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
        )}
        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
        onKeyDown={handleModelKeyDown}
        role="combobox"
        aria-expanded={isModelDropdownOpen}
        aria-controls="model-listbox"
        aria-haspopup="listbox"
        tabIndex={0}
        ref={modelDropdownRef}
      >
        <div className="flex items-center justify-between">
          <div className="truncate">{modelList.find((m) => m.name === model)?.label || 'Select model'}</div>
          <div
            className={classNames(
              'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
              isModelDropdownOpen ? 'rotate-180' : undefined,
            )}
          />
        </div>
        {isModelDropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg"
            role="listbox"
            id="model-listbox"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <input
                  ref={modelSearchInputRef}
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className={classNames(
                    'w-full pl-2 py-1.5 rounded-md text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                    'transition-all',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  role="searchbox"
                  aria-label="Search models"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>
              </div>
            </div>
            {modelLoading === 'all' || modelLoading === provider?.name ? (
              <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">Loading...</div>
            ) : filteredModels.length === 0 ? (
              <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">No models found</div>
            ) : (
              filteredModels.map((modelOption, index) => (
                <div
                  ref={(el) => (modelOptionsRef.current[index] = el)}
                  key={index}
                  role="option"
                  aria-selected={model === modelOption.name}
                  className={classNames(
                    'px-3 py-2 text-sm cursor-pointer',
                    'hover:bg-bolt-elements-background-depth-3',
                    'text-bolt-elements-textPrimary',
                    'outline-none',
                    model === modelOption.name || focusedModelIndex === index
                      ? 'bg-bolt-elements-background-depth-2'
                      : undefined,
                    focusedModelIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setModel?.(modelOption.name);
                    setIsModelDropdownOpen(false);
                    setModelSearchQuery('');
                  }}
                  tabIndex={focusedModelIndex === index ? 0 : -1}
                >
                  {modelOption.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
