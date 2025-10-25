import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useListSlotHintsApiOrchestratorHelpersSlotHintsGet, SlotHintItem } from "@/lib/api/generated";
import { useContextRegistryStore, ContextValueItem } from "@/store/chat-context-registry";
import { Suggest } from "@/components/Chat/Suggest";
import { Chip, ChipComponent, getChipDisplayText } from "@/components/Chat/Chip";

// --- Types ---
type SuggestionMode = 'key' | 'value';

interface ComposerState {
  mode: SuggestionMode;
  query: string;
  slot?: string;
}

interface TextPart {
  type: 'text';
  id: string;
  text: string;
}

interface ChipPart {
  type: 'chip';
  id: string;
  chip: Chip;
}

interface ComposerPart {
  type: 'composer';
  id: string;
  state: ComposerState;
}

type ContentPart = TextPart | ChipPart | ComposerPart;

interface InputBoxProps {
  onSendMessage: (content: string) => Promise<void>;
  onClearChat: () => void;
  placeholder?: string;
}

// Returns the text for sending to the backend (raw value)
const getPartValueText = (part: ContentPart): string => {
    if (part.type === 'text') return part.text;
    if (part.type === 'chip') return `@${part.chip.slot}:${part.chip.value}`;
    if (part.type === 'composer') return `@${part.state.slot || ''}${part.state.mode === 'value' ? ':' : ''}${part.state.query}`;
    return '';
}

const mergeTextParts = (parts: ContentPart[]): ContentPart[] => {
  if (parts.length === 0) return [];
  const merged: ContentPart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last?.type === 'text' && part.type === 'text') {
      last.text += part.text;
    } else {
      merged.push(part);
    }
  }
  return merged;
};

// --- Main Component ---
export function InputBox({ onSendMessage, onClearChat, placeholder = "Enter a message..." }: InputBoxProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const [parts, setParts] = useState<ContentPart[]>([{ type: 'text', id: `text_${Date.now()}`, text: '' }]);
  const [cursorPos, setCursorPos] = useState<number | null>(null);

  const [suggestions, setSuggestions] = useState<(SlotHintItem | ContextValueItem)[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const suggestionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [suggestionStyle, setSuggestionStyle] = useState<React.CSSProperties>({ display: 'none' });

  const { data: hintMapData } = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({ query: undefined, limit: 100 });
  const hintMap = useMemo(() => hintMapData?.reduce((acc, hint) => {
    acc[hint.name] = hint;
    return acc;
  }, {} as Record<string, SlotHintItem>) || {}, [hintMapData]);

  const activeComposerPart = useMemo(() => parts.find((p): p is ComposerPart => p.type === 'composer'), [parts]);
  const activeComposer = activeComposerPart?.state;

  const { data: slotHints } = useListSlotHintsApiOrchestratorHelpersSlotHintsGet({
    query: activeComposer?.mode === 'key' ? activeComposer.query : undefined,
    limit: 8,
  }, { query: { enabled: !!activeComposer && activeComposer.mode === 'key' } });

  // Returns the text for display in the editor (label)
  const getPartDisplayText = useCallback((part: ContentPart): string => {
      if (part.type === 'chip') {
          return getChipDisplayText(part.chip, hintMap);
      }
      if (part.type === 'composer') {
        return `@${part.state.slot || ''}${part.state.mode === 'value' ? ':' : ''}${part.state.query}`;
      }
      return part.text;
  }, [hintMap]);

  const getCursorPosInEditor = (): { start: number, end: number } => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return { start: 0, end: 0 };
    
    const range = selection.getRangeAt(0);
    const editor = editorRef.current;

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editor);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;

    preSelectionRange.setEnd(range.endContainer, range.endOffset);
    const end = preSelectionRange.toString().length;

    return { start, end };
  };

  useEffect(() => {
    if (!activeComposer) {
      setSuggestions([]);
      setSuggestionStyle({ display: 'none' });
      return;
    }
    if (activeComposer.mode === 'key') {
      setSuggestions(slotHints ?? []);
    } else if (activeComposer.mode === 'value' && activeComposer.slot) {
      const registryValues = useContextRegistryStore.getState().getValues(activeComposer.slot);
      const filtered = activeComposer.query
        ? registryValues.filter(item =>
          item.label.toLowerCase().includes(activeComposer.query.toLowerCase()) ||
          item.value.toLowerCase().includes(activeComposer.query.toLowerCase())
        ) : registryValues;
      setSuggestions(filtered);
    }
    setHighlightIndex(0);
    updateSuggestionPosition();
  }, [slotHints, activeComposer]);

  const updateSuggestionPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !editorRef.current) return;
    const composerNode = editorRef.current.querySelector('[data-part-type="composer"]');
    if (!composerNode) return;
    const range = document.createRange();
    range.selectNodeContents(composerNode);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    setSuggestionStyle({
      display: 'block',
      left: `${rect.left - editorRect.left}px`,
      bottom: `${editorRect.height}px`,
    });
  }, []);

  const commitChip = useCallback((composerPart: ComposerPart, slot: string, value: string) => {
    const newChip: Chip = { id: `chip_${Date.now()}`, slot, value };
    const newChipPart: ChipPart = { type: 'chip', id: newChip.id, chip: newChip };

    setParts(prevParts => {
        const composerIndex = prevParts.findIndex(p => p.id === composerPart.id);
        if (composerIndex === -1) return prevParts;

        const newParts = [...prevParts];
        newParts.splice(composerIndex, 1, newChipPart, { type: 'text', id: `text_${Date.now()}`, text: ' ' });
        
        const merged = mergeTextParts(newParts);

        const chipIndexInMerged = merged.findIndex(p => p.id === newChipPart.id);
        let pos = 0;
        for (let i = 0; i <= chipIndexInMerged; i++) {
            pos += getPartDisplayText(merged[i]).length;
        }
        const nextPart = merged[chipIndexInMerged + 1];
        if (nextPart?.type === 'text' && nextPart.text.startsWith(' ')) {
            pos += 1;
        }
        setCursorPos(pos);

        return merged.length > 0 ? merged : [{ type: 'text', id: `text_${Date.now()}`, text: '' }];
    });
  }, [getPartDisplayText]);

  const handleSelectSuggestion = useCallback((suggestion: SlotHintItem | ContextValueItem) => {
    if (!activeComposerPart) return;
    const { state: composer, id } = activeComposerPart;

    if (composer.mode === 'key' && 'name' in suggestion) {
      const newComposerState = { ...composer, mode: 'value' as SuggestionMode, slot: suggestion.name, query: '' };
      
      const composerIndex = parts.findIndex(p => p.id === id);
      if (composerIndex === -1) return;

      let precedingLength = 0;
      for (let i = 0; i < composerIndex; i++) {
          precedingLength += getPartDisplayText(parts[i]).length;
      }

      const newComposerPartText = getPartDisplayText({ type: 'composer', id, state: newComposerState });
      const newCursorPos = precedingLength + newComposerPartText.length;

      setCursorPos(newCursorPos);
      setParts(parts => parts.map(p => p.id === id ? { ...p, state: newComposerState } : p));
    } else if (composer.mode === 'value' && composer.slot && 'value' in suggestion) {
      commitChip(activeComposerPart, composer.slot, suggestion.value);
    }
  }, [activeComposerPart, parts, getPartDisplayText, commitChip]);

  const sendCurrentMessage = useCallback(async () => {
    const fullText = parts.map(getPartValueText).join('');

    if (!fullText.trim()) return;
    if (fullText.trim() === "/clear") {
      onClearChat();
      useContextRegistryStore.setState({ byKey: {} });
      setParts([{ type: 'text', id: `text_${Date.now()}`, text: '' }]);
      return;
    }
    try {
      await onSendMessage(fullText);
      setParts([{ type: 'text', id: `text_${Date.now()}`, text: '' }]);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [parts, onClearChat, onSendMessage]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing) return;

    if (activeComposerPart) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowDown') setHighlightIndex(p => (p + 1) % (suggestions.length || 1));
        if (e.key === 'ArrowUp') setHighlightIndex(p => (p - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
        if (e.key === 'Enter' || e.key === 'Tab') suggestions.length > 0 && handleSelectSuggestion(suggestions[highlightIndex]);
        if (e.key === 'Escape') {
            setParts(parts => mergeTextParts(parts.filter(p => p.type !== 'composer')));
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendCurrentMessage();
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const findPartAtCursor = (cursorPos: number): { part: ContentPart, index: number, offset: number } | null => {
        let accumulatedLength = 0;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partLength = getPartDisplayText(part).length;
            if (cursorPos <= accumulatedLength + partLength) {
                return { part, index: i, offset: cursorPos - accumulatedLength };
            }
            accumulatedLength += partLength;
        }
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
            const lastPartLength = getPartDisplayText(lastPart).length;
            return { part: lastPart, index: parts.length - 1, offset: lastPartLength };
        }
        return null;
    };

    const handleBeforeInput = (e: InputEvent) => {
      if (isComposing) return;
      e.preventDefault();
      
      const { data, inputType } = e;
      const { start: startPos, end: endPos } = getCursorPosInEditor();
      const isSelection = endPos - startPos > 0;

      let newParts = [...parts];

      // --- Selection-based Deletion ---
      if (isSelection && inputType.startsWith('delete')) {
        const startTarget = findPartAtCursor(startPos);
        const endTarget = findPartAtCursor(endPos);
        if (!startTarget || !endTarget) return;

        const { part: startPart, index: startIndex, offset: startOffsetInPart } = startTarget;
        const { part: endPart, index: endIndex, offset: endOffsetInPart } = endTarget;

        if (startPart.type === 'chip' || endPart.type === 'chip') {
            // Simplification: if selection touches a chip, just delete the whole chip(s).
            // A more refined implementation would check if the chip is fully selected.
            const firstChipIndex = parts.findIndex((p, i) => i >= startIndex && i <= endIndex && p.type === 'chip');
            let lastChipIndex = -1;
            for (let i = endIndex; i >= startIndex; i--) {
                if (parts[i].type === 'chip') {
                    lastChipIndex = i;
                    break;
                }
            }
            if (firstChipIndex > -1 && lastChipIndex > -1) {
                newParts.splice(firstChipIndex, lastChipIndex - firstChipIndex + 1);
            }
        } else {
            const firstPartContent = getPartDisplayText(startPart).slice(0, startOffsetInPart);
            const lastPartContent = getPartDisplayText(endPart).slice(endOffsetInPart);
            const combinedText = firstPartContent + lastPartContent;
            const newTextPart = { type: 'text' as const, id: `text_${Date.now()}`, text: combinedText };
            newParts.splice(startIndex, endIndex - startIndex + 1, newTextPart);
        }

        setCursorPos(startPos);
      } 
      // --- Single-character input and Paste ---
      else {
        const target = findPartAtCursor(startPos);
        if (!target) return;
        const { part, index, offset } = target;

        if (part.type === 'chip') {
            if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
                 newParts.splice(index, 1);
                 setCursorPos(startPos - (inputType === 'deleteContentBackward' ? 1 : 0));
            } // Other edits on chips are disallowed
        } else {
            switch (inputType) {
                case 'insertText':
                    if (data === '@' && !activeComposerPart) {
                        const newComposer: ComposerPart = { type: 'composer', id: `composer_${Date.now()}`, state: { mode: 'key', query: '' } };
                        if (part.type === 'text') {
                            const before = { ...part, text: part.text.slice(0, offset) };
                            const after = { ...part, id: `text_${Date.now()}`, text: part.text.slice(offset) };
                            newParts.splice(index, 1, before, newComposer, after);
                        }
                        setCursorPos(startPos + 1);
                    } else if (data === ' ' && activeComposerPart?.state.mode === 'value') {
                        commitChip(activeComposerPart, activeComposerPart.state.slot!, activeComposerPart.state.query);
                        return; // commitChip handles state update
                    } else if (part.type === 'composer') {
                        const composerText = getPartDisplayText(part);
                        const prefixLength = composerText.length - part.state.query.length;
                        const queryOffset = offset - prefixLength;
                        if (queryOffset >= 0) {
                            const newQuery = part.state.query.slice(0, queryOffset) + data + part.state.query.slice(queryOffset);
                            newParts[index] = { ...part, state: { ...part.state, query: newQuery } };
                            setCursorPos(startPos + (data?.length ?? 0));
                        }
                    } else if (part.type === 'text') {
                        const newText = part.text.slice(0, offset) + data + part.text.slice(offset);
                        newParts[index] = { ...part, text: newText };
                        setCursorPos(startPos + (data?.length ?? 0));
                    }
                    break;
                case 'insertFromPaste': {
                    const pastedText = (e as any).dataTransfer?.getData('text/plain') || '';
                    if (!pastedText || (part.type !== 'composer' && part.type !== 'text')) break;
                    if (part.type === 'text') {
                        const newText = part.text.slice(0, offset) + pastedText + part.text.slice(offset);
                        newParts[index] = { ...part, text: newText };
                        setCursorPos(startPos + pastedText.length);
                    } else if (part.type === 'composer') {
                        const composerText = getPartDisplayText(part);
                        const prefixLength = composerText.length - part.state.query.length;
                        const queryOffset = offset - prefixLength;
                        if (queryOffset >= 0) {
                            const newQuery = part.state.query.slice(0, queryOffset) + pastedText + part.state.query.slice(queryOffset);
                            newParts[index] = { ...part, state: { ...part.state, query: newQuery } };
                            setCursorPos(startPos + pastedText.length);
                        }
                    }
                    break;
                }
                case 'deleteContentBackward': {
                    if (startPos === 0) break;
                    const effectiveTarget = findPartAtCursor(startPos);
                    if (!effectiveTarget) break;
                    let { part, index, offset } = effectiveTarget;
                    if (offset === 0 && index > 0) {
                        part = newParts[index - 1];
                        index -= 1;
                        offset = getPartDisplayText(part).length;
                    }
                    if (part.type === 'text') {
                        const newText = part.text.slice(0, offset - 1) + part.text.slice(offset);
                        newParts[index] = { ...part, text: newText };
                    } else if (part.type === 'chip') {
                        newParts.splice(index, 1);
                    } else if (part.type === 'composer') {
                        const composerText = getPartDisplayText(part);
                        const prefixLength = composerText.length - part.state.query.length;
                        const queryOffset = offset - prefixLength;
                        if (queryOffset > 0) {
                            const newQuery = part.state.query.slice(0, queryOffset - 1) + part.state.query.slice(queryOffset);
                            newParts[index] = { ...part, state: { ...part.state, query: newQuery } };
                        } else if (part.state.mode === 'value') {
                            const newSlot = part.state.slot!;
                            newParts[index] = { ...part, state: { ...part.state, mode: 'key', query: newSlot, slot: undefined } };
                        } else {
                            newParts.splice(index, 1);
                        }
                    }
                    setCursorPos(startPos - 1);
                    break;
                }
                case 'deleteContentForward': {
                    const fullLength = parts.map(getPartDisplayText).join('').length;
                    if (startPos === fullLength) break;
                    const effectiveTarget = findPartAtCursor(startPos);
                    if (!effectiveTarget) break;
                    let { part, index, offset } = effectiveTarget;
                    const partLength = getPartDisplayText(part).length;
                    if (offset === partLength && index < parts.length - 1) {
                        index += 1;
                        part = newParts[index];
                        offset = 0;
                    }
                    if (part.type === 'text') {
                        const newText = part.text.slice(0, offset) + part.text.slice(offset + 1);
                        newParts[index] = { ...part, text: newText };
                    } else if (part.type === 'chip') {
                        newParts.splice(index, 1);
                    } else if (part.type === 'composer') {
                        const composerText = getPartDisplayText(part);
                        const prefixLength = composerText.length - part.state.query.length;
                        const queryOffset = offset - prefixLength;
                        if (queryOffset >= 0 && queryOffset < part.state.query.length) {
                            const newQuery = part.state.query.slice(0, queryOffset) + part.state.query.slice(queryOffset + 1);
                            newParts[index] = { ...part, state: { ...part.state, query: newQuery } };
                        }
                    }
                    setCursorPos(startPos);
                    break;
                }
            }
        }
      }
      
      const cleaned = newParts.filter(p => !(p.type === 'text' && p.text === ''));
      const merged = mergeTextParts(cleaned);
      
      if (merged.length === 0) {
        setParts([{ type: 'text', id: `text_${Date.now()}`, text: '' }]);
        setCursorPos(0);
      } else {
        setParts(merged);
      }
    };

    editor.addEventListener('beforeinput', handleBeforeInput);
    return () => editor.removeEventListener('beforeinput', handleBeforeInput);
  }, [parts, isComposing, getPartDisplayText, commitChip]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (cursorPos === null || !editor) return;

    let charCount = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;

    const findNode = (node: Node) => {
        if (targetNode) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.textContent?.length ?? 0;
            if (charCount + nodeLength >= cursorPos) {
                targetNode = node;
                targetOffset = cursorPos - charCount;
            } else {
                charCount += nodeLength;
            }
        } else {
            for (const child of Array.from(node.childNodes)) {
                findNode(child);
            }
        }
    }
    findNode(editor);

    if (targetNode) {
        try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(targetNode, Math.min(targetOffset, (targetNode as any).textContent?.length ?? 0));
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
        } catch (e) {
            console.error("Failed to set cursor", e);
        }
    }
    setCursorPos(null);
  }, [parts, cursorPos]);

  const isEmpty = useMemo(() => {
    if (parts.length === 0) return true;
    if (parts.length === 1 && parts[0].type === 'text' && parts[0].text.trim() === '') return true;
    return false;
  }, [parts]);

  return (
    <div className="relative w-full max-w-3xl">
      {activeComposer && suggestions.length > 0 && (
        <Suggest {...{ suggestions, highlightIndex, suggestionRefs }} onSelect={handleSelectSuggestion} style={suggestionStyle} />
      )}
      <div className="border rounded-xl p-3 w-full pr-24 bg-input flex items-center flex-wrap min-h-[48px]" onClick={() => editorRef.current?.focus()}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          className="flex-1 outline-none whitespace-pre-wrap break-words"
        >
            {parts.map(part => {
                if (part.type === 'text') {
                    return <span key={part.id} data-part-type="text">{part.text}</span>;
                }
                if (part.type === 'chip') {
                    return <ChipComponent key={part.id} chip={part.chip} hintMap={hintMap} />;
                }
                if (part.type === 'composer') {
                    return (
                        <span key={part.id} data-part-type="composer" className="text-blue-500">
                            {getPartDisplayText(part)}
                        </span>
                    );
                }
                return null;
            })}
            {isEmpty && <br/>}
        </div>
        {isEmpty && (
          <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <Button size="icon" className="rounded-full h-8 w-8" onClick={sendCurrentMessage} disabled={isEmpty}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
