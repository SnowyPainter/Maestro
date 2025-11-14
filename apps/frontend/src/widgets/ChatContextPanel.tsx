import { PersonaAccountContext } from "./PersonaAccountContext"
import { CopilotCard, CopilotCardData } from "./CopilotCard"
import { useGraphRagSuggestions } from "./useGraphRagSuggestions"

interface ChatContextPanelProps {
  onSelectCampaign?: () => void
  onSelectDraft?: () => void
  onExecuteAction?: () => void
}

export function ChatContextPanel({
  onSelectCampaign,
  onSelectDraft,
  onExecuteAction,
}: ChatContextPanelProps) {
  const { projection, executePrimaryAction, isExecuting, isConnected, hasPersona } = useGraphRagSuggestions()

  const copilotData: CopilotCardData | null = projection.roi || projection.actionCard
    ? {
        roi: projection.roi,
        currentTask: projection.actionCard
          ? {
              title: projection.actionCard.title,
              description: projection.actionCard.description ?? "",
              ctaLabel: projection.actionCard.cta_label ?? "Execute Action",
            }
          : null,
      }
    : null

  const handleExecute = projection.actionCard ? executePrimaryAction : onExecuteAction

  return (
    <aside className="bg-card border-l px-3 py-4 h-screen hidden lg:block max-w-[280px]">
      <div className="space-y-6">
        <PersonaAccountContext onSelectCampaign={onSelectCampaign} onSelectDraft={onSelectDraft} />

        <CopilotCard
          data={copilotData}
          onExecute={handleExecute}
          isLoading={hasPersona && !isConnected}
          isExecuting={isExecuting}
        />
      </div>
    </aside>
  )
}
