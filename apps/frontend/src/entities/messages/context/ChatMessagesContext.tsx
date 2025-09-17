import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type MessageType = "user" | "bot" | "card";

export type Message = {
  id: number;
  type: MessageType;
  content: string | React.ReactNode;
};

interface ChatMessagesContextValue {
  messages: Message[];
  appendMessage: (message: Message) => void;
  updateMessages: (updater: (prev: Message[]) => Message[]) => void;
  removeMessage: (messageId: number) => void;
  clearMessages: () => void;
}

const ChatMessagesContext = createContext<ChatMessagesContextValue | undefined>(undefined);

export function ChatMessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const appendMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => updater(prev));
  }, []);

  const removeMessage = useCallback((messageId: number) => {
    setMessages(prev => prev.filter(message => message.id !== messageId));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value = useMemo<ChatMessagesContextValue>(() => ({
    messages,
    appendMessage,
    updateMessages,
    removeMessage,
    clearMessages,
  }), [messages, appendMessage, updateMessages, removeMessage, clearMessages]);

  return (
    <ChatMessagesContext.Provider value={value}>
      {children}
    </ChatMessagesContext.Provider>
  );
}

export function useChatMessagesContext() {
  const context = useContext(ChatMessagesContext);
  if (!context) {
    throw new Error("useChatMessagesContext must be used within a ChatMessagesProvider");
  }
  return context;
}

export function useChatMessages() {
  return useChatMessagesContext().messages;
}
