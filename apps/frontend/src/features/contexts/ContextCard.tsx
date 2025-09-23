import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { X, AlertTriangle, RefreshCw } from "lucide-react";

interface ContextCardProps {
    icon: LucideIcon;
    label: string;
    value: string;
    enabled: boolean;
    onToggle?: (checked: boolean) => void;
    toggleDisabled?: boolean;
    onClear?: () => void;
    clearDisabled?: boolean;
    helper?: string;
    className?: string;
    // Persona account specific props
    variant?: 'default' | 'persona';
    personaAvatarUrl?: string;
    accountHandle?: string;
    accountPlatform?: string;
    accountAvatarUrl?: string;
    isValid?: boolean;
    onReconnect?: () => void;
    isReconnecting?: boolean;
    // Platform gradient props
    platformGradient?: string;
}

export function ContextCard({
    icon: Icon,
    label,
    value,
    enabled,
    onToggle,
    toggleDisabled,
    onClear,
    clearDisabled,
    helper,
    className,
    variant = 'default',
    personaAvatarUrl,
    accountHandle,
    accountPlatform,
    accountAvatarUrl,
    isValid,
    onReconnect,
    isReconnecting,
    platformGradient,
}: ContextCardProps) {
    if (variant === 'persona') {
        return (
            <div
                className={cn(
                    "rounded-2xl border shadow-md p-4 transition-colors relative overflow-hidden",
                    platformGradient ? "text-white" : "text-card-foreground",
                    platformGradient || "bg-card border-primary/70 shadow-lg",
                    className
                )}
            >
                <div className="flex items-start gap-3">
                    <Avatar className={cn(
                        "h-10 w-10 shadow-sm",
                        platformGradient ? "bg-white/20 border-2 border-white/30" : "bg-background",
                        !platformGradient && (isValid ? "border-2 border-emerald-500" : "border border-border")
                    )}>
                        <AvatarImage src={personaAvatarUrl || ''} alt={value || ''} />
                        <AvatarFallback className={cn(
                            "text-sm font-semibold",
                            platformGradient ? "text-white" : "text-foreground"
                        )}>
                            {value?.charAt(0) || "P"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <p className={cn(
                                    "text-sm font-semibold",
                                    platformGradient ? "text-white" : "text-foreground"
                                )}>{label}</p>
                                <p className={cn(
                                    "text-xs break-words",
                                    platformGradient ? "text-white/80" : "text-muted-foreground"
                                )}>{value}</p>
                                {accountHandle && accountPlatform && (
                                    <p className={cn(
                                        "text-xs capitalize",
                                        platformGradient ? "text-white/70" : "text-muted-foreground"
                                    )}>
                                        @{accountHandle} · {accountPlatform}
                                    </p>
                                )}
                            </div>
                            <div className={cn(
                                "h-2 w-2 rounded-full",
                                enabled ? "bg-emerald-400" : "bg-red-400"
                            )} />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                                {isValid === false && (
                                    <div className={cn(
                                        "flex items-center gap-1",
                                        platformGradient ? "text-white/90" : "text-destructive"
                                    )}>
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Not Authenticated</span>
                                    </div>
                                )}
                                {isValid && (
                                    <div className={cn(
                                        "flex items-center gap-1",
                                        platformGradient ? "text-white/90" : "text-emerald-600"
                                    )}>
                                        <span>Authenticated</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {isValid === false && onReconnect && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={onReconnect}
                                        disabled={isReconnecting}
                                    >
                                        <RefreshCw className={cn("h-3 w-3", isReconnecting && "animate-spin")} />
                                        {isReconnecting ? "..." : "Fix"}
                                    </Button>
                                )}
                                {onClear && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={onClear}
                                        disabled={clearDisabled}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {helper && (
                            <p className={cn(
                                "text-[11px]",
                                platformGradient ? "text-white/70" : "text-muted-foreground"
                            )}>{helper}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-2xl border bg-card text-card-foreground shadow-md p-4 transition-colors min-h-[160px]",
                enabled ? "border-primary/60 shadow-sm" : "border-border",
                className
            )}
        >
            <div className="flex items-start gap-3">
                <span className="mt-1 rounded-md bg-muted p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground break-words">{value}</p>
                        </div>
                        <div className={cn(
                            "h-2 w-2 rounded-full",
                            enabled ? "bg-emerald-500" : "bg-red-500"
                        )} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <label className="flex items-center gap-2 font-medium text-foreground">
                            <Checkbox
                                checked={enabled}
                                onCheckedChange={(checked) => onToggle?.(checked === true)}
                                disabled={toggleDisabled}
                                className="h-3.5 w-3.5"
                                aria-label={`Toggle ${label}`}
                            />
                            Enable
                        </label>
                        {onClear && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={onClear}
                                disabled={clearDisabled}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
                </div>
            </div>
        </div>
    );
}
