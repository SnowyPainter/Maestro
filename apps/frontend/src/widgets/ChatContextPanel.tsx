import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PersonaAccountContext } from "./PersonaAccountContext";

interface FlowInfo {
    title?: string;
    description?: string;
    method?: string;
    path?: string;
}

export function ChatContextPanel({ flows }: { flows?: FlowInfo[] }) {

    return (
        <aside className="bg-card border-l p-4 h-screen hidden lg:block">
            <h2 className="text-lg font-semibold mb-4">Context</h2>
            <div className="space-y-6">
                <PersonaAccountContext />

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="flows">
                        <AccordionTrigger className="text-sm font-semibold">Available Flows</AccordionTrigger>
                        <AccordionContent>
                            <div className="overflow-y-auto space-y-2 mt-2 max-h-[300px] pr-1 no-scrollbar">
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
