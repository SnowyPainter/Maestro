import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePersonaContextStore } from "@/store/persona-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlowInfo {
    title?: string;
    description?: string;
    method?: string;
    path?: string;
}

export function ChatContextPanel({ flows }: { flows?: FlowInfo[] }) {
    const personaAccountId = usePersonaContextStore(state => state.personaAccountId);
    const personaName = usePersonaContextStore(state => state.personaName);
    const accountHandle = usePersonaContextStore(state => state.accountHandle);
    const accountPlatform = usePersonaContextStore(state => state.accountPlatform);
    const accountAvatarUrl = usePersonaContextStore(state => state.accountAvatarUrl);
    const clearPersonaContext = usePersonaContextStore(state => state.clearPersonaContext);

    const hasPersona = personaAccountId !== null;

    const handleClearPersona = () => {
        clearPersonaContext();
    };

    return (
        <aside className="bg-card border-l p-4 h-screen hidden lg:block">
            <h2 className="text-lg font-semibold mb-4">Context</h2>
            <div className="space-y-6">
                <section>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Persona Account</h3>
                    <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm relative group">
                        {hasPersona ? (
                            <div className="flex items-start gap-3">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                    <AvatarImage src={accountAvatarUrl || ''} alt={accountHandle || ''} />
                                    <AvatarFallback className="text-xs">{accountHandle?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-sm">{personaName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        @{accountHandle}
                                        {accountPlatform ? ` · ${accountPlatform}` : ""}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ID: <span className="font-mono text-foreground">{personaAccountId}</span>
                                    </p>
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
                        ) : (
                            <p className="text-xs text-muted-foreground">No persona account injected yet.</p>
                        )}
                    </div>
                </section>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="flows">
                        <AccordionTrigger className="text-sm font-semibold">Available Flows</AccordionTrigger>
                        <AccordionContent>
                            <div className="overflow-y-auto space-y-2 mt-2 max-h-[calc(100vh-16rem)] pr-1 no-scrollbar">
                                {flows?.map((flow, index) => (
                                    <div key={index} className="p-3 bg-muted/50 rounded-lg border break-words">
                                        <h3 className="font-medium text-sm leading-tight">{flow.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                                            {flow.description}
                                        </p>
                                        <div className="flex gap-1 mt-2 flex-wrap">
                                            {flow.method && (
                                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded whitespace-nowrap">
                                                    {flow.method}
                                                </span>
                                            )}
                                            {flow.path && (
                                                <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded break-all">
                                                    {flow.path}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!flows?.length && (
                                    <p className="text-sm text-muted-foreground">No flows available</p>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </aside>
    );
}
