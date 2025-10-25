import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RenderedMediaItem } from '@/lib/api/generated';
import { MoreHorizontal, Heart, MessageCircle, Repeat, Send } from 'lucide-react';
import { usePersonaContextStore } from '@/store/persona-context';
import { cn } from '@/lib/utils';

interface ThreadsPreviewProps {
  caption: string;
  mediaItems: RenderedMediaItem[];
  size?: 'md' | 'sm';
}

export function ThreadsPreview({
  caption,
  mediaItems,
  size = 'md',
}: ThreadsPreviewProps) {
  const { accountHandle, personaName, accountAvatarUrl, personaAvatarUrl } = usePersonaContextStore();
  const hasMedia = mediaItems.length > 0;

  const displayName = accountHandle || personaName || 'your_account';
  const displayAvatar = accountAvatarUrl || personaAvatarUrl;
  const isSmall = size === 'sm';

  return (
    <div className={cn(
      "w-full mx-auto bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800",
      isSmall ? 'max-w-[26rem] p-3' : 'max-w-md p-4'
    )}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Avatar className={cn(isSmall ? 'h-8 w-8' : 'h-10 w-10')}>
            <AvatarImage src={displayAvatar || undefined} alt={displayName!} />
            <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className={cn("font-semibold", isSmall ? 'text-xs' : 'text-sm')}>{displayName}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span className={cn(isSmall ? 'text-[10px]' : 'text-xs')}>1m</span>
          <MoreHorizontal className={cn(isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
        </div>
      </div>

      <div className={cn("mt-1 pl-1", isSmall ? 'ml-11' : 'ml-13')}>
        <p className={cn("whitespace-pre-wrap", isSmall ? 'text-xs' : 'text-sm')}>{caption}</p>

        {hasMedia && (
          <div className={`mt-2 grid gap-1.5 grid-cols-${Math.min(mediaItems.length, 3)}`}>
            {mediaItems.map((item, index) => (
              <div key={index} className="aspect-square rounded-md overflow-hidden border dark:border-gray-700">
                {item.url ? (
                  <img src={item.url} alt={`media ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-900"></div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={cn("flex items-center text-gray-500", isSmall ? 'mt-3 gap-3' : 'mt-4 gap-4')}>
          <Heart className={cn(isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
          <MessageCircle className={cn(isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
          <Repeat className={cn(isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
          <Send className={cn(isSmall ? 'h-4 w-4' : 'h-5 w-5')} />
        </div>

        <div className={cn("flex items-center text-gray-500", isSmall ? 'text-[10px] mt-1.5 gap-1.5' : 'text-xs mt-2 gap-2')}>
          <span>12 replies</span>
          <span>·</span>
          <span>1,234 likes</span>
        </div>
      </div>
    </div>
  );
}
