
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ScheduleModeToggleProps {
    mode: 'now' | 'later';
    onModeChange: (mode: 'now' | 'later') => void;
}

export function ScheduleModeToggle({ mode, onModeChange }: ScheduleModeToggleProps) {
    return (
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'now' | 'later')}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="later">Schedule for Later</TabsTrigger>
                <TabsTrigger value="now">Run Once, Right Now</TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
