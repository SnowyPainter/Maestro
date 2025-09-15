import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, BarChart3, MessageSquare, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const initialTools = [
    { id: 'new-chat', title: 'New Chat', icon: <MessageSquare className="w-5 h-5 text-primary" /> },
    { id: 'query-trends', title: 'Query Trends', icon: <BarChart3 className="w-5 h-5 text-primary" /> },
    { id: 'schedule', title: 'Schedule', icon: <Calendar className="w-5 h-5 text-primary" /> },
    { id: 'draft', title: 'Draft', icon: <FileText className="w-5 h-5 text-primary" /> },
];

function SortableToolCard({ tool, ...props }: { tool: typeof initialTools[0] & { [key: string]: any } }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tool.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            {...props}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-card hover:bg-muted border transition-colors aspect-square text-card-foreground touch-none"
        >
            {tool.icon}
            <span className="text-xs font-medium text-center">{tool.title}</span>
        </button>
    );
}

export function ChatSidebar({ onQueryTrendsClick, onNewChatClick }: { onQueryTrendsClick: () => void, onNewChatClick: () => void }) {
    const [tools, setTools] = useState(initialTools);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Require the pointer to move by 5 pixels before activating a drag
            },
        })
    );

    useEffect(() => {
        const savedToolsOrder = localStorage.getItem('maestro-tool-order');
        if (savedToolsOrder) {
            try {
                const toolOrder = JSON.parse(savedToolsOrder) as string[];
                const savedTools = toolOrder.map(id => initialTools.find(t => t.id === id)).filter(Boolean);
                if (savedTools.length === initialTools.length) {
                    setTools(savedTools as typeof initialTools);
                }
            } catch (e) {
                // ignore parsing errors
            }
        }
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTools((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('maestro-tool-order', JSON.stringify(newOrder.map(t => t.id)));
                return newOrder;
            });
        }
    };
    
    const getClickHandler = (id: string) => {
        switch(id) {
            case 'new-chat': return onNewChatClick;
            case 'query-trends': return onQueryTrendsClick;
            default: return undefined;
        }
    }

    return (
        <aside className="bg-muted/30 p-2 flex-col gap-3 w-64 border-r hidden md:flex">
            <div className="p-2">
                <Logo />
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tools.map(t => t.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 gap-2">
                        {tools.map(tool => (
                            <SortableToolCard key={tool.id} tool={tool} onClick={getClickHandler(tool.id)} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            <div className="flex-1"></div>
            <div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start p-2">
                            <Settings className="w-4 h-4 mr-2" />
                            <span>Settings</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" className="w-56">
                        <DropdownMenuItem asChild>
                            <Link to="/settings">Go to Settings</Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
