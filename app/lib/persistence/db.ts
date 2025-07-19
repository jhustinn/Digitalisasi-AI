import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types'; // Import Snapshot type

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  console.log('Opening database...');
  
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      console.log('Database upgrade needed, version:', event.newVersion);
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        console.log('Creating chats store...');
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }

      if (oldVersion < 2) {
        console.log('Creating snapshots store...');
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('Database opened successfully:', db.name, 'version:', db.version);
      
      // Add error handling for database operations
      db.onerror = (event) => {
        console.error('Database error:', event);
      };
      
      resolve(db);
    };

    request.onerror = (event: Event) => {
      console.error('Database open error:', (event.target as IDBOpenDBRequest).error);
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  console.log('getAll called, fetching all chats...');
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => {
      const result = request.result as ChatHistoryItem[];
      console.log('getAll result:', result);
      resolve(result);
    };
    request.onerror = () => {
      console.error('getAll error:', request.error);
      reject(request.error);
    };
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  console.log('setMessages called with:', { id, urlId, description, messagesCount: messages.length });
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const chatData = {
      id,
      messages,
      urlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    };

    console.log('Saving chat data:', chatData);

    const request = store.put(chatData);

    request.onsuccess = () => {
      console.log('Chat saved successfully');
      
      // Also save to localStorage as backup
      try {
        const localStorageKey = `chat_backup_${id}`;
        localStorage.setItem(localStorageKey, JSON.stringify(chatData));
        console.log('Chat also saved to localStorage as backup');
      } catch (error) {
        console.warn('Failed to save chat to localStorage backup:', error);
      }
      
      resolve();
    };
    request.onerror = () => {
      console.error('Error saving chat:', request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => {
      console.log('Transaction completed successfully');
    };
    
    transaction.onerror = () => {
      console.error('Transaction error:', transaction.error);
      reject(transaction.error);
    };
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  try {
    // First try to get from IndexedDB
    const result = await getMessagesById(db, id) || await getMessagesByUrlId(db, id);
    if (result) {
      console.log('Chat found in IndexedDB');
      return result;
    }
  } catch (error) {
    console.warn('Failed to get chat from IndexedDB:', error);
  }
  
  // If not found in IndexedDB, try localStorage backup
  try {
    const localStorageKey = `chat_backup_${id}`;
    const backupData = localStorage.getItem(localStorageKey);
    if (backupData) {
      const chatData = JSON.parse(backupData);
      console.log('Chat found in localStorage backup');
      
      // Restore to IndexedDB if possible
      try {
        await setMessages(db, chatData.id, chatData.messages, chatData.urlId, chatData.description, chatData.timestamp, chatData.metadata);
        console.log('Chat restored from localStorage to IndexedDB');
      } catch (restoreError) {
        console.warn('Failed to restore chat to IndexedDB:', restoreError);
      }
      
      return chatData;
    }
  } catch (error) {
    console.warn('Failed to get chat from localStorage backup:', error);
  }
  
  throw new Error(`Chat not found: ${id}`);
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots'], 'readwrite'); // Add snapshots store to transaction
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');

    const deleteChatRequest = chatStore.delete(id);
    const deleteSnapshotRequest = snapshotStore.delete(id); // Also delete snapshot

    let chatDeleted = false;
    let snapshotDeleted = false;

    const checkCompletion = () => {
      if (chatDeleted && snapshotDeleted) {
        resolve(undefined);
      }
    };

    deleteChatRequest.onsuccess = () => {
      chatDeleted = true;
      checkCompletion();
    };
    deleteChatRequest.onerror = () => reject(deleteChatRequest.error);

    deleteSnapshotRequest.onsuccess = () => {
      snapshotDeleted = true;
      checkCompletion();
    };

    deleteSnapshotRequest.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        snapshotDeleted = true;
        checkCompletion();
      } else {
        reject(deleteSnapshotRequest.error);
      }
    };

    transaction.oncomplete = () => {
      // This might resolve before checkCompletion if one operation finishes much faster
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  console.log('getNextId called...');
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const keys = request.result as string[];
      console.log('Existing keys:', keys);
      
      if (keys.length === 0) {
        console.log('No existing keys, starting with 1');
        resolve('1');
        return;
      }
      
      const highestId = keys.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      const nextId = String(+highestId + 1);
      console.log('Next ID calculated:', nextId);
      resolve(nextId);
    };

    request.onerror = () => {
      console.error('getNextId error:', request.error);
      reject(request.error);
    };
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  console.log('getUrlId called with id:', id);
  
  const idList = await getUrlIds(db);
  console.log('Existing URL IDs:', idList);

  if (!idList.includes(id)) {
    console.log('ID not in list, using as-is:', id);
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    const finalUrlId = `${id}-${i}`;
    console.log('ID exists, using modified URL ID:', finalUrlId);
    return finalUrlId;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  console.log('getUrlIds called...');
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        const urlId = cursor.value.urlId;
        console.log('Found URL ID:', urlId);
        idList.push(urlId);
        cursor.continue();
      } else {
        console.log('Finished collecting URL IDs:', idList);
        resolve(idList);
      }
    };

    request.onerror = () => {
      console.error('getUrlIds error:', request.error);
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  console.log('createChatFromMessages called with:', { description, messagesCount: messages.length, metadata });
  
  const newId = await getNextId(db);
  console.log('Generated new ID:', newId);
  
  const newUrlId = await getUrlId(db, newId);
  console.log('Generated new URL ID:', newUrlId);

  await setMessages(
    db,
    newId,
    messages,
    newUrlId, // Use the new urlId
    description,
    undefined, // Use the current timestamp
    metadata,
  );

  console.log('Chat saved successfully, returning URL ID:', newUrlId);
  return newUrlId; // Return the urlId instead of id for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}