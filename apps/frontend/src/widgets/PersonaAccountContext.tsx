import { useCallback, useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { usePersonaContextStore } from "@/store/persona-context";
import {
    useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet,
    oauthStartApiOrchestratorAuthOauthPlatformStartGet,
} from "@/lib/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FileText, RefreshCw, StickyNote, Target, X, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface ContextTileProps {
    icon: LucideIcon;
    label: string;
    value: string;
    enabled: boolean;
    onToggle?: (checked: boolean) => void;
    toggleDisabled?: boolean;
    onClear?: () => void;
    clearDisabled?: boolean;
    helper?: string;
}

function ContextTile({
    icon: Icon,
    label,
    value,
    enabled,
    onToggle,
    toggleDisabled,
    onClear,
    clearDisabled,
    helper,
}: ContextTileProps) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-background/80 p-3 transition-colors min-h-[160px]",
                enabled ? "border-primary/60 shadow-sm" : "border-border"
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
export function PersonaAccountContext() {
    const {
        personaAccountId,
        personaName,
        personaAvatarUrl,
        accountId,
        accountHandle,
        accountPlatform,
        accountAvatarUrl,
        clearPersonaContext,
        draftId,
        draftEnabled,
        setDraftEnabled,
        clearDraftContext,
        campaignId,
        campaignEnabled,
        setCampaignEnabled,
        clearCampaignContext,
        userMemo,
        userMemoEnabled,
        setUserMemoEnabled,
        clearUserMemo,
    } = usePersonaContextStore();

    const [isReconnecting, setIsReconnecting] = useState(false);
    const [currentContextIndex, setCurrentContextIndex] = useState(0);

    const hasPersona = personaAccountId !== null;

    const contextTiles = [
        {
            icon: FileText,
            label: "Draft",
            value: draftId ? `Draft ID ${draftId}` : "No draft selected",
            enabled: draftEnabled && draftId !== null,
            onToggle: setDraftEnabled,
            toggleDisabled: draftId === null,
            onClear: clearDraftContext,
            clearDisabled: draftId === null,
            helper: draftId === null ? "Select a draft in the composer to link it here." : "Include the draft when sending requests.",
        },
        {
            icon: Target,
            label: "Campaign",
            value: campaignId ? `Campaign ID ${campaignId}` : "No campaign selected",
            enabled: campaignEnabled && campaignId !== null,
            onToggle: setCampaignEnabled,
            toggleDisabled: campaignId === null,
            onClear: clearCampaignContext,
            clearDisabled: campaignId === null,
            helper: campaignId === null ? "Choose a campaign to make it available." : "Attach the campaign context to outgoing calls.",
        },
        {
            icon: StickyNote,
            label: "User memo",
            value: userMemo ? (userMemo.length > 200 ? `${userMemo.slice(0, 197)}...` : userMemo) : "No memo saved",
            enabled: userMemoEnabled && Boolean(userMemo),
            onToggle: setUserMemoEnabled,
            toggleDisabled: !userMemo,
            onClear: clearUserMemo,
            clearDisabled: !userMemo,
            helper: userMemo ? "Share this memo with the assistant when enabled." : "Add a memo to enable this context.",
        },
    ];

    const nextContext = () => {
        setCurrentContextIndex((prev) => (prev + 1) % contextTiles.length);
    };

    const prevContext = () => {
        setCurrentContextIndex((prev) => (prev - 1 + contextTiles.length) % contextTiles.length);
    };

    // Only enable the query when we have all required data
    const shouldCheckValidity = hasPersona && accountId !== null;
    const { data: isValidOut, isLoading, isError } = useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet(
        accountId || 0, // Use 0 as fallback since accountId can be null, but query will be disabled
        { query: { enabled: shouldCheckValidity } }
    );

    // Clear store and reload after OAuth callback
    useEffect(() => {
        const shouldRefetch = sessionStorage.getItem('personaAccountRefetch');
        if (shouldRefetch) {
            sessionStorage.removeItem('personaAccountRefetch');
            // Clear the store to force reload of latest data
            clearPersonaContext();
            // Optionally reload the page to ensure all components get fresh data
            window.location.reload();
        }
    }, [clearPersonaContext]);

    const handleClearPersona = () => {
        clearPersonaContext();
    };

    const handleReconnect = useCallback(async () => {
        if (!accountPlatform) {
            toast.error("Missing account platform context");
            return;
        }

        setIsReconnecting(true);
        const returnUrl = window.location.href;

        try {
            const response = await oauthStartApiOrchestratorAuthOauthPlatformStartGet(accountPlatform as any, { return_url: returnUrl });

            if (!response?.authorize_url) {
                toast.error("Failed to initiate OAuth flow");
                return;
            }

            // Store refetch function to call after OAuth callback
            sessionStorage.setItem('personaAccountRefetch', 'true');
            window.location.href = response.authorize_url;
        } catch (error: any) {
            const message = error?.data?.detail || error?.message || "OAuth start failed";
            toast.error(message);
        } finally {
            setIsReconnecting(false);
        }
    }, [accountPlatform]);

    if (!hasPersona) {
        return (
            <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Persona Account</h3>
                <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="text-xs text-muted-foreground p-2 text-center">No persona account selected.</p>
                </div>
            </section>
        );
    }

    return (
        <section>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Persona Account</h3>
            <div className="mt-2 rounded-xl border bg-muted/40 p-4 text-sm relative overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {isError && (
                            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                Could not confirm account status. You can still manage the context below.
                            </div>
                        )}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <Avatar className={cn(
                                    "h-12 w-12 bg-background shadow-sm",
                                    isValidOut?.is_valid ? "border-2 border-emerald-500" : "border border-border"
                                )}>
                                    <AvatarImage src={personaAvatarUrl || ''} alt={personaName || ''} />
                                    <AvatarFallback className="text-sm font-semibold">
                                        {personaName?.charAt(0) || "P"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-2">
                                    <div>
                                        <p className="font-semibold text-foreground">{personaName}</p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            @{accountHandle} · {accountPlatform}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                                <div className="flex items-center gap-2">
                                    {!isValidOut?.is_valid && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={handleReconnect}
                                            disabled={isReconnecting}
                                        >
                                            <RefreshCw className={cn("h-3.5 w-3.5", isReconnecting && "animate-spin")} />
                                            {isReconnecting ? "Redirecting" : "Reconnect"}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={handleClearPersona}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attached Contexts</p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={prevContext}
                                        disabled={contextTiles.length <= 1}
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                    <span className="text-xs text-muted-foreground min-w-[3ch] text-center">
                                        {currentContextIndex + 1}/{contextTiles.length}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={nextContext}
                                        disabled={contextTiles.length <= 1}
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="relative">
                                {contextTiles.map((tile, index) => (
                                    <div
                                        key={tile.label}
                                        className={cn(
                                            "transition-opacity duration-200",
                                            index === currentContextIndex ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
                                        )}
                                    >
                                        <ContextTile {...tile} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
