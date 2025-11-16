import { useCallback } from "react"

import { GraphRagActionCard } from "@/lib/api/generated"

import { PersonaAccountContext } from "./PersonaAccountContext"
import { CopilotCard } from "./CopilotCard"
import { useGraphRagSuggestions } from "./useGraphRagSuggestions"

import { GraphRagActionAck } from "@/lib/api/generated"

interface ChatContextPanelProps {
  onSelectCampaign?: () => void
  onSelectDraft?: () => void
  onExecuteAction?: () => void
  onActionResult?: (result: GraphRagActionAck) => void
}

export function ChatContextPanel({
  onSelectCampaign,
  onSelectDraft,
  onExecuteAction,
  onActionResult,
}: ChatContextPanelProps) {
  const {
    projection,
    executeAction,
    isExecuting,
    isConnected,
    hasPersona,
  } = useGraphRagSuggestions({
    onActionResult: onActionResult,
  })

  const handleExecute = useCallback(
    (card?: GraphRagActionCard | null) => {
      if (projection.actionCards.length) {
        executeAction(card)
      } else if (onExecuteAction) {
        onExecuteAction()
      }
    },
    [projection.actionCards.length, executeAction, onExecuteAction],
  )

  return (
    <aside className="bg-card border-l px-3 py-4 h-screen hidden lg:block max-w-[280px]">
      <div className="space-y-6">
        <PersonaAccountContext onSelectCampaign={onSelectCampaign} onSelectDraft={onSelectDraft} />

        <CopilotCard
          roi={projection.roi}
          actions={projection.actionCards}
          actionGroups={projection.groups}
          summary={projection.summary}
          personaName={projection.personaName}
          campaignName={projection.campaignName}
          updatedAt={projection.updatedAt}
          isLive={isConnected}
          onExecute={handleExecute}
          isLoading={hasPersona && !isConnected && !projection.actionCards.length}
          isExecuting={isExecuting}
        />
      </div>
    </aside>
  )
}
