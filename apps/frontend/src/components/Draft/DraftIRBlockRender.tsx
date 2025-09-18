import { DraftIR } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";

interface DraftIRBlockRenderProps {
    blocks: DraftIR['blocks'];
    compact?: boolean;
    maxTextLength?: number;
    showExpand?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

function renderBlock(block: DraftIR['blocks'][0], index: number, compact: boolean = false, maxTextLength: number = 200) {
    switch (block.type) {
        case 'text':
            const textProps = block.props as { markdown?: string; mentions?: any[] };
            const displayText = compact && textProps.markdown && textProps.markdown.length > maxTextLength
                ? textProps.markdown.substring(0, maxTextLength) + '...'
                : textProps.markdown;

            return (
                <div key={index} className={`text-sm text-muted-foreground prose prose-sm max-w-none ${compact ? 'flex-1' : ''}`}>
                    {displayText && (
                        <div dangerouslySetInnerHTML={{ __html: displayText }} />
                    )}
                </div>
            );

        case 'image':
            const imageProps = block.props as { asset_id?: number; url?: string; alt?: string; crop?: string };

            if (compact) {
                return (
                    <div key={index} className="flex-shrink-0 ml-4">
                        {imageProps.url || imageProps.asset_id ? (
                            <img
                                src={imageProps.url || `/api/assets/${imageProps.asset_id}`}
                                alt={imageProps.alt || "Draft image"}
                                className="w-16 h-16 object-cover rounded-lg border shadow-sm"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                                Image
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div key={index} className="my-4">
                    {imageProps.url || imageProps.asset_id ? (
                        <img
                            src={imageProps.url || `/api/assets/${imageProps.asset_id}`}
                            alt={imageProps.alt || "Draft image"}
                            className="max-w-full h-auto rounded-lg shadow-sm"
                            style={{
                                aspectRatio: imageProps.crop ? imageProps.crop.replace(':', '/') : 'auto'
                            }}
                        />
                    ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Image placeholder
                        </div>
                    )}
                </div>
            );

        case 'video':
            // 컴팩트 모드에서는 비디오를 표시하지 않음
            if (compact) return null;

            const videoProps = block.props as { asset_id?: number; caption?: string; ratio?: string };
            return (
                <div key={index} className="my-4">
                    {videoProps.asset_id ? (
                        <div>
                            <video
                                controls
                                className="max-w-full h-auto rounded-lg shadow-sm"
                                style={{
                                    aspectRatio: videoProps.ratio ? videoProps.ratio.replace(':', '/') : '16/9'
                                }}
                            >
                                <source src={`/api/assets/${videoProps.asset_id}`} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            {videoProps.caption && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    {videoProps.caption}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Video placeholder
                        </div>
                    )}
                </div>
            );

        default:
            const unknownBlock = block as { type: string; props: any };
            return (
                <div key={index} className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    Unsupported block type: {unknownBlock.type}
                </div>
            );
    }
}

// 블록들을 필터링하여 컴팩트 모드에서 보여줄 블록들만 선택
function getCompactBlocks(blocks: DraftIR['blocks']) {
    const textBlocks = blocks.filter(block => 
        block.type === 'text' && 
        block.props.markdown && 
        typeof block.props.markdown === 'string' && 
        block.props.markdown.trim() !== ''
    );
    const imageBlocks = blocks.filter(block => 
        block.type === 'image' && 
        block.props.url && 
        typeof block.props.url === 'string' && 
        block.props.url.trim() !== ''
    );
    const result = [];

    // 첫 번째 비어있지 않은 텍스트 블록 추가
    if (textBlocks.length > 0) {
        result.push(textBlocks[0]);
    }

    // 첫 번째 비어있지 않은 이미지 블록 추가
    if (imageBlocks.length > 0) {
        result.push(imageBlocks[0]);
    }

    return result;
}

export function DraftIRBlockRender({
    blocks,
    compact = false,
    maxTextLength = 200,
    showExpand = false,
    isExpanded = false,
    onToggleExpand
}: DraftIRBlockRenderProps) {
    const displayBlocks = compact && !isExpanded ? getCompactBlocks(blocks) : blocks;

    return (
        <div>
            {showExpand && (
                <div className="flex justify-end mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleExpand}
                        className="text-xs h-6 px-2"
                    >
                        {isExpanded ? 'Collapse' : 'Expand'}
                    </Button>
                </div>
            )}
            {compact && !isExpanded ? (
                <div className="flex items-start">
                    {displayBlocks.map((block, index) => renderBlock(block, index, compact, maxTextLength))}
                </div>
            ) : (
                <div className="space-y-4">
                    {displayBlocks.map((block, index) => renderBlock(block, index, false, maxTextLength))}
                </div>
            )}
        </div>
    );
}
