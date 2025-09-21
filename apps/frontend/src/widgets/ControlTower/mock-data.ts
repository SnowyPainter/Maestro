export type TimelineEvent = {
    id: string;
    type: 'DRAFT_CREATED' | 'DRAFT_UPDATED' | 'VARIANT_COMPILED' | 'SCHEDULED' | 'PUBLISHED';
    date: string; // ISO string
    title: string;
    description: string;
    tags?: string[];
    platform?: 'instagram' | 'x' | 'threads';
    author?: string;
};

export const mockTimelineEvents: TimelineEvent[] = [
    {
        id: '1',
        type: 'PUBLISHED',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        title: 'New AI Model Announcement',
        description: 'The new "Maestro" model is now live on all platforms.',
        tags: ['AI', 'Launch', 'Tech'],
        platform: 'x',
        author: 'Tech Enthusiast',
    },
    {
        id: '2',
        type: 'SCHEDULED',
        date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // In 4 hours
        title: 'Weekly Tech Roundup',
        description: 'Scheduled post covering the top 5 tech news of the week.',
        tags: ['Tech News', 'Weekly'],
        platform: 'instagram',
        author: 'Tech Enthusiast',
    },
    {
        id: '3',
        type: 'VARIANT_COMPILED',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        title: 'Summer Sale Campaign',
        description: 'Instagram variant compiled with new media assets.',
        tags: ['Campaign', 'Summer Sale'],
        platform: 'instagram',
        author: 'Marketing Pro',
    },
    {
        id: '4',
        type: 'DRAFT_UPDATED',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        title: 'Developer Conference Keynote',
        description: 'Updated the draft with speaker notes and quotes.',
        tags: ['Conference', 'Keynote'],
        author: 'Internal Comms',
    },
    {
        id: '5',
        type: 'DRAFT_CREATED',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        title: 'Q3 Earnings Preview',
        description: 'Initial draft for the upcoming Q3 earnings report announcement.',
        tags: ['Finance', 'Earnings'],
        author: 'Investor Relations',
    },
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export type CampaignSummary = {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    kpis: {
        impressions: number;
        engagement: number;
    };
};

export const mockCampaignSummaries: CampaignSummary[] = [
    {
        id: '1',
        name: 'Q3 Product Launch',
        description: 'Promoting the new Maestro AI features.',
        isActive: true,
        kpis: {
            impressions: 1250345,
            engagement: 4.7,
        },
    },
    {
        id: '2',
        name: 'Summer Sale 2025',
        description: 'Annual summer promotional campaign.',
        isActive: true,
        kpis: {
            impressions: 876543,
            engagement: 6.2,
        },
    },
    {
        id: '3',
        name: 'Dev Conference Recap',
        description: 'Sharing highlights from the annual developer conference.',
        isActive: false,
        kpis: {
            impressions: 450123,
            engagement: 3.1,
        },
    },
];

export type HeatmapData = {
    date: string; // YYYY-MM-DD
    score: number; // 0-1
};

// Generate mock heatmap data for the last 90 days
export const mockHeatmapData: HeatmapData[] = Array.from({ length: 90 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
        date: date.toISOString().split('T')[0],
        score: Math.random() * 0.8 + 0.1, // Random score between 0.1 and 0.9
    };
}).reverse();

export type MockDraft = {
    id: string;
    title: string;
    updatedAt: string;
    tags: string[];
};

export const mockUnassignedDrafts: MockDraft[] = [
    {
        id: 'd1',
        title: 'Brainstorming for new social media angles',
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['social', 'ideas'],
    },
    {
        id: 'd2',
        title: 'Initial thoughts on video script',
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['video', 'scripting'],
    },
];
