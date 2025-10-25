import { useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { ImageIcon, Upload, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { useUploadFileApiFilesFilesPost } from "@/lib/api/generated";

interface ImageBlockProps {
    blockId: string;
    url: string;
    assetId?: number;
    alt: string;
    expanded: boolean;
    isLastBlock: boolean;
    onUrlChange: (value: string) => void;
    onAltChange: (value: string) => void;
    onAssetIdChange: (value: number | undefined) => void;
    onDeleteBlock: () => void;
    onBlur: () => void;
    onToggleExpand: () => void;
}

export function ImageBlock({
    blockId,
    url,
    assetId,
    alt,
    expanded,
    isLastBlock,
    onUrlChange,
    onAltChange,
    onAssetIdChange,
    onDeleteBlock,
    onBlur,
    onToggleExpand
}: ImageBlockProps) {
    const urlInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadMutation = useUploadFileApiFilesFilesPost({ request: { headers: {} } });

    useEffect(() => {
        if (expanded && urlInputRef.current) {
            // 블록이 열릴 때 URL input에 포커스를 주고 커서를 텍스트 끝으로 이동
            urlInputRef.current.focus();
            urlInputRef.current.setSelectionRange(url.length, url.length);
        }
    }, [expanded, url.length]);

    const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !url.trim() && !isLastBlock) {
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
            onUrlChange(result.url);
            onAssetIdChange(result.id);
            if (!alt?.trim() && result.original_filename) {
                onAltChange(result.original_filename);
            }
            toast.success("Image uploaded successfully.");
        } catch (error) {
            const message =
                (error as any)?.data?.detail ??
                (error as any)?.message ??
                "Image upload failed.";
            toast.error(message);
        } finally {
            if (event.target) {
                event.target.value = "";
            }
        }
    };

    const isUploading = uploadMutation.isPending;

    if (expanded) {
        return (
            <div className="p-3 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
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
                            {isUploading ? "Uploading..." : "Upload Image"}
                        </Button>
                        {typeof assetId === "number" && (
                            <span className="text-xs text-muted-foreground">
                                Asset #{assetId}
                            </span>
                        )}
                    </div>
                    <Input
                        ref={urlInputRef}
                        placeholder="Enter image URL..."
                        value={url}
                        onChange={(e) => onUrlChange(e.target.value)}
                        onKeyDown={handleUrlKeyDown}
                        className="border-0 bg-transparent focus:ring-1 text-sm"
                        onBlur={onBlur}
                    />
                    {url && (
                        <div className="mt-2">
                            <img
                                src={url}
                                alt={alt || "Preview"}
                                className="max-w-full h-auto max-h-32 rounded border"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="py-1 px-2 cursor-pointer hover:bg-muted/30 rounded-sm transition-colors -my-1"
            onClick={onToggleExpand}
        >
            <div className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <div className="text-sm text-muted-foreground flex-1 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span>
                        {url ? 'Image' : 'Empty image block'}
                    </span>
                    {url && (
                        <img
                            src={url}
                            alt={alt || "Preview"}
                            className="h-6 w-6 object-cover rounded"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
