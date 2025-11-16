import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api/fetcher"
import {
  GraphRagActionCard,
  GraphRagSuggestionResponse,
  GraphRagSuggestPayload,
  GraphRagActionAck,
  graphRagSuggestApiOrchestratorGraphRagSuggestPost,
  bffPlaybookGetPlaybookDetailApiBffPlaybooksDetailGet,
} from "@/lib/api/generated"
import { usePersonaContextStore } from "@/store/persona-context"
import { useSessionStore } from "@/store/session"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api"
const WS_PATH = "/sse/graph-rag/suggestions/stream"

const parseBooleanFlag = (envValue: string | undefined, searchKey: string): boolean => {
  const normalized = (envValue ?? "").trim().toLowerCase()
  const envEnabled = normalized === "1" || normalized === "true"
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get(searchKey)
    if (fromQuery !== null) {
      const normalizedQuery = fromQuery.trim().toLowerCase()
      return normalizedQuery === "1" || normalizedQuery === "true"
    }
  }
  return envEnabled
}

const SSE_DEBUG_ENABLED = parseBooleanFlag(import.meta.env.VITE_GRAPH_RAG_SSE_DEBUG, "graphRagDebug")
const SSE_MOCK_ENABLED = parseBooleanFlag(import.meta.env.VITE_GRAPH_RAG_SSE_MOCK, "graphRagMock")

export interface CopilotProjection {
  roi: {
    memoryReuse: number
    savedMinutes: number
    automationRate: number
  } | null
  summary: string | null
  personaName: string | null
  campaignName: string | null
  updatedAt: string | null
  groups: CopilotActionGroup[]
  primaryAction: GraphRagActionCard | null
  actionCards: GraphRagActionCard[]
}

export interface CopilotActionGroup {
  key: string
  title: string
  helper?: string
  cards: GraphRagActionCard[]
}

const joinBaseAndPath = (base: string, path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

const buildWebSocketUrl = (baseUrl: string, query: string): string => {
  if (typeof window === "undefined") {
    return baseUrl
  }
  const absoluteBase = baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
    ? baseUrl
    : `${window.location.origin}${baseUrl.startsWith("/") ? "" : "/"}${baseUrl}`
  const url = new URL(absoluteBase)
  const trimmedQuery = query.startsWith("?") ? query.slice(1) : query
  if (trimmedQuery) {
    url.search = trimmedQuery
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

const buildQueryString = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    search.append(key, String(value))
  })
  const raw = search.toString()
  return raw ? `?${raw}` : ""
}

const sanitizePayload = (payload: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))

const numberFromMeta = (
  meta: GraphRagActionCard["meta"],
  key: string,
  fallback = 0,
): number => {
  if (!meta || typeof meta !== "object") {
    return fallback
  }
  const value = (meta as Record<string, unknown>)[key]
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}


interface UseGraphRagSuggestionsOptions {
  onActionResult?: (result: GraphRagActionAck) => void
}

interface GraphRagDebugEvent {
  kind: string
  ts?: string
  [key: string]: unknown
}

interface GraphRagMockEvent {
  kind: string
  counter: number
  ts?: string
  persona_id?: number | null
  campaign_id?: number | null
}

export function useGraphRagSuggestions(options: UseGraphRagSuggestionsOptions = {}) {
  const { onActionResult } = options
  const { personaId, personaAccountId, campaignId } = usePersonaContextStore()
  const setCampaignContext = usePersonaContextStore((state) => state.setCampaignContext)
  const token = useSessionStore((state) => state.token)

  const [suggestions, setSuggestions] = useState<GraphRagSuggestionResponse | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastDebugEvent, setLastDebugEvent] = useState<GraphRagDebugEvent | null>(null)
  const [lastMockEvent, setLastMockEvent] = useState<GraphRagMockEvent | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ensureCampaignContextForCard = useCallback(
    async (card?: GraphRagActionCard | null) => {
      if (!card) {
        return
      }

      const rawCampaignId =
        (card.operator_payload as { campaign_id?: number | string | null } | undefined)?.campaign_id ?? null
      const campaignFromPayload =
        typeof rawCampaignId === "number"
          ? rawCampaignId
          : typeof rawCampaignId === "string"
            ? Number(rawCampaignId)
            : null

      if (campaignFromPayload && !Number.isNaN(campaignFromPayload) && campaignFromPayload > 0) {
        setCampaignContext(campaignFromPayload)
        return
      }

      if (card.operator_key !== "graph_rag.actions.playbook_reapply") {
        return
      }

      const rawPlaybookId =
        (card.operator_payload as { playbook_id?: number | string | null } | undefined)?.playbook_id ?? null
      const playbookId =
        typeof rawPlaybookId === "number"
          ? rawPlaybookId
          : typeof rawPlaybookId === "string"
            ? Number(rawPlaybookId)
            : null

      if (!playbookId || Number.isNaN(playbookId) || playbookId <= 0) {
        return
      }

      try {
        const detail = await bffPlaybookGetPlaybookDetailApiBffPlaybooksDetailGet({
          playbook_id: playbookId,
          include_logs: false,
        })
        const campaignFromPlaybook = detail?.playbook?.campaign_id
        if (typeof campaignFromPlaybook === "number" && campaignFromPlaybook > 0) {
          setCampaignContext(campaignFromPlaybook)
        }
      } catch (error) {
        console.error("Failed to resolve campaign context for playbook reuse", error)
      }
    },
    [setCampaignContext],
  )

  const buildSuggestPayload = useCallback((): GraphRagSuggestPayload => {
    return {
      persona_id: personaId ?? undefined,
      persona_account_id: personaAccountId ?? undefined,
      campaign_id: campaignId ?? undefined,
      limit: 20,
      mode: "quickstart",
      include_quickstart: true,
      include_memory: true,
      include_next_actions: true,
      include_roi: true,
    }
  }, [personaId, personaAccountId, campaignId])

  const fetchSnapshot = useCallback(async () => {
    if (!personaId || !token) {
      return
    }
    try {
      const snapshot = await graphRagSuggestApiOrchestratorGraphRagSuggestPost(buildSuggestPayload())
      setSuggestions(snapshot)
      setLastUpdatedAt(snapshot.generated_at ?? new Date().toISOString())
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch Graph RAG snapshot", err)
      setError(err?.data?.detail || err?.message || "Failed to fetch suggestions")
    }
  }, [personaId, token, buildSuggestPayload])

  useEffect(() => {
    if (!personaId && !SSE_MOCK_ENABLED) {
      wsRef.current?.close()
      wsRef.current = null
      setSuggestions(null)
      setIsConnected(false)
      setError(null)
      setLastDebugEvent(null)
      setLastMockEvent(null)
      setLastUpdatedAt(null)
      return
    }

    if (!SSE_MOCK_ENABLED && !token) {
      setError("Not authenticated")
      setSuggestions(null)
      setIsConnected(false)
      return
    }

    setLastDebugEvent(null)
    setLastMockEvent(null)

    if (!SSE_MOCK_ENABLED) {
      fetchSnapshot()
    }

    const queryString = buildQueryString({
      persona_id: personaId || undefined,
      persona_account_id: personaAccountId || undefined,
      campaign_id: campaignId || undefined,
      debug: SSE_DEBUG_ENABLED ? "1" : undefined,
      mock: SSE_MOCK_ENABLED ? "1" : undefined,
      token: !SSE_MOCK_ENABLED ? token : undefined,
    })
    console.log("queryString", queryString, API_BASE, WS_PATH)
    const basePath = joinBaseAndPath(API_BASE, WS_PATH)
    const wsUrl = buildWebSocketUrl(basePath, queryString)
    let manualClose = false

    const connect = () => {
      if (!wsUrl) {
        setError("Invalid WebSocket URL")
        return
      }

      const socket = new WebSocket(wsUrl)
      wsRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          const { type, data } = parsed
          if (type === "graph_rag.debug") {
            setLastDebugEvent(data as GraphRagDebugEvent)
            if (SSE_DEBUG_ENABLED) {
              console.debug("[GraphRag WS][debug]", data)
            }
            return
          }
          if (type === "graph_rag.mock") {
            setLastMockEvent(data as GraphRagMockEvent)
            console.info("[GraphRag WS][mock]", data)
            return
          }
          if (type === "graph_rag.suggestion") {
            const suggestion = data as GraphRagSuggestionResponse
            setSuggestions(suggestion)
            setLastUpdatedAt(suggestion.generated_at ?? new Date().toISOString())
            console.info("[GraphRag WS][suggestion]", {
              cards: suggestion?.cards?.length ?? 0,
              roi: Boolean(suggestion?.roi),
              ts: new Date().toISOString(),
            })
          }
        } catch (err) {
          console.error("Failed to parse Graph RAG WebSocket payload", err)
        }
      }

      socket.onerror = (event) => {
        console.error("Graph RAG WebSocket error", event)
        setError("WebSocket connection error")
        if (!SSE_MOCK_ENABLED) {
          fetchSnapshot()
        }
      }

      socket.onclose = () => {
        setIsConnected(false)
        if (!manualClose) {
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      manualClose = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [personaId, personaAccountId, campaignId, token, fetchSnapshot])

  const projection: CopilotProjection = useMemo(() => {
    if (!suggestions || !suggestions.cards) {
      return {
        roi: null,
        summary: null,
        personaName: null,
        campaignName: null,
        updatedAt: lastUpdatedAt,
        groups: [],
        primaryAction: null,
        actionCards: [],
      }
    }

    const actionCards = suggestions.cards
      .filter((card) => Boolean(card.flow_path))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    let roiMetrics: { memoryReuse: number; savedMinutes: number; automationRate: number } | null = null

    if (suggestions.roi) {
      roiMetrics = {
        memoryReuse: suggestions.roi.memory_reuse_count ?? 0,
        savedMinutes: suggestions.roi.saved_minutes ?? 0,
        automationRate: suggestions.roi.ai_intervention_rate ?? 0,
      }
    } else {
      const roiCard = suggestions.cards.find(
        (card) => card.category === "persona" && card.meta?.kind === "roi"
      )
      if (roiCard) {
        roiMetrics = {
          memoryReuse: numberFromMeta(roiCard.meta, "memory_reuse_count"),
          savedMinutes: numberFromMeta(roiCard.meta, "saved_minutes"),
          automationRate: numberFromMeta(roiCard.meta, "ai_intervention_rate"),
        }
      }
    }

    const groupDefs: Array<{ key: CopilotActionGroup["key"]; title: string; helper?: string; match: (card: GraphRagActionCard) => boolean }> = [
      { key: "trend", title: "Trend-driven Next Actions", helper: "Use trending signals to draft", match: (card) => card.category === "trend" },
      { key: "draft", title: "Next Steps & Drafts", helper: "Operational next steps from graph", match: (card) => card.category === "draft" },
      { key: "playbook", title: "Memory & Playbooks", helper: "Reuse proven playbooks", match: (card) => card.category === "playbook" },
      { key: "persona", title: "Persona & Focus", helper: "Context and ROI reminders", match: (card) => card.category === "persona" },
    ]

    const groups: CopilotActionGroup[] = groupDefs
      .map((def) => ({
        key: def.key,
        title: def.title,
        helper: def.helper,
        cards: actionCards.filter(def.match),
      }))
      .filter((group) => group.cards.length > 0)

    const updatedAt = suggestions.generated_at ?? lastUpdatedAt
    const primaryAction = actionCards[0] ?? null
    const summary =
      primaryAction?.description ||
      primaryAction?.title ||
      actionCards.find((card) => Boolean(card.title))?.title ||
      null

    return {
      roi: roiMetrics,
      summary,
      personaName: suggestions.persona?.persona_name ?? null,
      campaignName: suggestions.persona?.campaign_name ?? null,
      updatedAt,
      groups,
      primaryAction,
      actionCards,
    }
  }, [suggestions, lastUpdatedAt])

  const executeAction = useCallback(
    async (card?: GraphRagActionCard | null) => {
      const target = card ?? projection.primaryAction
      if (!target) {
        toast.error("No actionable suggestion available")
        return
      }
      if (!target.flow_path) {
        toast.error("Action endpoint missing for this suggestion")
        return
      }

      setIsExecuting(true)
      try {
        await ensureCampaignContextForCard(target)
        const response = await apiFetch<GraphRagActionAck>({
          url: `/api/orchestrator${target.flow_path}`,
          method: "POST",
          data: sanitizePayload(target.operator_payload),
        })
        toast.success(target.cta_label ?? "Action executed")

        // Call the callback to handle the action result
        if (onActionResult) {
          onActionResult(response)
        }
      } catch (err: any) {
        console.error("Graph RAG action error:", err)
        toast.error(err?.data?.detail || err?.message || "Failed to execute Graph RAG action")
      } finally {
        setIsExecuting(false)
      }
    },
    [projection.primaryAction, ensureCampaignContextForCard, onActionResult],
  )

  const executePrimaryAction = useCallback(() => executeAction(), [executeAction])

  return {
    suggestions,
    projection,
    isConnected,
    error,
    lastDebugEvent,
    lastMockEvent,
    isDebugEnabled: SSE_DEBUG_ENABLED,
    isMockEnabled: SSE_MOCK_ENABLED,
    executePrimaryAction,
    executeAction,
    isExecuting,
    hasPersona: Boolean(personaId) || SSE_MOCK_ENABLED,
  }
}
