import { ABTestListResponse, ABTestOut, CampaignOut, useBffAbtestsListApiBffAbtestsGet, useBffCampaignsListCampaignsApiBffCampaignsGet } from "@/lib/api/generated";
import { useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ABTestCard from "@/entities/abtests/components/ABTestCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ABTestList = () => {
  const { data: campaignsData, isLoading: isLoadingCampaigns, error: campaignsError } = useBffCampaignsListCampaignsApiBffCampaignsGet({});
  const { data: abTestsData, isLoading: isLoadingABTests, error: abTestsError } = useBffAbtestsListApiBffAbtestsGet({});

  const campaignsById = useMemo(() => {
    if (!campaignsData) return new Map<number, CampaignOut>();
    return new Map(campaignsData.map((c) => [c.id, c]));
  }, [campaignsData]);

  const groupedABTests = useMemo(() => {
    if (!abTestsData?.items) return new Map<number, ABTestOut[]>();

    return abTestsData.items.reduce((acc, test) => {
      const campaignId = test.campaign_id;
      if (!acc.has(campaignId)) {
        acc.set(campaignId, []);
      }
      acc.get(campaignId)!.push(test);
      return acc;
    }, new Map<number, ABTestOut[]>());

  }, [abTestsData]);

  if (isLoadingABTests || isLoadingCampaigns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All A/B Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading A/B Tests...</p>
        </CardContent>
      </Card>
    );
  }

  if (abTestsError || campaignsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All A/B Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Error loading A/B tests.</p>
        </CardContent>
      </Card>
    );
  }

  if (groupedABTests.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All A/B Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No A/B tests found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All A/B Tests</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {Array.from(groupedABTests.entries()).map(([campaignId, tests]) => {
            const campaign = campaignsById.get(campaignId);
            return (
              <AccordionItem value={`campaign-${campaignId}`} key={campaignId}>
                <AccordionTrigger>
                  {campaign ? campaign.name : `Campaign ID: ${campaignId}`}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {tests.map((test) => (
                      <ABTestCard key={test.id} abTest={test} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default ABTestList;
