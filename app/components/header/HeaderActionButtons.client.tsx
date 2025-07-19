import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { DeployButton } from '~/components/deploy/DeployButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming && activePreview;

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    // You can also emit a custom event here if needed
    window.dispatchEvent(new CustomEvent('toggleSidebar', { detail: !sidebarOpen }));
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sidebar toggle button */}
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        title="Toggle sidebar"
      >
        <span className="i-ph:sidebar-simple h-5 w-5 text-gray-600 dark:text-gray-400" />
      </button>
      
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {shouldShowButtons && <DeployButton />}
    </div>
  );
}
