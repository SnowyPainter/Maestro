import { TrackingLinkListResponse, TrackingLinkItem } from "@/lib/api/generated";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Twitter,
  Facebook,
  Instagram,
  AtSign,
  Linkedin,
  Youtube,
  Globe,
  Users,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { useState } from "react";

interface TrackingLinkListProps {
  data: TrackingLinkListResponse;
}

const formatLastVisited = (dateString: string | null) => {
  if (!dateString) return "";
  try {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: enUS
    });
  } catch {
    return "Invalid date";
  }
};

const getPlatformIcon = (platform?: string | null) => {
  const platformName = platform?.toLowerCase();
  switch (platformName) {
    case 'twitter':
    case 'x':
      return <Twitter className="h-4 w-4 text-blue-500" />;
    case 'facebook':
      return <Facebook className="h-4 w-4 text-blue-600" />;
    case 'threads':
      return <AtSign className="h-4 w-4 text-gray-500" />;
    case 'instagram':
      return <Instagram className="h-4 w-4 text-pink-500" />;
    case 'linkedin':
      return <Linkedin className="h-4 w-4 text-blue-700" />;
    case 'youtube':
      return <Youtube className="h-4 w-4 text-red-500" />;
    default:
      return <Globe className="h-4 w-4 text-gray-500" />;
  }
};

const TrackingLinkRow = ({ item }: { item: TrackingLinkItem }) => {
  const hasVisits = item.last_visited_at !== null && item.visit_count > 0;

  return (
    <div className="flex items-center gap-3 py-2 px-1 hover:bg-muted/50 rounded-sm">
      {/* Platform Icon */}
      {getPlatformIcon(item.platform)}

      {/* Target URL -> Public URL */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <a
          href={item.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 underline truncate max-w-[200px]"
          title={item.target_url}
        >
          {item.target_url}
        </a>
        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <a
          href={item.public_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 underline truncate max-w-[200px]"
          title={item.public_url}
        >
          {item.public_url}
        </a>
      </div>

      {/* Visit Info or No Visits */}
      {hasVisits ? (
        <>
          {/* Visit Count */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
            <Users className="h-3 w-3" />
            <span>{item.visit_count.toLocaleString()}</span>
          </div>

          {/* Last Visited */}
          <div className="text-sm text-muted-foreground flex-shrink-0 min-w-[80px]">
            {formatLastVisited(item.last_visited_at)}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground flex-shrink-0 min-w-[80px]">
          No visits
        </div>
      )}

      {/* Persona Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground flex-shrink-0">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="text-sm">
            <strong>Persona:</strong> {item.persona_name || "Unknown"}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export function TrackingLinkList({ data }: TrackingLinkListProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  if (!data.items || data.items.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No tracking links found.
      </div>
    );
  }

  // Sort items by last_visited_at (null values go to the end)
  const sortedItems = [...data.items].sort((a, b) => {
    if (!a.last_visited_at && !b.last_visited_at) return 0;
    if (!a.last_visited_at) return 1;
    if (!b.last_visited_at) return -1;
    return new Date(b.last_visited_at).getTime() - new Date(a.last_visited_at).getTime();
  });

  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const displayItems = sortedItems.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-medium text-sm">Tracking Links</h3>
        <span className="text-xs text-muted-foreground">
          {data.total} total
        </span>
      </div>

      <div className="space-y-1">
        {displayItems.map((item, index) => (
          <div key={item.id}>
            <TrackingLinkRow item={item} />
            {index < displayItems.length - 1 && <Separator className="my-1" />}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>

          <span className="text-xs text-muted-foreground">
            {currentPage + 1} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1}
            className="h-7 px-2"
          >
            Next
            <ChevronRightIcon className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
