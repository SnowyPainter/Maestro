import React from "react";
import { useChatMessagesContext } from "@/entities/messages/context/ChatMessagesContext";
import { InputBox } from "@/components/Chat/InputBox";

// --- Main Component ---
export function ChatInput({ onSendMessage, onClearChat, placeholder = "Enter a message..." }: {
  onSendMessage: (content: string) => Promise<void>;
  onClearChat: () => void;
  placeholder?: string;
}) {
  const { appendMessage } = useChatMessagesContext();

  return (
    <InputBox
      onSendMessage={onSendMessage}
      onClearChat={onClearChat}
      placeholder={placeholder}
    />
  );
}