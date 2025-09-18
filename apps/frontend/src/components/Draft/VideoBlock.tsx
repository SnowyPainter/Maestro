import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Video, X } from "lucide-react";

interface VideoBlockProps {
    blockId: string;
    assetId: number | undefined;
    caption: string;
    ratio: string;
    expanded: boolean;
    isLastBlock: boolean;
    onAssetIdChange: (value: string) => void;
    onCaptionChange: (value: string) => void;
    onRatioChange: (value: string) => void;
    onDeleteBlock: () => void;
    onBlur: () => void;
    onToggleExpand: () => void;
}

export function VideoBlock({
    blockId,
    assetId,
    caption,
    ratio,
    expanded,
    isLastBlock,
    onAssetIdChange,
    onCaptionChange,
    onRatioChange,
    onDeleteBlock,
    onBlur,
    onToggleExpand
}: VideoBlockProps) {
    const assetIdInputRef = useRef<HTMLInputElement>(null);
    const assetIdString = assetId?.toString() || '';

    useEffect(() => {
        if (expanded && assetIdInputRef.current) {
            // 블록이 열릴 때 asset ID input에 포커스를 주고 커서를 텍스트 끝으로 이동
            assetIdInputRef.current.focus();
            assetIdInputRef.current.setSelectionRange(assetIdString.length, assetIdString.length);
        }
    }, [expanded, assetIdString.length]);

    const handleAssetIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !assetIdString.trim() && !isLastBlock) {
            e.preventDefault();
            onDeleteBlock();
        }
    };

    if (expanded) {
        return (
            <div className="p-3 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                    <Input
                        ref={assetIdInputRef}
                        placeholder="Enter video asset ID..."
                        value={assetIdString}
                        onChange={(e) => onAssetIdChange(e.target.value)}
                        onKeyDown={handleAssetIdKeyDown}
                        className="border-0 bg-transparent focus:ring-1 text-sm"
                        onBlur={onBlur}
                    />
                    <Input
                        placeholder="Caption (optional)"
                        value={caption}
                        onChange={(e) => onCaptionChange(e.target.value)}
                        className="border-0 bg-transparent focus:ring-1 text-sm"
                    />
                    <Input
                        placeholder="Aspect ratio (e.g. 16:9)"
                        value={ratio}
                        onChange={(e) => onRatioChange(e.target.value)}
                        className="border-0 bg-transparent focus:ring-1 text-sm"
                    />

                    {assetId && (
                        <div className="mt-3">
                            <video
                                controls
                                className="max-w-full h-auto rounded border"
                                style={{
                                    aspectRatio: ratio ? ratio.replace(':', '/') : '16/9'
                                }}
                            >
                                <source src={`/api/assets/${assetId}`} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            {caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    {caption}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 컴팩트 모드에서는 비디오 블록을 표시하지 않음
    return null;
}
