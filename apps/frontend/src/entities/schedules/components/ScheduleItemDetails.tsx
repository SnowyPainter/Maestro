import { useState } from "react";
import { toast } from "sonner";
import { ScheduleListItem } from "@/lib/api/generated";
import { AlertCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const parseUtcDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    if (dateString.endsWith('Z') || /[-+]\d{2}:\d{2}$/.test(dateString)) {
        return new Date(dateString);
    }
    return new Date(dateString + 'Z');
};

const ObjectViewer = ({ data, title }: { data: any; title: string }) => {
    const renderValue = (value: any, key?: string): React.ReactNode => {
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
                return <span className="text-muted-foreground">[]</span>;
            }
            return (
                <div className="ml-4">
                    <span className="text-purple-600">[</span>
                    {value.map((item, index) => (
                        <div key={index} className="ml-4">
                            {renderValue(item)}
                            {index < value.length - 1 && <span className="text-muted-foreground">,</span>}
                        </div>
                    ))}
                    <span className="text-purple-600">]</span>
                </div>
            );
        }

        if (typeof value === 'object') {
            const entries = Object.entries(value);
            if (entries.length === 0) {
                return <span className="text-muted-foreground">{"{}"}</span>;
            }

            return (
                <div className="ml-4">
                    <span className="text-purple-600">{"{"}</span>
                    {entries.map(([k, v], index) => {
                        const isCommonKey = ['title', 'message', 'tags', 'description', 'label', 'name'].includes(k);
                        const keyClass = isCommonKey ? 'font-semibold text-foreground' : 'text-muted-foreground';
                        const valueClass = isCommonKey && typeof v === 'string' ? 'text-foreground' : '';

                        return (
                            <div key={k} className="ml-4">
                                <span className={keyClass}>"{k}"</span>
                                <span className="text-muted-foreground">: </span>
                                <span className={valueClass}>{renderValue(v, k)}</span>
                                {index < entries.length - 1 && <span className="text-muted-foreground">,</span>}
                            </div>
                        );
                    })}
                    <span className="text-purple-600">{"}"}</span>
                </div>
            );
        }

        return <span>{String(value)}</span>;
    };

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger className="text-xs font-semibold">{title}</AccordionTrigger>
                <AccordionContent>
                    <div className="text-xs bg-muted/50 p-3 rounded-md overflow-auto font-mono">
                        {renderValue(data)}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export function ScheduleItemDetails({ item }: { item: ScheduleListItem }) {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div className="p-3 bg-muted/30 border-t">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs">
                <div className="space-y-2">
                    <h5 className="font-semibold text-xs uppercase text-muted-foreground">Details</h5>
                    {item.last_error && (
                        <div className="p-2 bg-red-500/10 text-red-700 rounded-md">
                            <p className="font-bold flex items-center gap-2"><AlertCircle className="h-4 w-4" />Last Error</p>
                            <p className="font-mono text-xs mt-1">{item.last_error}</p>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Attempts:</span>
                        <span className="font-mono">{item.attempts || 0} / {item.max_attempts ?? '∞'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Idempotency Key:</span>
                        {item.idempotency_key ? (
                            <div className="flex items-center gap-1">
                                <span className="font-mono text-gray-500 truncate max-w-[120px]">{item.idempotency_key}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.idempotency_key!)}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : <span className="text-muted-foreground">N/A</span>}
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-mono">{item.created_at ? format(parseUtcDate(item.created_at)!, 'Pp') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Updated:</span>
                        <span className="font-mono">{item.updated_at ? format(parseUtcDate(item.updated_at)!, 'Pp') : 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div className="mt-3">
                {item.dag_spec && <ObjectViewer data={item.dag_spec} title="DAG Spec" />}
                {item.payload && <ObjectViewer data={item.payload} title="Payload" />}
                {item.context && <ObjectViewer data={item.context} title="Context" />}
            </div>
        </div>
    );
}
