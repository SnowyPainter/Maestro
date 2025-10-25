import { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RenderedMediaItem } from '@/lib/api/generated';
import { cn } from '@/lib/utils';
import { usePersonaContextStore } from '@/store/persona-context';

interface InstagramPreviewProps {
  caption: string;
  mediaItems: RenderedMediaItem[];
  size?: 'md' | 'sm';
}

export function InstagramPreview({
  caption,
  mediaItems,
  size = 'md',
}: InstagramPreviewProps) {
  const { accountHandle, personaName, accountAvatarUrl, personaAvatarUrl } = usePersonaContextStore();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const displayName = accountHandle || personaName || 'your_account';
  const displayAvatar = accountAvatarUrl || personaAvatarUrl;

  const hasMultipleMedia = mediaItems.length > 1;

  const goToPrev = () => {
    setCurrentMediaIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentMediaIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
  };

  const currentMedia = mediaItems[currentMediaIndex];
  const isSmall = size === 'sm';

  return (
    <div className={cn(
      "w-full mx-auto bg-white dark:bg-black rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800",
      isSmall ? 'max-w-[21rem]' : 'max-w-md'
    )}>
      {/* Header */}
      <div className={cn("flex items-center", isSmall ? 'p-2' : 'p-3')}>
        <Avatar className={cn(isSmall ? 'h-6 w-6' : 'h-8 w-8')}>
          <AvatarImage src={displayAvatar || undefined} alt={displayName!} />
          <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className={cn("font-semibold", isSmall ? 'text-xs ml-2' : 'text-sm ml-3')}>{displayName}</span>
        <MoreHorizontal className={cn("ml-auto text-gray-500", isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
      </div>

      {/* Media */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
        {mediaItems.length > 0 && currentMedia.url ? (
          <img
            src={currentMedia.url}
            alt={currentMedia.alt || `Media ${currentMediaIndex + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No media
          </div>
        )}
        {hasMultipleMedia && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn("absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70", isSmall ? 'left-1 h-5 w-5' : 'left-2 h-6 w-6')}
              onClick={goToPrev}
            >
              <ChevronLeft className={cn(isSmall ? 'h-3 w-3' : 'h-4 w-4')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70", isSmall ? 'right-1 h-5 w-5' : 'right-2 h-6 w-6')}
              onClick={goToNext}
            >
              <ChevronRight className={cn(isSmall ? 'h-3 w-3' : 'h-4 w-4')} />
            </Button>
            <div className={cn("absolute left-1/2 -translate-x-1/2 flex", isSmall ? 'bottom-2 gap-1' : 'bottom-4 gap-1.5')}>
              {mediaItems.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'rounded-full',
                    currentMediaIndex === index ? 'bg-white' : 'bg-white/50',
                    isSmall ? 'h-1 w-1' : 'h-1.5 w-1.5'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className={cn("flex items-center", isSmall ? 'p-2' : 'p-3')}>
        <Heart className={cn(isSmall ? 'h-5 w-5 mr-2' : 'h-6 w-6 mr-3')} />
        <MessageCircle className={cn(isSmall ? 'h-5 w-5 mr-2' : 'h-6 w-6 mr-3')} />
        <Send className={cn(isSmall ? 'h-5 w-5' : 'h-6 w-6')} />
        <Bookmark className={cn("ml-auto", isSmall ? 'h-5 w-5' : 'h-6 w-6')} />
      </div>

      {/* Likes & Caption */}
      <div className={cn(isSmall ? 'px-2 pb-2 text-xs' : 'px-3 pb-3 text-sm')}>
        <p className="font-semibold">1,234 likes</p>
        <p className="whitespace-pre-wrap">
          <span className="font-semibold">{displayName}</span>{' '}
          {caption}
        </p>
        <p className={cn("text-gray-500", isSmall ? 'text-[10px] mt-1' : 'text-xs mt-2')}>View all 56 comments</p>
      </div>
    </div>
  );
}
