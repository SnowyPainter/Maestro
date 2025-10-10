
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MailBatchRequest, PostPublishBatchRequest, SyncMetricsBatchRequest } from "@/lib/api/generated";
import { ScheduleBuilderProps } from "../ScheduleBuilder";
import { SimpleSettings } from "./SimpleSettings";
import { AdvancedSettings } from "./AdvancedSettings";

type BatchRequest = MailBatchRequest | PostPublishBatchRequest | SyncMetricsBatchRequest;

export function ScheduledRunSettings<T extends BatchRequest>({ value, onChange, errors }: ScheduleBuilderProps<T>) {

    const handleFieldChange = (path: string, val: any) => {
        const keys = path.split('.');
        const new_data = JSON.parse(JSON.stringify(value || {}));
        let current: any = new_data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = val;
        onChange(new_data);
    };

    return (
        <Tabs defaultValue="simple">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="simple">Simple</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="simple" className="p-6 pt-4 border rounded-b-lg rounded-tr-lg">
                <SimpleSettings value={value} onChange={onChange} errors={errors} handleFieldChange={handleFieldChange} />
            </TabsContent>
            <TabsContent value="advanced" className="p-6 pt-4 border rounded-b-lg rounded-tr-lg">
                <AdvancedSettings value={value} onChange={onChange} errors={errors} handleFieldChange={handleFieldChange} />
            </TabsContent>
        </Tabs>
    );
}
