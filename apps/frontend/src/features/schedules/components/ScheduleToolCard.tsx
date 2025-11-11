import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Zap, Send, Mail, Cog, CalendarX2, Settings, Activity, AlertTriangle, Loader2, CalendarPlus } from "lucide-react";
import React, { useState, useMemo } from "react";
import { usePersonaAccountValidity } from "@/entities/personas/model/usePersonaAccountValidity";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBffScheduleListTemplatesApiBffScheduleTemplatesGet, ScheduleTemplateItem } from "@/lib/api/generated";
import { Skeleton } from "@/components/ui/skeleton";

interface ScheduleTemplate {
  id: string;
  title: string;
  description: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
  disabled?: boolean;
  disabledReason?: string;
  visibility?: 'public' | 'advanced' | 'system' | string;
}

interface ScheduleToolCardProps {
  onScheduleAction: (template: ScheduleTemplateItem) => void;
  onNewRawSchedule: () => void;
  onCancel: () => void;
}

interface ScheduleTypeCardProps {
    template: ScheduleTemplate;
}

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'execution':
            return <Zap className="h-5 w-5" />;
        case 'publishing':
            return <Send className="h-5 w-5" />;
        case 'communication':
            return <Mail className="h-5 w-5" />;
        case 'monitoring':
            return <Activity className="h-5 w-5" />;
        case 'management':
            return <Settings className="h-5 w-5" />;
        case 'advanced':
            return <Cog className="h-5 w-5" />;
        default:
            return <Settings className="h-5 w-5" />;
    }
};

function ScheduleTypeCard({ template }: ScheduleTypeCardProps) {
    const cardButton = (
        <button
            onClick={template.action}
            disabled={template.disabled}
            className="group p-3 rounded-lg bg-card text-left transition-colors duration-200 flex flex-col items-start gap-2 w-full h-full disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-primary"
        >
            <div className="flex items-start justify-between w-full">
                <div className="p-1.5 bg-muted rounded-md">
                    <div className="transition-transform duration-200 group-hover:scale-105">
                        {template.icon}
                    </div>
                </div>
                {template.visibility && (
                    <Badge variant={template.visibility === 'system' ? "outline" : "secondary"} className="text-xs font-medium">
                        {template.visibility.charAt(0).toUpperCase() + template.visibility.slice(1)}
                    </Badge>
                )}
            </div>
            <div className="flex-1 w-full">
                <h4 className="font-medium text-sm">{template.title}</h4>
                <p className="text-xs text-muted-foreground">{template.description}</p>
            </div>
        </button>
    );

    if (template.disabled && template.disabledReason) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full h-full">{cardButton}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{template.disabledReason}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return cardButton;
}

export function ScheduleToolCard({
  onScheduleAction,
  onNewRawSchedule,
  onCancel
}: ScheduleToolCardProps) {
  const { isActionDisabled, reason } = usePersonaAccountValidity();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bffTemplates, isLoading, isError } = useBffScheduleListTemplatesApiBffScheduleTemplatesGet();

  const allTemplates = useMemo(() => {
    const staticTemplates: ScheduleTemplate[] = [
      {
        id: 'raw-schedule',
        title: 'Raw Schedule',
        description: 'Create from a raw DAG (Advanced).',
        group: 'advanced',
        icon: <Cog className="h-5 w-5 text-primary" />,
        action: onNewRawSchedule,
        visibility: 'advanced'
      },
      {
        id: 'cancel-schedules',
        title: 'Cancel Schedules',
        description: 'Bulk-cancel pending schedules.',
        group: 'management',
        icon: <CalendarX2 className="h-5 w-5 text-destructive" />,
        action: onCancel,
        visibility: 'public'
      }
    ];

    const dynamicTemplates: ScheduleTemplate[] = bffTemplates?.templates.map(t => {
      return {
        id: t.key,
        title: t.title,
        description: t.description,
        group: t.group,
        icon: getCategoryIcon(t.group),
        action: () => onScheduleAction(t),
        disabled: isActionDisabled,
        disabledReason: reason,
        visibility: t.visibility,
      };
    }) || [];

    return [...dynamicTemplates, ...staticTemplates];
  }, [bffTemplates, isActionDisabled, reason, onScheduleAction, onNewRawSchedule, onCancel]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) {
      return allTemplates;
    }
    return allTemplates.filter(template =>
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allTemplates, searchQuery]);

  return (
    <Card className="rounded-xl border bg-card text-card-foreground">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarPlus className="h-5 w-5" />
          Create a new Schedule
        </CardTitle>
        <p className="text-muted-foreground text-xs mt-1">
          Select a template to start, or create a raw schedule for advanced use.
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1">
          <ScrollArea className="h-[380px] -mx-1 px-1">
            <div className="py-2">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3 rounded-lg bg-card border flex flex-col gap-2">
                        <div className="flex items-start justify-between w-full">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                        <div className="flex-1 w-full space-y-1.5">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-full" />
                        </div>
                    </div>
                  ))}
                </div>
              ) : isError ? (
                <div className="text-center py-8 text-destructive bg-destructive/5 rounded-xl">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-80" />
                  <p className="font-medium text-sm">Error Loading Templates</p>
                  <p className="text-xs text-destructive/80 mt-1">Could not fetch schedule templates. Please try again later.</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-xl">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium text-sm">No Templates Found</p>
                  <p className="text-xs mt-1">Your search for "{searchQuery}" did not match any templates.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTemplates.map((template) => (
                    <ScheduleTypeCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
      </CardContent>
    </Card>
  );
}
