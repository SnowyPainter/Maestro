import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FileText, Target, User } from "lucide-react"

import { ContextCard } from "@/features/contexts/ContextCard"
import { Skeleton } from "@/components/ui/skeleton"
import {
    oauthStartApiOrchestratorAuthOauthPlatformStartGet,
    useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet,
} from "@/lib/api/generated"
import { usePersonaContextStore } from "@/store/persona-context"

const formatPlatformName = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case "instagram":
      return "Instagram"
    case "threads":
      return "Threads"
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1)
  }
}

interface PersonaAccountContextProps {
    onSelectCampaign?: () => void
    onSelectDraft?: () => void
}

export function PersonaAccountContext({
    onSelectCampaign,
    onSelectDraft,
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
    } = usePersonaContextStore()

    const [isReconnecting, setIsReconnecting] = useState(false)

    const hasPersona = personaAccountId !== null

    const contextTiles = useMemo(
        () => [
            {
                key: "campaign",
                icon: Target,
                label: "Campaign",
                value: campaignId ? `Campaign ID ${campaignId}` : "No campaign selected",
                enabled: Boolean(campaignEnabled && campaignId !== null),
                onToggle: (checked: boolean) => setCampaignEnabled(checked),
                toggleDisabled: campaignId === null,
                onClear: clearCampaignContext,
                clearDisabled: campaignId === null,
                onClick: onSelectCampaign,
                registryKeys: ["campaign_id"],
            },
            {
                key: "draft",
                icon: FileText,
                label: "Draft",
                value: draftId ? `Draft ID ${draftId}` : "No draft selected",
                enabled: Boolean(draftEnabled && draftId !== null),
                onToggle: (checked: boolean) => setDraftEnabled(checked),
                toggleDisabled: draftId === null,
                onClear: clearDraftContext,
                clearDisabled: draftId === null,
                onClick: onSelectDraft,
                registryKeys: ["draft_id"],
            },
        ],
        [
            campaignId,
            campaignEnabled,
            setCampaignEnabled,
            clearCampaignContext,
            onSelectCampaign,
            draftId,
            draftEnabled,
            setDraftEnabled,
            clearDraftContext,
            onSelectDraft,
        ],
    )

    const shouldCheckValidity = hasPersona && accountId !== null
    const { data: isValidOut, isLoading } =
        useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet(
            accountId || 0,
            { query: { enabled: shouldCheckValidity } },
        )

    useEffect(() => {
        const shouldRefetch = sessionStorage.getItem("personaAccountRefetch")
        if (shouldRefetch) {
            sessionStorage.removeItem("personaAccountRefetch")
            clearPersonaContext()
            window.location.reload()
        }
    }, [clearPersonaContext])

    const handleClearPersona = useCallback(() => {
        clearPersonaContext()
    }, [clearPersonaContext])

    const handleReconnect = useCallback(async () => {
        if (!accountPlatform) {
            toast.error("Missing account platform context")
            return
        }

        setIsReconnecting(true)
        const returnUrl = window.location.href

        try {
            const response = await oauthStartApiOrchestratorAuthOauthPlatformStartGet(accountPlatform as any, {
                return_url: returnUrl,
            })

            if (!response?.authorize_url) {
                toast.error("Failed to initiate OAuth flow")
                return
            }

            sessionStorage.setItem("personaAccountRefetch", "true")
            window.location.href = response.authorize_url
        } catch (error: any) {
            const message = error?.data?.detail || error?.message || "OAuth start failed"
            toast.error(message)
        } finally {
            setIsReconnecting(false)
        }
    }, [accountPlatform])

    if (!hasPersona) {
        return (
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Persona Account</p>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <p className="text-center text-muted-foreground">No persona selected</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Persona Account</p>
            <div className="space-y-1.5">
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
                    <ContextCard
                        icon={User}
                        variant="persona"
                        label={personaName ?? "Persona"}
                        value={personaName ?? "Persona"}
                        enabled
                        personaAvatarUrl={personaAvatarUrl ?? undefined}
                        accountHandle={accountHandle ?? undefined}
                        accountPlatform={accountPlatform ? formatPlatformName(accountPlatform) : undefined}
                        accountAvatarUrl={accountAvatarUrl ?? undefined}
                        isValid={isValidOut?.is_valid ?? undefined}
                        onReconnect={isValidOut?.is_valid === false ? handleReconnect : undefined}
                        isReconnecting={isReconnecting}
                        onClear={handleClearPersona}
                        registryKeys={["persona_id", "persona_account_id", "account_persona_id"]}
                    />
                )}

                <div className="grid grid-cols-2 gap-1.5">
                    {contextTiles.map((tile) => (
                        <ContextCard
                            key={tile.key}
                            icon={tile.icon}
                            label={tile.label}
                            value={tile.value}
                            enabled={tile.enabled}
                            onToggle={tile.onToggle}
                            toggleDisabled={tile.toggleDisabled}
                            onClear={tile.onClear}
                            clearDisabled={tile.clearDisabled}
                            onClick={tile.onClick}
                            registryKeys={tile.registryKeys}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
