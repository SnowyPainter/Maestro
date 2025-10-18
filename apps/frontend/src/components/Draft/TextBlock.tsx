import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface TextBlockProps {
    blockId: string;
    markdown: string;
    expanded: boolean;
    isLastBlock: boolean;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onDeleteBlock: () => void;
    onBlur: () => void;
    onToggleExpand: () => void;
}

export function TextBlock({
    blockId,
    markdown,
    expanded,
    isLastBlock,
    onChange,
    onKeyDown,
    onPaste,
    onDeleteBlock,
    onBlur,
    onToggleExpand
}: TextBlockProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (expanded && textareaRef.current) {
            // 블록이 열릴 때 커서를 텍스트 끝으로 이동
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus({ preventScroll: true });
                    textareaRef.current.setSelectionRange(markdown.length, markdown.length);
                }
            }, 0);
        }
    }, [expanded, markdown.length]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Backspace' && !markdown.trim() && !isLastBlock) {
            e.preventDefault();
            onDeleteBlock();
        }
        onKeyDown(e);
    };

    if (expanded) {
        return (
            <Textarea
                ref={textareaRef}
                placeholder="Start writing..."
                value={markdown}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={onPaste}
                onBlur={onBlur}
                data-block-id={blockId} // Add this line
                className="p-3 min-h-20 resize-none border-0 bg-transparent focus:ring-0 text-sm"
            />
        );
    }

    return (
        <div
            className="py-1 px-2 cursor-pointer hover:bg-muted/30 rounded-sm transition-colors -my-1"
            onClick={onToggleExpand}
        >
            <div className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <div className="text-sm text-muted-foreground flex-1">
                    {markdown ? (
                        <div
                            className="overflow-hidden"
                            style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                            }}
                            dangerouslySetInnerHTML={{
                                __html: markdown.length > 100
                                    ? markdown.substring(0, 100) + '...'
                                    : markdown
                            }}
                        />
                    ) : (
                        <span className="text-muted-foreground/50">Empty text block</span>
                    )}
                </div>
            </div>
        </div>
    );
}
