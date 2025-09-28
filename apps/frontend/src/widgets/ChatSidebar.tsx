import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, BarChart3, MessageSquare, Calendar, FileText, BadgeCheck, Plug, Volume2, PersonStanding, TowerControl } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useContextRegistryStore } from "@/store/chat-context-registry";

const initialTools = [
    { id: 'new-chat', title: 'New Chat', icon: <MessageSquare className="w-5 h-5 text-primary" /> },
    { id: 'query-trends', title: 'Query Trends', icon: <BarChart3 className="w-5 h-5 text-primary" /> },
    { id: 'draft', title: 'Drafts', icon: <FileText className="w-5 h-5 text-primary" /> },
    { id: 'campaigns', title: 'Campaigns', icon: <Volume2 className="w-5 h-5 text-primary" /> },
    { id: 'personas', title: 'Personas', icon: <PersonStanding className="w-5 h-5 text-primary" /> },
    { id: 'accounts', title: 'Accounts', icon: <BadgeCheck className="w-5 h-5 text-primary" /> },
    { id: 'schedules', title: 'Schedules', icon: <Calendar className="w-5 h-5 text-primary" /> },
    { id: 'coworker', title: 'CoWorker', icon: <TowerControl className="w-5 h-5 text-primary" /> },
];

function SortableToolCard({ tool, onClick, ...props }: {
    tool: typeof initialTools[0] & { [key: string]: any },
    onClick?: () => void
}) {
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
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-card hover:bg-muted border transition-colors aspect-square text-card-foreground touch-none"
        >
            {tool.icon}
            <span className="text-xs font-medium text-center">{tool.title}</span>
        </button>
    );
}

export function ChatSidebar({
    onQueryTrendsClick,
    onNewChatClick,
    onToolClick,
}: {
    onQueryTrendsClick: () => void,
    onNewChatClick: () => void,
    onToolClick: (toolId: string) => void,
}) {
    const [tools, setTools] = useState(initialTools);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    useEffect(() => {
        const savedToolsOrder = localStorage.getItem('maestro-tool-order');
        if (savedToolsOrder) {
            try {
                const toolOrder = JSON.parse(savedToolsOrder) as string[];
                // Filter out any tools that are no longer in initialTools
                const validSavedTools = toolOrder.map(id => initialTools.find(t => t.id === id)).filter(Boolean) as typeof initialTools;
                // Add any new tools that weren't in the saved order
                const newTools = initialTools.filter(t => !validSavedTools.some(st => st.id === t.id));
                const finalTools = [...validSavedTools, ...newTools];
                
                setTools(finalTools);

            } catch (e) {
                // ignore parsing errors and default to initialTools
                setTools(initialTools);
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
            case 'new-chat': 
                return () => {
                    useContextRegistryStore.setState({ byKey: {} });
                    onNewChatClick();
                };
            case 'query-trends': return onQueryTrendsClick;
            default: return () => onToolClick(id);
        }
    }

    return (
        <aside className="bg-muted/30 p-2 flex flex-col gap-3 w-64 border-r hidden md:flex h-screen">
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
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link to="/settings">All Settings</Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
