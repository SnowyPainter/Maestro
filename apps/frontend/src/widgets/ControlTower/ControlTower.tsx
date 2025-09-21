import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelinePanel } from "./TimelinePanel";
import { CampaignPanel } from "./CampaignPanel";
import { MonitoringPanel } from "./MonitoringPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ControlTowerFilters = () => (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-4 border rounded-2xl bg-card shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search drafts, tags..." className="border-none focus-visible:ring-0 shadow-none p-0" />
        </div>
        
        <div className="h-6 border-l mx-2 hidden md:block"></div>

        {/* Mock filters for now */}
        <Select>
            <SelectTrigger className="w-[180px] text-muted-foreground">
                <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="acc1">Account 1</SelectItem>
                <SelectItem value="acc2">Account 2</SelectItem>
            </SelectContent>
        </Select>
        <Select>
            <SelectTrigger className="w-[180px] text-muted-foreground">
                <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="ig">Instagram</SelectItem>
                <SelectItem value="fb">Facebook</SelectItem>
            </SelectContent>
        </Select>
        <Select>
            <SelectTrigger className="w-[180px] text-muted-foreground">
                <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="cmp1">Campaign 2025</SelectItem>
                <SelectItem value="cmp2">Summer Sale</SelectItem>
            </SelectContent>
        </Select>
    </div>
);


export function ControlTower() {
  return (
    <div className="w-full">
        <ControlTowerFilters />
        <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-6">
                <TimelinePanel />
            </TabsContent>
            <TabsContent value="campaigns" className="mt-6">
                <CampaignPanel />
            </TabsContent>
            <TabsContent value="monitoring" className="mt-6">
                <MonitoringPanel />
            </TabsContent>
        </Tabs>
    </div>
  );
}
