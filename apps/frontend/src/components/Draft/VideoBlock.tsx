import { useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useUploadFileApiFilesFilesPost } from "@/lib/api/generated";

interface VideoBlockProps {
    blockId: string;
    assetId: number | undefined;
    url: string;
    caption: string;
    ratio: string;
    expanded: boolean;
    isLastBlock: boolean;
    onAssetIdChange: (value: string) => void;
    onUrlChange: (value: string) => void;
    onCaptionChange: (value: string) => void;
    onRatioChange: (value: string) => void;
    onDeleteBlock: () => void;
    onBlur: () => void;
    onToggleExpand: () => void;
}

export function VideoBlock({
    blockId,
    assetId,
    url,
    caption,
    ratio,
    expanded,
    isLastBlock,
    onAssetIdChange,
    onUrlChange,
    onCaptionChange,
    onRatioChange,
    onDeleteBlock,
    onBlur,
    onToggleExpand
}: VideoBlockProps) {
    const assetIdInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadMutation = useUploadFileApiFilesFilesPost({ request: { headers: {} } });
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

    const handleUploadButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const result = await uploadMutation.mutateAsync({ data: { file } });
            onAssetIdChange(String(result.id));
            onUrlChange(result.url);
            toast.success("비디오를 업로드했어요.");
        } catch (error) {
            const message =
                (error as any)?.data?.detail ??
                (error as any)?.message ??
                "비디오 업로드에 실패했어요.";
            toast.error(message);
        } finally {
            if (event.target) {
                event.target.value = "";
            }
        }
    };

    const isUploading = uploadMutation.isPending;
    const previewUrl = url || (assetId ? `/api/assets/${assetId}` : "");

    if (expanded) {
        return (
            <div className="p-3 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUploadButtonClick}
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-3 w-3" />
                            )}
                            {isUploading ? "Uploading..." : "Upload Video"}
                        </Button>
                        {assetId && (
                            <span className="text-xs text-muted-foreground">
                                Asset #{assetId}
                            </span>
                        )}
                    </div>
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

                    {previewUrl ? (
                        <div className="mt-3">
                            <video
                                controls
                                className="max-w-full h-auto rounded border"
                                style={{
                                    aspectRatio: ratio ? ratio.replace(':', '/') : '16/9'
                                }}
                            >
                                {previewUrl && <source src={previewUrl} type="video/mp4" />}
                                Your browser does not support the video tag.
                            </video>
                            {caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    {caption}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="mt-3 w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Video placeholder
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 컴팩트 모드에서는 비디오 블록을 표시하지 않음
    return null;
}
