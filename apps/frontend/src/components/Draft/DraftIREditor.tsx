import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Type, Image as ImageIcon } from "lucide-react";
import { DraftIR } from "@/lib/api/generated";
import { TextBlock } from "./TextBlock";
import { ImageBlock } from "./ImageBlock";
import { VideoBlock } from "./VideoBlock";

interface Block {
    id: string;
    type: 'text' | 'image' | 'video';
    expanded: boolean;
    props: {
        markdown?: string;
        url?: string;
        alt?: string;
        asset_id?: number;
        caption?: string;
        ratio?: string;
    };
}

interface DraftIREditorProps {
    initialBlocks?: DraftIR['blocks'];
    onBlocksChange: (blocks: DraftIR['blocks']) => void;
}

export function DraftIREditor({ initialBlocks = [], onBlocksChange }: DraftIREditorProps) {
    const [blocks, setBlocks] = useState<Block[]>(() => {
        if (initialBlocks.length > 0) {
            return initialBlocks.map((block, index) => ({
                id: `block-${index}`,
                type: block.type as 'text' | 'image' | 'video',
                expanded: false,
                props: block.props
            }));
        }
        return [{ id: 'block-0', type: 'text' as const, expanded: true, props: { markdown: '' } }];
    });

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const updateBlocks = (newBlocks: Block[]) => {
        setBlocks(newBlocks);
        const draftIRBlocks = newBlocks.map(({ id, expanded, ...block }) => block);
        onBlocksChange(draftIRBlocks);
    };

    const addBlock = (type: 'text' | 'image' | 'video', index?: number) => {
        const newBlock: Block = {
            id: `block-${Date.now()}`,
            type,
            expanded: true,
            props: type === 'text'
                ? { markdown: '' }
                : type === 'image'
                ? { url: '', alt: '' }
                : { asset_id: undefined, caption: '', ratio: '' }
        };

        (newBlock as any).createdAt = Date.now();

        const insertIndex = index !== undefined ? index : blocks.length;
        const newBlocks = [...blocks];
        newBlocks.splice(insertIndex, 0, newBlock);
        updateBlocks(newBlocks);
    };


    const updateBlock = (blockId: string, updates: Partial<Block>) => {
        setBlocks(currentBlocks => {
            const newBlocks = currentBlocks.map(block =>
                block.id === blockId ? { ...block, ...updates } : block
            );
            const draftIRBlocks = newBlocks.map(({ id, expanded, ...block }) => block);
            onBlocksChange(draftIRBlocks);
            return newBlocks;
        });
    };

    const updateBlockProps = (blockId: string, props: Partial<Block['props']>) => {
        setBlocks(currentBlocks => {
            const newBlocks = currentBlocks.map(block =>
                block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block
            );
            const draftIRBlocks = newBlocks.map(({ id, expanded, ...block }) => block);
            onBlocksChange(draftIRBlocks);
            return newBlocks;
        });
    };

    const toggleBlockExpansion = (blockId: string) => {
        updateBlock(blockId, { expanded: !blocks.find(b => b.id === blockId)?.expanded });
    };

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, blockId: string, index: number) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            addBlock('text', index + 1);
        }
    };

    const handleDeleteBlock = (blockId: string, index: number) => {
        if (blocks.length > 1 && index > 0) {
            const newBlocks = blocks.filter(block => block.id !== blockId);
            const prevBlock = newBlocks[index - 1]; // 삭제 후의 인덱스로 계산
            setBlocks(newBlocks);
            const draftIRBlocks = newBlocks.map(({ id, expanded, ...block }) => block);
            onBlocksChange(draftIRBlocks);

            // 이전 블록으로 포커스 이동
            if (prevBlock) {
                setBlocks(currentBlocks =>
                    currentBlocks.map(block =>
                        block.id === prevBlock.id ? { ...block, expanded: true } : block
                    )
                );
            }
        }
    };

    const handleTextChange = (blockId: string, value: string) => {
        updateBlockProps(blockId, { markdown: value });
        if (value.trim() && !blocks.find(b => b.id === blockId)?.expanded) {
            updateBlock(blockId, { expanded: true });
        }
    };


    const handleImageUrlChange = (blockId: string, value: string) => {
        updateBlockProps(blockId, { url: value });
    };

    const handleImageAltChange = (blockId: string, value: string) => {
        updateBlockProps(blockId, { alt: value });
    };

    const handleBlockBlur = (blockId: string) => {
        updateBlock(blockId, { expanded: false });
    };

    const handleVideoAssetIdChange = (blockId: string, value: string) => {
        const assetId = value ? parseInt(value) : undefined;
        updateBlockProps(blockId, { asset_id: assetId });
    };

    const handleVideoCaptionChange = (blockId: string, value: string) => {
        updateBlockProps(blockId, { caption: value });
    };

    const handleVideoRatioChange = (blockId: string, value: string) => {
        updateBlockProps(blockId, { ratio: value });
    };


    return (
        <div className="space-y-1">
            {blocks.map((block, index) => (
                <div key={block.id}>
                    {/* 블록 앞 호버 영역 */}
                    <div
                        className={`h-6 flex items-center justify-center transition-opacity duration-200 -mb-3 relative z-10 ${
                            hoveredIndex === index ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                        }`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className="flex gap-1 bg-background border rounded-md shadow-sm px-2 py-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    addBlock('text', index);
                                    
                                }}
                            >
                                <Type className="h-3 w-3 mr-1" />
                                Text
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    addBlock('image', index);
                                }}
                            >
                                <ImageIcon className="h-3 w-3 mr-1" />
                                Image
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    addBlock('video', index);
                                }}
                            >
                                Video
                            </Button>
                        </div>
                    </div>

                    {/* 블록 콘텐츠 */}
                    <div className="relative group">
                        {block.type === 'text' ? (
                            <TextBlock
                                blockId={block.id}
                                markdown={block.props.markdown || ''}
                                expanded={block.expanded}
                                isLastBlock={index === blocks.length - 1}
                                onChange={(value) => handleTextChange(block.id, value)}
                                onKeyDown={(e) => handleTextKeyDown(e, block.id, index)}
                                onDeleteBlock={() => handleDeleteBlock(block.id, index)}
                                onBlur={() => handleBlockBlur(block.id)}
                                onToggleExpand={() => toggleBlockExpansion(block.id)}
                            />
                        ) : block.type === 'image' ? (
                            <ImageBlock
                                blockId={block.id}
                                url={block.props.url || ''}
                                alt={block.props.alt || ''}
                                expanded={block.expanded}
                                isLastBlock={index === blocks.length - 1}
                                onUrlChange={(value) => handleImageUrlChange(block.id, value)}
                                onAltChange={(value) => handleImageAltChange(block.id, value)}
                                onDeleteBlock={() => handleDeleteBlock(block.id, index)}
                                onBlur={() => handleBlockBlur(block.id)}
                                onToggleExpand={() => toggleBlockExpansion(block.id)}
                            />
                        ) : (
                            <VideoBlock
                                blockId={block.id}
                                assetId={block.props.asset_id}
                                caption={block.props.caption || ''}
                                ratio={block.props.ratio || ''}
                                expanded={block.expanded}
                                isLastBlock={index === blocks.length - 1}
                                onAssetIdChange={(value) => handleVideoAssetIdChange(block.id, value)}
                                onCaptionChange={(value) => handleVideoCaptionChange(block.id, value)}
                                onRatioChange={(value) => handleVideoRatioChange(block.id, value)}
                                onDeleteBlock={() => handleDeleteBlock(block.id, index)}
                                onBlur={() => handleBlockBlur(block.id)}
                                onToggleExpand={() => toggleBlockExpansion(block.id)}
                            />
                        )}
                    </div>
                </div>
            ))}

            {/* 마지막 블록 뒤 호버 영역 */}
            <div
                className={`h-6 flex items-center justify-center transition-opacity duration-200 -mt-3 relative z-10 ${
                    hoveredIndex === blocks.length ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                onMouseEnter={() => setHoveredIndex(blocks.length)}
                onMouseLeave={() => setHoveredIndex(null)}
            >
                <div className="flex gap-1 bg-background border rounded-md shadow-sm px-2 py-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            addBlock('text');
                        }}
                    >
                        <Type className="h-3 w-3 mr-1" />
                        Text
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            addBlock('image');
                        }}
                    >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Image
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                            e.preventDefault();
                            addBlock('video');
                        }}
                    >
                        Video
                    </Button>
                </div>
            </div>
        </div>
    );
}
