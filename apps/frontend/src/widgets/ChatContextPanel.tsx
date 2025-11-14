import { PersonaAccountContext } from "./PersonaAccountContext";
import { CopilotCard } from "./CopilotCard";

interface ChatContextPanelProps {
    onSelectCampaign?: () => void;
    onSelectDraft?: () => void;
    onExecuteAction?: () => void;
}

export function ChatContextPanel({
    onSelectCampaign,
    onSelectDraft,
    onExecuteAction
}: ChatContextPanelProps) {

    return (
        <aside className="bg-card border-l px-3 py-4 h-screen hidden lg:block max-w-[280px]">
            <div className="space-y-6">
                <PersonaAccountContext
                    onSelectCampaign={onSelectCampaign}
                    onSelectDraft={onSelectDraft}
                />

                <CopilotCard onExecute={onExecuteAction} />
            </div>
        </aside>
    );
}
