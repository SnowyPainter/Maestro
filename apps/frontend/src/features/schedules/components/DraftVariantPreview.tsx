import { DraftVariantRender, RenderedMediaItem } from "@/lib/api/generated";
import { InstagramPreview } from "@/entities/drafts/components/preview/Instagram";
import { ThreadsPreview } from "@/entities/drafts/components/preview/Threads";
import { Instagram, Twitter, Facebook, Linkedin, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

const platformIcons: { [key: string]: React.ReactNode } = {
    instagram: <Instagram className="h-5 w-5 text-muted-foreground" />,
    twitter: <Twitter className="h-5 w-5 text-muted-foreground" />,
    facebook: <Facebook className="h-5 w-5 text-muted-foreground" />,
    linkedin: <Linkedin className="h-5 w-5 text-muted-foreground" />,
    web: <Newspaper className="h-5 w-5 text-muted-foreground" />,
};

function GenericPreview({ variant }: { variant: DraftVariantRender }) {
    const media = variant.rendered_blocks?.media?.filter(r => r.type === 'image' || r.type === 'video') || [];
    const caption = variant.rendered_caption || '';
    const platform = variant.platform.toLowerCase();
    const Icon = platformIcons[platform] || platformIcons.web;

    const Header = () => (
        <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
            {Icon}
            <span className="font-semibold capitalize text-foreground">{variant.platform}</span>
        </div>
    );

    const Caption = () => (
        <p className="text-sm whitespace-pre-wrap text-foreground/90">{caption}</p>
    );

    const MediaGrid = () => (
        <div className="grid gap-2 grid-cols-2">
            {media.map((block, index) => (
                <img key={index} src={block.url} alt="variant media" className="rounded-lg object-cover w-full aspect-square" />
            ))}
        </div>
    );
    
    const SingleMedia = () => (
        media.length > 0 ? <img src={media[0].url} alt="variant media" className="rounded-lg object-cover w-full" /> : null
    );

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <Header />
            <div className="p-3">
                {media.length > 0 && (media.length > 1 ? <MediaGrid /> : <SingleMedia />)}
                <div className={cn(media.length > 0 ? "mt-2" : "mt-0")}>
                    <Caption />
                </div>
            </div>
        </div>
    );
}

export function DraftVariantPreview({ variant }: { variant: DraftVariantRender }) {
    const media = variant.rendered_blocks?.media?.filter((r): r is RenderedMediaItem => (r.type === 'image' || r.type === 'video') && r.url !== undefined) || [];
    const caption = variant.rendered_caption || '';
    const platform = variant.platform.toLowerCase();

    switch (platform) {
        case 'instagram':
            return <InstagramPreview caption={caption} mediaItems={media} />;
        case 'threads':
            return <ThreadsPreview caption={caption} mediaItems={media} />;
        default:
            return <GenericPreview variant={variant} />;
    }
}
