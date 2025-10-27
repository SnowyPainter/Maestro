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
import { FileText, RefreshCw, StickyNote, Target, X, AlertTriangle, ChevronLeft, ChevronRight, User } from "lucide-react";
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
            <div className="mt-2 space-y-4">
                {isLoading ? (
                    <div className="rounded-2xl border bg-card shadow-md p-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <ContextCard
                            icon={User}
                            label="Persona Account"
                            value={personaName || "Unknown"}
                            enabled={true}
                            toggleDisabled={true}
                            clearDisabled={true}
                            variant="persona"
                            personaAvatarUrl={personaAvatarUrl || undefined}
                            accountHandle={accountHandle || undefined}
                            accountPlatform={accountPlatform ? formatPlatformName(accountPlatform) : undefined}
                            isValid={isValidOut?.is_valid}
                            onReconnect={handleReconnect}
                            isReconnecting={isReconnecting}
                            helper={isError ? "Could not confirm account status. You can still manage the context below." : "Your active persona account context"}
                        />
                        {contextTiles.length > 0 && (
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
                                            <ContextCard {...tile} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
