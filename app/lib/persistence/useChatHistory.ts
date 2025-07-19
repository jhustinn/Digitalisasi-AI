import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import {
  getMessages,
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  getSnapshot,
  setSnapshot,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

console.log('Persistence settings:', {
  VITE_DISABLE_PERSISTENCE: import.meta.env.VITE_DISABLE_PERSISTENCE,
  persistenceEnabled
});

// Always try to initialize database for local storage
export const db = persistenceEnabled ? await openDatabase() : await openDatabase();

console.log('Database initialization result:', {
  persistenceEnabled,
  dbAvailable: !!db,
  dbName: db?.name,
  dbVersion: db?.version
});

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    console.log('useChatHistory useEffect triggered:', { mixedId, dbAvailable: !!db });
    
    if (!db) {
      console.log('Database not available, setting ready to true');
      setReady(true);

      if (persistenceEnabled) {
        const error = new Error('Chat persistence is unavailable');
        logStore.logError('Chat persistence initialization failed', error);
        toast.error('Chat persistence is unavailable');
      }

      return;
    }

    if (mixedId) {
      console.log('Loading chat with mixedId:', mixedId);
      Promise.all([
        getMessages(db, mixedId),
        getSnapshot(db, mixedId), // Fetch snapshot from DB
      ])
        .then(async ([storedMessages, snapshot]) => {
          console.log('Chat loading result:', { 
            hasStoredMessages: !!storedMessages, 
            messagesCount: storedMessages?.messages?.length || 0,
            hasSnapshot: !!snapshot 
          });
          
          if (storedMessages && storedMessages.messages.length > 0) {
            const validSnapshot = snapshot || { chatIndex: '', files: {} };
            const summary = validSnapshot.summary;

            let filteredMessages = storedMessages.messages;

            if (validSnapshot.files && Object.keys(validSnapshot.files).length > 0) {
              const files = Object.entries(validSnapshot.files)
                .map(([path, file]) => {
                  if (file && typeof file === 'object' && 'content' in file) {
                    return { path, content: (file as any).content };
                  }
                  return null;
                })
                .filter((x): x is { content: string; path: string } => !!x);
              const projectCommands = await detectProjectCommands(files);
              const commandActionsString = createCommandActionsString(projectCommands);

              filteredMessages = [
                {
                  id: generateId(),
                  role: 'user',
                  content: `Restore project from snapshot`,
                  annotations: ['no-store', 'hidden'],
                },
                {
                  id: generateId(),
                  role: 'assistant',
                  content: commandActionsString,
                  annotations: ['no-store', 'hidden'],
                },
                ...filteredMessages,
              ];
              restoreSnapshot(mixedId);
            }

            setInitialMessages(filteredMessages);
            setArchivedMessages(filteredMessages); // Set archived messages

            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);
            
            console.log('Chat loaded successfully:', { 
              urlId: storedMessages.urlId, 
              description: storedMessages.description,
              chatId: storedMessages.id,
              messagesCount: filteredMessages.length
            });
          } else {
            console.log('Chat not found or empty, but not redirecting');
            setInitialMessages([]);
            setArchivedMessages([]);
          }

          setReady(true);
        })
        .catch((error) => {
          console.error('Error loading chat:', error);
          logStore.logError('Failed to load chat messages or snapshot', error);
          toast.error('Failed to load chat: ' + error.message);
          setReady(true);
        });
    } else {
      console.log('No mixedId provided, setting ready to true');
      setReady(true);
    }
  }, [mixedId, db, searchParams]);

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = chatId.get();

      if (!id || !db) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      // localStorage.setItem(`snapshot:${id}`, JSON.stringify(snapshot)); // Remove localStorage usage
      try {
        await setSnapshot(db, id, snapshot);
      } catch (error) {
        console.error('Failed to save snapshot:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [db],
  );

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    // const snapshotStr = localStorage.getItem(`snapshot:${id}`); // Remove localStorage usage
    const container = await webcontainer;

    const validSnapshot = snapshot || { chatIndex: '', files: {} };

    if (!validSnapshot?.files) {
      return;
    }

    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      } else {
      }
    });

    // workbenchStore.files.setKey(snapshot?.files)
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!db || !id) {
        return;
      }

      try {
        await setMessages(db, id, initialMessages, urlId, description.get(), undefined, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      console.log('storeMessageHistory called with:', { 
        messagesCount: messages.length, 
        dbAvailable: !!db,
        chatId: chatId.get(),
        urlId 
      });
      
      if (!db || messages.length === 0) {
        console.log('Cannot save messages:', { db: !!db, messagesLength: messages.length });
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !m.annotations?.includes('no-store'));

      let _urlId = urlId;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(db, firstArtifact.id);
        _urlId = urlId;
        setUrlId(urlId);
      }

      let chatSummary: string | undefined = undefined;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary);

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      // Ensure chatId.get() is used here as well
      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);
        console.log('Generated new chat ID:', nextId);
        chatId.set(nextId);
      }

      // Ensure chatId.get() is used for the final setMessages call
      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');
        return;
      }

      try {
        console.log('Saving messages to database:', {
          chatId: finalChatId,
          urlId: _urlId,
          description: description.get(),
          messagesCount: messages.length
        });

      await setMessages(
        db,
          finalChatId,
          messages, // Use messages directly instead of [...archivedMessages, ...messages]
          _urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );
        
        console.log('Chat history saved successfully to IndexedDB');
        
        // Also save to localStorage as additional backup
        try {
          const chatData = {
            id: finalChatId,
            messages: messages,
            urlId: _urlId,
            description: description.get(),
            timestamp: new Date().toISOString(),
            metadata: chatMetadata.get(),
          };
          
          const localStorageKey = `chat_history_${finalChatId}`;
          localStorage.setItem(localStorageKey, JSON.stringify(chatData));
          console.log('Chat history also saved to localStorage as backup');
        } catch (localStorageError) {
          console.warn('Failed to save chat history to localStorage backup:', localStorageError);
        }
        
      } catch (error) {
        console.error('Failed to save chat history:', error);
        toast.error('Failed to save chat history: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!db || (!mixedId && !listItemId)) {
        console.log('Cannot duplicate chat:', { db: !!db, mixedId, listItemId });
        return;
      }

      try {
        console.log('Duplicating chat:', mixedId || listItemId);
        const newId = await duplicateChat(db, mixedId || listItemId);
        console.log('Chat duplicated, navigating to:', `/chat/${newId}`);
        navigate(`/chat/${newId}`);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        console.error('Failed to duplicate chat:', error);
        toast.error('Failed to duplicate chat');
      }
    },
    importChat: async (description: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!db) {
        return;
      }

      try {
        const newId = await createChatFromMessages(db, description, messages, metadata);
        console.log('Importing chat, navigating to:', `/chat/${newId}`);
        navigate(`/chat/${newId}`);
        toast.success('Chat imported successfully');
      } catch (error) {
        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    exportChat: async (id = urlId) => {
      if (!db || !id) {
        return;
      }

      const chat = await getMessages(db, id);
      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

function navigateChat(nextId: string) {
  console.log('navigateChat called with nextId:', nextId);
  
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  
  // Only navigate if we're not already on the correct URL
  const currentPath = window.location.pathname;
  const targetPath = `/chat/${nextId}`;
  
  if (currentPath !== targetPath) {
    console.log('Navigating from', currentPath, 'to', targetPath);
  const url = new URL(window.location.href);
    url.pathname = targetPath;
  window.history.replaceState({}, '', url);
  } else {
    console.log('Already on correct path, not navigating');
  }
}
