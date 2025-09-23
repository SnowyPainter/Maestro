import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useListSlotHintsApiOrchestratorHelpersSlotHintsGet, SlotHintItem } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { useChatMessagesContext } from "@/entities/messages/context/ChatMessagesContext";
import { parseClauses } from "@/lib/chat/parse";
import { useContextRegistryStore, ContextValueItem } from "@/store/chat-context-registry";
import { ChatOverlay } from "@/components/Chat/Overlay";

interface ChatInputProps {
    onSendMessage: (content: string) => Promise<void>;
    onClearChat: () => void;
    placeholder?: string;
}


type SuggestionMode = 'key' | 'value';

export function ChatInput({ onSendMessage, onClearChat, placeholder = "Enter a message..." }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [inputValue, setInputValue] = useState("");
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionMode, setMentionMode] = useState<SuggestionMode>('key');
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<(SlotHintItem | ContextValueItem)[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const suggestionRefs = useRef<(HTMLLIElement | null)[]>([]);

    const { appendMessage } = useChatMessagesContext();

    const clauses = parseClauses(inputValue);

    const hintMap = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({
        query: undefined,
        limit: 100,
    }).data?.reduce((acc, hint) => {
        acc[hint.name] = hint;
        return acc;
    }, {} as Record<string, SlotHintItem>) || {};

    const handleChipClick = useCallback((position: number) => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(position, position);
            setSelection({ start: position, end: position });
        }
    }, []);


    const closeMention = useCallback(() => {
        setMentionOpen(false);
        setMentionMode('key');
        setMentionQuery("");
        setMentionStart(null);
        setSelectedSlot(null);
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

            const colonIndex = body.lastIndexOf(":");
            if (colonIndex !== -1) {
                const slotPart = body.slice(0, colonIndex);
                const valuePart = body.slice(colonIndex + 1);

                if (!slotPart || slotPart.includes(" ") || slotPart.includes("\n") || slotPart.includes("\r") || slotPart.includes("\t")) {
                    closeMention();
                    return;
                }

                if (valuePart.includes(" ")) {
                    closeMention();
                    return;
                }

                if (valuePart.includes("\n") || valuePart.includes("\r") || valuePart.includes("\t")) {
                    closeMention();
                    return;
                }

                setMentionOpen(true);
                setMentionMode('value');
                setMentionStart(atIndex);
                setSelectedSlot(slotPart);
                setMentionQuery(valuePart);
                return;
            }

            if (body.includes("\n") || body.includes("\r") || body.includes("\t") || body.includes(" ")) {
                closeMention();
                return;
            }
            if (body.includes(":") || body.includes("=")) {
                closeMention();
                return;
            }
            setMentionOpen(true);
            setMentionMode('key');
            setMentionStart(atIndex);
            setSelectedSlot(null);
            setMentionQuery(body);
        },
        [closeMention],
    );

    const { data: slotHints } = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({
        query: mentionMode === 'key' ? (mentionQuery.trim() || undefined) : undefined,
        limit: 8,
    }, {
        query: {
            enabled: mentionOpen && mentionMode === 'key',
        },
    });

    useEffect(() => {
        if (mentionMode === 'key') {
            if (slotHints) {
                setSuggestions(slotHints);
                setHighlightIndex(0);
                suggestionRefs.current = new Array(slotHints.length).fill(null);
            } else {
                setSuggestions([]);
                suggestionRefs.current = [];
            }
        } else if (mentionMode === 'value' && selectedSlot) {
            const registryValues = useContextRegistryStore.getState().getValues(selectedSlot);
            const filteredValues = mentionQuery
                ? registryValues.filter(item =>
                    item.label.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                    item.value.toLowerCase().includes(mentionQuery.toLowerCase())
                )
                : registryValues;
            setSuggestions(filteredValues.slice(0, 8));
            setHighlightIndex(0);
            suggestionRefs.current = new Array(filteredValues.length).fill(null);
        }
    }, [slotHints, mentionMode, selectedSlot, mentionQuery]);

    useEffect(() => {
        if (!mentionOpen) {
            setSuggestions([]);
        }
    }, [mentionOpen]);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = event.target.value;
            setInputValue(newValue);
            const caret = event.target.selectionStart ?? newValue.length;
            setSelection({ start: caret, end: event.target.selectionEnd ?? newValue.length });
            updateMentionState(newValue, caret);
        },
        [updateMentionState],
    );

    const handleSelectionChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }
        const { value, selectionStart, selectionEnd } = textarea;
        setSelection({ start: selectionStart, end: selectionEnd });
        updateMentionState(value, selectionStart);
    }, [updateMentionState]);

    const applySuggestion = useCallback(
        (suggestion: SlotHintItem | ContextValueItem) => {
            const textarea = textareaRef.current;
            if (!textarea || mentionStart === null) {
                return;
            }
            const caret = selection.start;
            const before = inputValue.slice(0, mentionStart);
            const after = inputValue.slice(caret);

            let insertion: string;
            if (mentionMode === 'key' && 'name' in suggestion) {
                insertion = `@${suggestion.name}:`;
            } else if (mentionMode === 'value' && selectedSlot && 'value' in suggestion) {
                insertion = `@${selectedSlot}:${suggestion.value} `;
            } else {
                return;
            }

            const nextValue = `${before}${insertion}${after}`;
            const newCaret = before.length + insertion.length;

            setInputValue(nextValue);
            setSelection({ start: newCaret, end: newCaret });
            closeMention();

            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(newCaret, newCaret);
            });
        },
        [closeMention, inputValue, mentionStart, mentionMode, selectedSlot, selection],
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
            useContextRegistryStore.setState({ byKey: {} }); // Clear the registry
            setInputValue("");
            setSelection({ start: 0, end: 0 });
            closeMention();
            requestAnimationFrame(() => textareaRef.current?.focus());
            return;
        }
        if (trimmed.toLowerCase().startsWith("/memo")) {
            const memoBody = trimmed.slice(5).trim();
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

            appendMessage({
                id: Date.now(),
                type: 'bot',
                content: feedbackMessage,
            });

            setInputValue("");
            setSelection({ start: 0, end: 0 });
            closeMention();
            requestAnimationFrame(() => textareaRef.current?.focus());
            return;
        }
        try {
            await onSendMessage(trimmed);
            setInputValue("");
            setSelection({ start: 0, end: 0 });
            closeMention();
        } catch (error) {
            console.error("Failed to send message:", error);
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
    }, [inputValue, onClearChat, onSendMessage, appendMessage]);

    const handleKeyDown = useCallback(
        async (event: KeyboardEvent<HTMLTextAreaElement>) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const { start: caret, end: selectionEnd } = selection;
            const isCollapsed = caret === selectionEnd;

            if (event.key === "Backspace" && isCollapsed) {
                const clauses = parseClauses(inputValue);
                const chipAtCursor = clauses.find(c => c.span[1] === caret);
                if (chipAtCursor) {
                    event.preventDefault();
                    closeMention();
                    const [start, end] = chipAtCursor.span;
                    const newValue = inputValue.slice(0, start) + inputValue.slice(end);
                    setInputValue(newValue);
                    setSelection({ start: start, end: start });
                    requestAnimationFrame(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start, start);
                    });
                    return;
                }
            }

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
        [applySuggestion, closeMention, highlightIndex, mentionOpen, sendCurrentMessage, suggestions, inputValue, selection],
    );

    const handleBlur = useCallback(() => {
        // Don't close mention on blur to allow clicking on suggestions
    }, []);

    const handleSendClick = useCallback(async () => {
        await sendCurrentMessage();
    }, [sendCurrentMessage]);

    const showSuggestions = mentionOpen && (suggestions.length > 0 || mentionQuery.length >= 0);

    return (
        <div className="relative w-full max-w-3xl" onBlur={handleBlur}>
            {clauses.length > 0 && (
                <ChatOverlay
                    value={inputValue}
                    clauses={clauses}
                    hintMap={hintMap}
                    onChipClick={handleChipClick}
                    caretIndex={selection.start}
                />
            )}

            {showSuggestions && (
                <div className="absolute bottom-full left-0 mb-2 w-96 rounded-xl border bg-background shadow-lg z-10 overflow-hidden">
                    {suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            {mentionMode === 'key' ? 'No slots found' : 'No values found'}
                        </div>
                    ) : (
                        <ul className="max-h-64 overflow-y-auto">
                            {suggestions.map((suggestion, index) => {
                                const active = index === highlightIndex;
                                const isSlotHint = 'name' in suggestion;
                                const isContextValue = 'value' in suggestion;

                                return (
                                    <li
                                        key={isSlotHint ? suggestion.name : isContextValue ? suggestion.value : index}
                                        ref={(el) => {
                                            suggestionRefs.current[index] = el;
                                        }}
                                        className={`cursor-pointer px-3 py-2 text-sm ${active ? "bg-muted" : "bg-background"}`}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            applySuggestion(suggestion);
                                        }}
                                    >
                                        {isSlotHint ? (
                                            <>
                                                <div className="font-medium">{suggestion.label}</div>
                                                {suggestion.description && (
                                                    <div className="text-xs text-muted-foreground line-clamp-2">{suggestion.description}</div>
                                                )}
                                                <div className="text-xs text-muted-foreground mt-1">@{suggestion.name}</div>
                                            </>
                                        ) : isContextValue ? (
                                            <>
                                                <div className="font-medium">{suggestion.label}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{suggestion.value}</div>
                                            </>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            <textarea
                ref={textareaRef}
                className={`border rounded-xl p-3 w-full pr-24 resize-none ${ 
                    clauses.length > 0 ? 'bg-transparent text-transparent caret-transparent' : 'bg-input'
                }`}
                placeholder={placeholder}
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleSelectionChange}
                onClick={handleSelectionChange}
                onSelect={handleSelectionChange}
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