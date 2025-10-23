import { ScheduleListItem } from "@/lib/api/generated";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>;
    }

    if (typeof value === 'string') {
        return <span className="text-green-600">"{value}"</span>;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return <span className="text-blue-600">{String(value)}</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return (<span className="text-muted-foreground">[]</span>);
        }
        if (value.length === 1) {
            return (
                <span>
                    <span className="text-purple-600">[ </span>
                    {renderValue(value[0])}
                    <span className="text-purple-600"> ]</span>
                </span>
            );
        }
        return (<span className="text-purple-600">[{value.length} items]</span>);
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            return (<span className="text-muted-foreground">{"{}"}</span>);
        }
        if (entries.length === 1) {
            const [key, val] = entries[0];
            return (
                <span>
                    <span className="text-purple-600">{"{ "}</span>
                    <span className="text-muted-foreground">"{key}"</span>
                    <span className="text-muted-foreground">: </span>
                    {renderValue(val)}
                    <span className="text-purple-600">{" }"}</span>
                </span>
            );
        }
        return (<span className="text-purple-600">{"{"}{entries.length} keys{"}"}</span>);
    }

    return <span>{String(value)}</span>;
};

const KeyValueRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between items-start text-sm py-1.5 border-b border-border/50">
        <dt className="text-muted-foreground font-medium shrink-0 pr-4">{label}</dt>
        <dd className="text-right text-foreground break-words font-mono text-xs">
            {renderValue(value)}
        </dd>
    </div>
);

export const ScheduleMetaDetails = ({ meta, schedule }: { meta: any, schedule: ScheduleListItem }) => {
    if (!meta) return <p className="text-sm text-muted-foreground">No metadata available.</p>;

    const { label, dag_meta, context, payload } = meta;
    const { status, due_at, created_at, updated_at, last_error } = schedule;
    const dagResults = context?._dag?.results;

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div>
                <h4 className="font-semibold mb-2 text-foreground">Summary</h4>
                <dl className="space-y-1">
                    {label && <KeyValueRow label="Type" value={<Badge variant="outline">{label}</Badge>} />}
                    {dag_meta?.title && <KeyValueRow label="Title" value={dag_meta.title} />}
                    {dag_meta?.scheduled_for && <KeyValueRow label="Scheduled For" value={new Date(dag_meta.scheduled_for).toLocaleString()} />}
                </dl>
            </div>

            {/* Last Error */}
            {last_error && (
                <div>
                    <h4 className="font-semibold mb-2 text-foreground">Last Error</h4>
                    <p className="text-sm text-muted-foreground">{last_error}</p>
                </div>
            )}

            {/* Payload */}
            {payload && (
                <div>
                    <h4 className="font-semibold mb-2 text-foreground">Parameters</h4>
                    <dl className="space-y-1">
                        {Object.entries(payload).map(([key, value]) => (
                            <KeyValueRow key={key} label={key} value={String(value)} />
                        ))}
                    </dl>
                </div>
            )}

            {/* Context */}
            {context && (
                <div>
                    <h4 className="font-semibold mb-2 text-foreground">Context</h4>
                    <dl className="space-y-1">
                        {Object.entries(context).map(([key, value]) => (
                            <KeyValueRow key={key} label={key} value={String(value)} />
                        ))}
                    </dl>
                </div>
            )}

            {/* DAG Status */}
            {context?._dag && (
                 <div>
                    <h4 className="font-semibold mb-2 text-foreground">Automation Status</h4>
                    <dl className="space-y-1">
                        {context._dag.waiting_node && <KeyValueRow label="Current Step" value={<Badge variant="secondary">{context._dag.waiting_node}</Badge>} />}
                        {context._dag.resume_next && <KeyValueRow label="Next Step(s)" value={context._dag.resume_next.join(', ')} />}
                    </dl>
                </div>
            )}

            {/* Results */}
            {dagResults && Object.keys(dagResults).length > 0 && (
                 <div>
                    <h4 className="font-semibold mb-2 text-foreground">Step Results</h4>
                    <Accordion type="single" collapsible className="w-full rounded-md border">
                        {Object.entries(dagResults).map(([key, value]) => (
                            Object.keys(value as object).length > 0 && (
                                <AccordionItem value={key} key={key}>
                                    <AccordionTrigger className="px-3 text-sm">{key}</AccordionTrigger>
                                    <AccordionContent className="px-3 pb-3">
                                        <pre className="text-xs bg-muted rounded-md p-2.5 overflow-x-auto">
                                            {JSON.stringify(value, null, 2)}
                                        </pre>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        ))}
                    </Accordion>
                </div>
            )}

            {/* Raw JSON Fallback */}
            <div className="pt-4">
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="raw">
                        <AccordionTrigger className="text-sm text-muted-foreground">View Raw Metadata</AccordionTrigger>
                        <AccordionContent>
                            <pre className="text-xs bg-muted rounded-md p-2.5 overflow-x-auto">
                                {JSON.stringify(meta, null, 2)}
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};
