import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { usePersonaContextStore } from "@/store/persona-context"
import { GraphRagActionCard, GraphRagSuggestionResponse, useGraphRagSuggestionsStreamApiSseGraphRagSuggestionsStreamGet } from "@/lib/api/generated"

export interface CopilotProjection {
  roi: {
    memoryReuse: number
    savedMinutes: number
    automationRate: number
  } | null
  actionCard: GraphRagActionCard | null
}

function sanitizePayload(payload: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )
}

export function useGraphRagSuggestions() {
  const { personaId, personaAccountId, campaignId } = usePersonaContextStore()
  const [isExecuting, setIsExecuting] = useState(false)

  const { data: suggestions, isLoading, error } = useGraphRagSuggestionsStreamApiSseGraphRagSuggestionsStreamGet<GraphRagSuggestionResponse>(
    personaId ? {
      persona_id: personaId,
      persona_account_id: personaAccountId,
      campaign_id: campaignId,
    } : undefined,
    {
      query: {
        enabled: Boolean(personaId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    }
  )

  const projection: CopilotProjection = useMemo(() => {
    if (!suggestions || !suggestions.cards) {
      return { roi: null, actionCard: null }
    }
    const roiCard = suggestions.cards.find(
      (card: GraphRagActionCard) => card.category === "persona" && card.meta?.kind === "roi"
    )
    const primaryAction = suggestions.cards
      .filter((card: GraphRagActionCard) => Boolean(card.flow_path))
      .sort((a: GraphRagActionCard, b: GraphRagActionCard) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null

    return {
      roi: roiCard
        ? {
            memoryReuse: Number(roiCard.meta?.memory_reuse_count) || 0,
            savedMinutes: Number(roiCard.meta?.saved_minutes) || 0,
            automationRate: Number(roiCard.meta?.ai_intervention_rate) || 0,
          }
        : null,
      actionCard: primaryAction,
    }
  }, [suggestions])

  const executePrimaryAction = useCallback(async () => {
    const card = projection.actionCard
    if (!card) {
      toast.error("No actionable suggestion available")
      return
    }
    if (!card.flow_path) {
      toast.error("Action endpoint missing for this suggestion")
      return
    }
    setIsExecuting(true)
    try {
      const response = await fetch(`/api/orchestrator${card.flow_path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(sanitizePayload(card.operator_payload)),
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || "Failed to execute action")
      }
      toast.success(card.cta_label ?? "Action executed")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to execute Graph RAG action")
    } finally {
      setIsExecuting(false)
    }
  }, [projection.actionCard])

  return {
    suggestions,
    projection,
    isConnected: !isLoading,
    error: error ? String(error) : null,
    executePrimaryAction,
    isExecuting,
    hasPersona: Boolean(personaId),
  }
}
