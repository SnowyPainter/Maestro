import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RenderedMediaItem } from '@/lib/api/generated';
import { MoreHorizontal, Heart, MessageCircle, Repeat, Send } from 'lucide-react';
import { usePersonaContextStore } from '@/store/persona-context';

interface ThreadsPreviewProps {
  caption: string;
  mediaItems: RenderedMediaItem[];
}

export function ThreadsPreview({
  caption,
  mediaItems,
}: ThreadsPreviewProps) {
  const { accountHandle, personaName, accountAvatarUrl, personaAvatarUrl } = usePersonaContextStore();
  const hasMedia = mediaItems.length > 0;

  const displayName = accountHandle || personaName || 'your_account';
  const displayAvatar = accountAvatarUrl || personaAvatarUrl;

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-black rounded-xl p-4 border border-gray-200 dark:border-gray-800">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={displayAvatar || undefined} alt={displayName!} />
            <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm">{displayName}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="text-xs">1m</span>
          <MoreHorizontal className="h-5 w-5" />
        </div>
      </div>

      <div className="ml-13 mt-1 pl-1">
        <p className="whitespace-pre-wrap text-sm">{caption}</p>

        {hasMedia && (
          <div className={`mt-3 grid gap-2 grid-cols-${Math.min(mediaItems.length, 3)}`}>
            {mediaItems.map((item, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden border dark:border-gray-700">
                {item.url ? (
                  <img src={item.url} alt={`media ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-900"></div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-gray-500">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Repeat className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span>12 replies</span>
          <span>·</span>
          <span>1,234 likes</span>
        </div>
      </div>
    </div>
  );
}