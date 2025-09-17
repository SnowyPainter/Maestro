import { Button } from "@/components/ui/button";
import { Paperclip, Send } from "lucide-react";

interface ChatInputProps {
    onSendMessage: (content: string) => Promise<void>;
    placeholder?: string;
}

export function ChatInput({ onSendMessage, placeholder = "Enter a message..." }: ChatInputProps) {
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const value = (e.target as HTMLTextAreaElement).value;
            if (value.trim()) {
                try {
                    await onSendMessage(value);
                    (e.target as HTMLTextAreaElement).value = "";
                } catch (error) {
                    console.error('Failed to send message:', error);
                }
            }
        }
    };

    return (
        <div className="relative w-full max-w-3xl">
            <textarea
                className="border rounded-xl p-3 w-full pr-24 resize-none bg-input"
                placeholder={placeholder}
                onKeyDown={handleKeyDown}
                rows={1}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button size="icon" className="rounded-full h-8 w-8">
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
