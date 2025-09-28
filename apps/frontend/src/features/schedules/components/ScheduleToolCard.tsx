import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Send, Cog, CalendarX2 } from "lucide-react";
import React from "react";
import { usePersonaAccountValidity } from "@/entities/personas/model/usePersonaAccountValidity";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScheduleToolCardProps {
  onNewPostSchedule: () => void;
  onNewMailSchedule: () => void;
  onNewRawSchedule: () => void;
  onCancel: () => void;
}

interface ScheduleTypeCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
}

function ScheduleTypeCard({ icon, title, description, onClick, disabled, disabledReason }: ScheduleTypeCardProps) {
    const cardButton = (
        <button
            onClick={onClick}
            disabled={disabled}
            className="group p-4 rounded-2xl bg-card text-left transition-all duration-200 shadow-md hover:shadow-lg flex flex-col items-start gap-2 w-full h-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
        >
            <div className="p-2 bg-muted rounded-lg">
                <div className="transition-transform duration-200 group-hover:scale-110">
                    {icon}
                </div>
            </div>
            <div className="flex-1">
                <h4 className="font-semibold text-sm">{title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
        </button>
    );

    if (disabled && disabledReason) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="w-full h-full">{cardButton}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{disabledReason}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return cardButton;
}

export function ScheduleToolCard({ 
  onNewPostSchedule, 
  onNewMailSchedule, 
  onNewRawSchedule,
  onCancel 
}: ScheduleToolCardProps) {
  const { isActionDisabled, reason, hasPersona } = usePersonaAccountValidity();

  const mailDisabled = !hasPersona;
  const mailDisabledReason = mailDisabled ? "A Persona Account must be selected to schedule mail." : "";

  return (
    <Card className="rounded-2xl border-none bg-transparent shadow-none">
      <CardHeader className="p-2 mb-2">
        <CardTitle>New Schedule</CardTitle>
      </CardHeader>
      <CardContent className="p-0 grid grid-cols-2 gap-4">
        <ScheduleTypeCard 
            icon={<Send className="h-5 w-5 text-primary" />} 
            title="Post Schedule"
            description="Publish a draft at a specific time."
            onClick={onNewPostSchedule}
            disabled={isActionDisabled}
            disabledReason={reason}
        />
        <ScheduleTypeCard 
            icon={<Mail className="h-5 w-5 text-primary" />} 
            title="Mail Schedule"
            description="Send batch emails based on trends."
            onClick={onNewMailSchedule}
            disabled={mailDisabled}
            disabledReason={mailDisabledReason}
        />
        <ScheduleTypeCard 
            icon={<Cog className="h-5 w-5 text-primary" />} 
            title="Raw Schedule"
            description="Create from a raw DAG (Advanced)."
            onClick={onNewRawSchedule}
        />
        <ScheduleTypeCard 
            icon={<CalendarX2 className="h-5 w-5 text-destructive" />} 
            title="Cancel Schedules"
            description="Bulk-cancel pending schedules."
            onClick={onCancel}
        />
      </CardContent>
    </Card>
  );
}
