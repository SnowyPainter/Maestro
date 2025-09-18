export function ChatContextPanel({ flows }: { flows?: any[] }) {
    return (
        <aside className="bg-card border-l p-4 h-screen hidden lg:block">
            <h2 className="text-lg font-semibold mb-4">Available Flows</h2>
            <div className="overflow-y-auto space-y-2 max-h-[calc(100vh-8rem)] no-scrollbar">
                {flows?.map((flow, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg border break-words">
                        <h3 className="font-medium text-sm leading-tight">{flow.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                            {flow.description}
                        </p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded whitespace-nowrap">
                                {flow.method}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded break-all">
                                {flow.path}
                            </span>
                        </div>
                    </div>
                ))}
                {!flows?.length && (
                    <p className="text-sm text-muted-foreground">No flows available</p>
                )}
            </div>
        </aside>
    );
}
