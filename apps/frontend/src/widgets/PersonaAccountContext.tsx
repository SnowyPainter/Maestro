import { useCallback, useState, useEffect } from "react";
import { usePersonaContextStore } from "@/store/persona-context";
import {
    useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet,
    oauthStartApiOrchestratorAuthOauthPlatformStartGet,
} from "@/lib/api/generated";
import { ContextCard } from "@/features/contexts/ContextCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FileText, RefreshCw, Target, X, AlertTriangle, ChevronLeft, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";

// 플랫폼 이름을 사람이 읽기 쉬운 형태로 변환
function formatPlatformName(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return 'Instagram';
    case 'threads':
      return 'Threads';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}

interface PersonaAccountContextProps {
    onSelectCampaign?: () => void;
    onSelectDraft?: () => void;
}

export function PersonaAccountContext({
    onSelectCampaign,
    onSelectDraft
}: PersonaAccountContextProps = {}) {
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
    } = usePersonaContextStore();

    const [isReconnecting, setIsReconnecting] = useState(false);
    const [currentContextIndex, setCurrentContextIndex] = useState(0);

    const hasPersona = personaAccountId !== null;

    const contextTiles = [
        {
            icon: Target,
            label: "Campaign",
            value: campaignId ? `Campaign ID ${campaignId}` : "No campaign selected",
            enabled: campaignEnabled && campaignId !== null,
            onToggle: setCampaignEnabled,
            toggleDisabled: campaignId === null,
            onClear: clearCampaignContext,
            clearDisabled: campaignId === null,
            onClick: onSelectCampaign,
            helper: campaignId === null ? "Choose a campaign to make it available." : "Attach the campaign context to outgoing calls.",
        },
        {
            icon: FileText,
            label: "Draft",
            value: draftId ? `Draft ID ${draftId}` : "No draft selected",
            enabled: draftEnabled && draftId !== null,
            onToggle: setDraftEnabled,
            toggleDisabled: draftId === null,
            onClear: clearDraftContext,
            clearDisabled: draftId === null,
            onClick: onSelectDraft,
            helper: draftId === null ? "Select a draft in the composer to link it here." : "Include the draft when sending requests.",
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
            <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                    Persona Account
                </p>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <p className="text-muted-foreground text-center">No persona selected</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Persona Account
            </p>
            <div className="space-y-2">
                {isLoading ? (
                    <div className="rounded-xl border bg-card p-3">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-2 w-24" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="rounded-xl border bg-card p-3">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={personaAvatarUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                        {personaName?.charAt(0) || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{personaName}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {accountHandle && `${accountHandle} • `}
                                        {accountPlatform && formatPlatformName(accountPlatform)}
                                    </p>
                                </div>
                                {!isValidOut?.is_valid && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={handleReconnect}
                                        disabled={isReconnecting}
                                    >
                                        <RefreshCw className={cn("h-3 w-3", isReconnecting && "animate-spin")} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {contextTiles.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                                    Contexts
                                </p>
                                <div className="space-y-1">
                                    {contextTiles.slice(0, 2).map((tile) => (
                                        <div
                                            key={tile.label}
                                            className="rounded-lg border bg-card/50 px-3 py-2 text-xs hover:bg-card cursor-pointer transition-colors"
                                            onClick={tile.onClick}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <tile.icon className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-medium">{tile.label}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {tile.enabled && (
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                    )}
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground truncate mt-0.5">
                                                {tile.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
