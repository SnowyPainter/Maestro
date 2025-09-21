import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useListSlotHintsApiOrchestratorHelpersSlotHintsGet, SlotHintItem } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { useChatMessagesContext } from "@/entities/messages/context/ChatMessagesContext";

interface ChatInputProps {
    onSendMessage: (content: string) => Promise<void>;
    onClearChat: () => void;
    placeholder?: string;
}


export function ChatInput({ onSendMessage, onClearChat, placeholder = "Enter a message..." }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [inputValue, setInputValue] = useState("");
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<SlotHintItem[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const suggestionRefs = useRef<(HTMLLIElement | null)[]>([]);

    const { appendMessage } = useChatMessagesContext();


    const closeMention = useCallback(() => {
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSuggestions([]);
        setHighlightIndex(0);
    }, []);

    const updateMentionState = useCallback(
        (text: string, caret: number | null) => {
            if (caret === null || caret === undefined || caret < 0) {
                closeMention();
                return;
            }
            const uptoCaret = text.slice(0, caret);
            const atIndex = uptoCaret.lastIndexOf("@");
            if (atIndex === -1) {
                closeMention();
                return;
            }
            if (atIndex > 0) {
                const prevChar = uptoCaret[atIndex - 1];
                if (prevChar && !/\s/.test(prevChar)) {
                    closeMention();
                    return;
                }
            }
            const body = uptoCaret.slice(atIndex + 1);
            if (body.includes("\n") || body.includes("\r") || body.includes("\t")) {
                closeMention();
                return;
            }
            if (body.includes(" ") || body.includes(":") || body.includes("=")) {
                closeMention();
                return;
            }
            setMentionOpen(true);
            setMentionStart(atIndex);
            setMentionQuery(body);
        },
        [closeMention],
    );

    const { data: slotHints } = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({
        query: mentionQuery.trim() || undefined,
        limit: 8,
    }, {
        query: {
            enabled: mentionOpen,
        },
    });

    useEffect(() => {
        if (slotHints) {
            setSuggestions(slotHints);
            setHighlightIndex(0);
            suggestionRefs.current = new Array(slotHints.length).fill(null);
        } else {
            setSuggestions([]);
            suggestionRefs.current = [];
        }
    }, [slotHints]);

    useEffect(() => {
        if (!mentionOpen) {
            setSuggestions([]);
        }
    }, [mentionOpen]);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = event.target.value;
            setInputValue(newValue);
            updateMentionState(newValue, event.target.selectionStart ?? newValue.length);
        },
        [updateMentionState],
    );

    const handleSelectionChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }
        updateMentionState(textarea.value, textarea.selectionStart ?? textarea.value.length);
    }, [updateMentionState]);

    const applySuggestion = useCallback(
        (hint: SlotHintItem) => {
            const textarea = textareaRef.current;
            if (!textarea || mentionStart === null) {
                return;
            }
            const caret = textarea.selectionStart ?? inputValue.length;
            const before = inputValue.slice(0, mentionStart);
            const after = inputValue.slice(caret);
            const insertion = `@${hint.name}:`;
            const nextValue = `${before}${insertion}${after}`;
            setInputValue(nextValue);
            closeMention();
            requestAnimationFrame(() => {
                textarea.focus();
                const newCaret = before.length + insertion.length;
                textarea.setSelectionRange(newCaret, newCaret);
            });
        },
        [closeMention, inputValue, mentionStart],
    );

    useEffect(() => {
        if (!mentionOpen || suggestions.length === 0) {
            return;
        }
        setHighlightIndex((prev) => {
            if (prev < suggestions.length) {
                return prev;
            }
            return 0;
        });
    }, [mentionOpen, suggestions]);

    // Scroll to highlighted item
    useEffect(() => {
        if (suggestionRefs.current[highlightIndex]) {
            suggestionRefs.current[highlightIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [highlightIndex]);

    const sendCurrentMessage = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed) {
            return;
        }
        if (trimmed === "/clear") {
            onClearChat();
            setInputValue("");
            closeMention();
            requestAnimationFrame(() => textareaRef.current?.focus());
            return;
        }
        if (trimmed.toLowerCase().startsWith("/memo")) {
            const memoBody = trimmed.slice(5).trim();
            // Get actions directly from store to avoid hook dependency issues
            const actions = usePersonaContextStore.getState();

            let feedbackMessage = "";
            if (!memoBody) {
                actions.clearUserMemo();
                feedbackMessage = "📝 Memo cleared";
            } else if (["off", "disable", "disabled"].includes(memoBody.toLowerCase())) {
                actions.setUserMemoEnabled(false);
                feedbackMessage = "📝 Memo disabled";
            } else if (["on", "enable", "enabled"].includes(memoBody.toLowerCase())) {
                actions.setUserMemoEnabled(true);
                feedbackMessage = "📝 Memo enabled";
            } else if (memoBody.toLowerCase() === "clear") {
                actions.clearUserMemo();
                feedbackMessage = "📝 Memo cleared";
            } else {
                actions.setUserMemo(memoBody);
                actions.setUserMemoEnabled(true);
                feedbackMessage = `📝 Memo set: "${memoBody.length > 50 ? memoBody.slice(0, 47) + '...' : memoBody}"`;
            }

            // Add system feedback message to chat
            appendMessage({
                id: Date.now(),
                type: 'bot',
                content: feedbackMessage,
            });

            setInputValue("");
            closeMention();
            requestAnimationFrame(() => textareaRef.current?.focus());
            return;
        }
        try {
            await onSendMessage(trimmed);
            setInputValue("");
            closeMention();
        } catch (error) {
            console.error("Failed to send message:", error);
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
    }, [inputValue, onClearChat, onSendMessage]);

    const handleKeyDown = useCallback(
        async (event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (mentionOpen && suggestions.length > 0) {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightIndex((prev) => (prev + 1) % suggestions.length);
                    return;
                }
                if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                    return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    applySuggestion(suggestions[highlightIndex]);
                    return;
                }
                if (event.key === "Tab") {
                    event.preventDefault();
                    applySuggestion(suggestions[highlightIndex]);
                    return;
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeMention();
                    return;
                }
            }

            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                await sendCurrentMessage();
            }
        },
        [applySuggestion, closeMention, highlightIndex, mentionOpen, sendCurrentMessage, suggestions],
    );

    const handleBlur = useCallback(() => {
        closeMention();
    }, [closeMention]);

    const handleSendClick = useCallback(async () => {
        await sendCurrentMessage();
    }, [sendCurrentMessage]);

    const showSuggestions = mentionOpen && (suggestions.length > 0 || mentionQuery.length >= 0);

    return (
        <div className="relative w-full max-w-3xl">
            {showSuggestions && (
                <div className="absolute bottom-full left-0 mb-2 w-96 rounded-xl border bg-background shadow-lg z-10 overflow-hidden">
                    {suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No slots found</div>
                    ) : (
                        <ul className="max-h-64 overflow-y-auto">
                            {suggestions.map((hint, index) => {
                                const active = index === highlightIndex;
                                return (
                                    <li
                                        key={hint.name}
                                        ref={(el) => {
                                            suggestionRefs.current[index] = el;
                                        }}
                                        className={`cursor-pointer px-3 py-2 text-sm ${active ? "bg-muted" : "bg-background"}`}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            applySuggestion(hint);
                                        }}
                                    >
                                        <div className="font-medium">{hint.label}</div>
                                        {hint.description && (
                                            <div className="text-xs text-muted-foreground line-clamp-2">{hint.description}</div>
                                        )}
                                        <div className="text-xs text-muted-foreground mt-1">@{hint.name}</div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            <textarea
                ref={textareaRef}
                className="border rounded-xl p-3 w-full pr-24 resize-none bg-input"
                placeholder={placeholder}
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleSelectionChange}
                onClick={handleSelectionChange}
                onSelect={handleSelectionChange}
                onBlur={handleBlur}
                rows={1}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button size="icon" className="rounded-full h-8 w-8" onClick={handleSendClick}>
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
