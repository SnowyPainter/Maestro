import { useCallback, useState, useEffect } from "react";
import { usePersonaContextStore } from "@/store/persona-context";
import { useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet, oauthStartApiOrchestratorAuthOauthPlatformStartGet } from "@/lib/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


type OAuthStartResponse = {
    authorize_url: string;
    state: string;
    callback_url: string;
};


export function PersonaAccountContext() {
    const {
        personaAccountId,
        personaName,
        accountId,
        accountHandle,
        accountPlatform,
        accountAvatarUrl,
        clearPersonaContext,
        setPersonaContext
    } = usePersonaContextStore();

    const [isReconnecting, setIsReconnecting] = useState(false);

    const hasPersona = personaAccountId !== null;

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
            <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm relative group">
                {isLoading ? (
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                ) : isError ? (
                     <div className="text-destructive text-xs flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Could not load account status.
                     </div>
                ) : (
                    <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                            <Avatar className={cn(
                                "w-10 h-10 border-2",
                                isValidOut?.is_valid ? "border-green-500" : "border-red-500"
                            )}>
                                <AvatarImage src={accountAvatarUrl || ''} alt={accountHandle || ''} />
                                <AvatarFallback className="text-xs">{accountHandle?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{personaName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                                @{accountHandle} · {accountPlatform}
                            </p>
                            {!isValidOut?.is_valid && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="mt-2 h-7 text-xs"
                                    onClick={handleReconnect}
                                    disabled={isReconnecting}
                                >
                                    <RefreshCw className={cn("h-3 w-3 mr-1.5", isReconnecting && "animate-spin")}
                                    />
                                    {isReconnecting ? "Redirecting..." : "Reconnect"}
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                            onClick={handleClearPersona}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
