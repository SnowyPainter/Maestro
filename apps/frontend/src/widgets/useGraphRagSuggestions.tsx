import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api/fetcher"
import { GraphRagActionCard, GraphRagSuggestionResponse, GraphRagSuggestPayload, GraphRagActionAck, graphRagSuggestApiOrchestratorGraphRagSuggestPost } from "@/lib/api/generated"
import { usePersonaContextStore } from "@/store/persona-context"
import { useSessionStore } from "@/store/session"

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api"
const STREAM_PATH = "/sse/graph-rag/suggestions/stream"

export interface CopilotProjection {
  roi: {
    memoryReuse: number
    savedMinutes: number
    automationRate: number
  } | null
  primaryAction: GraphRagActionCard | null
  actionCards: GraphRagActionCard[]
}

const joinBaseAndPath = (base: string, path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
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

export function useGraphRagSuggestions(options: UseGraphRagSuggestionsOptions = {}) {
  const { onActionResult } = options
  const { personaId, personaAccountId, campaignId } = usePersonaContextStore()
  const token = useSessionStore((state) => state.token)

  const [suggestions, setSuggestions] = useState<GraphRagSuggestionResponse | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const controllerRef = useRef<AbortController | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildSuggestPayload = useCallback((): GraphRagSuggestPayload => {
    return {
      persona_id: personaId ?? undefined,
      persona_account_id: personaAccountId ?? undefined,
      campaign_id: campaignId ?? undefined,
      limit: 8,
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
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch Graph RAG snapshot", err)
      setError(err?.data?.detail || err?.message || "Failed to fetch suggestions")
    }
  }, [personaId, token, buildSuggestPayload])

  useEffect(() => {
    if (!personaId) {
      controllerRef.current?.abort()
      controllerRef.current = null
      setSuggestions(null)
      setIsConnected(false)
      setError(null)
      return
    }

    if (!token) {
      setError("Not authenticated")
      setSuggestions(null)
      setIsConnected(false)
      return
    }

    let isActive = true

    fetchSnapshot()

    const streamUrl =
      joinBaseAndPath(API_BASE, STREAM_PATH) +
      buildQueryString({
        persona_id: personaId,
        persona_account_id: personaAccountId || undefined,
        campaign_id: campaignId || undefined,
      })

    const connect = async () => {
      const controller = new AbortController()
      controllerRef.current = controller
      setError(null)

      const headers = new Headers()
      headers.set("Accept", "text/event-stream")
      headers.set("Cache-Control", "no-cache")
      headers.set("X-Request-ID", crypto.randomUUID())
      if (token) {
        headers.set("Authorization", `Bearer ${token}`)
      }

      try {
        const response = await fetch(streamUrl, {
          method: "GET",
          headers,
          credentials: "include",
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed (${response.status})`)
        }

        setIsConnected(true)
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        const dispatchEvent = (eventName: string, payload: string) => {
          if (!payload) return
          if (eventName && eventName !== "graph_rag.suggestion" && eventName !== "message") {
            return
          }
          try {
            const parsed: GraphRagSuggestionResponse = JSON.parse(payload)
            setSuggestions(parsed)
          } catch (err) {
            console.error("Failed to parse Graph RAG SSE payload", err)
          }
        }

        const processBuffer = () => {
          while (true) {
            const delimiterIndex = buffer.indexOf("\n\n")
            if (delimiterIndex === -1) {
              break
            }
            const rawEvent = buffer.slice(0, delimiterIndex)
            buffer = buffer.slice(delimiterIndex + 2)

            let eventName = ""
            const dataLines: string[] = []

            rawEvent.split(/\r?\n/).forEach((line) => {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim()
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trim())
              }
            })

            const data = dataLines.join("\n")
            dispatchEvent(eventName, data)
          }
        }

        while (isActive) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }
          buffer += decoder.decode(value, { stream: true })
          processBuffer()
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.error("Graph RAG SSE error", err)
          setError(err?.message ?? "Failed to connect")
          // fallback to snapshot when SSE handshake fails
          fetchSnapshot()
        }
      } finally {
        setIsConnected(false)
        if (isActive && !controller.signal.aborted) {
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      isActive = false
      controllerRef.current?.abort()
      controllerRef.current = null
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }
  }, [personaId, personaAccountId, campaignId, token, fetchSnapshot, buildSuggestPayload])

  const projection: CopilotProjection = useMemo(() => {
    if (!suggestions || !suggestions.cards) {
      return { roi: null, primaryAction: null, actionCards: [] }
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

    return {
      roi: roiMetrics,
      primaryAction: actionCards[0] ?? null,
      actionCards,
    }
  }, [suggestions])

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
    [projection.primaryAction],
  )

  const executePrimaryAction = useCallback(() => executeAction(), [executeAction])

  return {
    suggestions,
    projection,
    isConnected,
    error,
    executePrimaryAction,
    executeAction,
    isExecuting,
    hasPersona: Boolean(personaId),
  }
}
