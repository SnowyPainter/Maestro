import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InfoCard } from './InfoCard';
import { Instagram, AtSign } from 'lucide-react';

interface SeriesTableCardProps {
  title: string;
  data: any;
}

const PlatformIcon: React.FC<{ platform: string }> = ({ platform }) => {
    switch (platform.toLowerCase()) {
        case 'instagram':
            return <Instagram className="w-5 h-5" />;
        case 'threads':
            return <AtSign className="w-5 h-5" />;
        default:
            return <span>{platform}</span>;
    }
};

const renderCell = (value: any, key: string) => {
    if (key.toLowerCase() === 'platform' && typeof value === 'string') {
        return <PlatformIcon platform={value} />;
    }
    if (typeof value === 'boolean') {
        return value ? "Yes" : "No";
    }
    if (value === null || value === undefined) {
        return <span className="text-gray-400">N/A</span>;
    }
    if (key.toLowerCase().includes('status')) {
        return <Badge variant="outline">{value}</Badge>;
    }
    if (key.toLowerCase().includes('_at') || key.toLowerCase().includes('date')) {
        return new Date(value).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('link') || key.toLowerCase().includes('permalink')) && typeof value === 'string') {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-xs">{value}</a>
    }
    if (Array.isArray(value)) {
        return <div className="max-h-20 overflow-y-auto">{value.map((item, index) => <Badge key={index} variant="secondary" className="mr-1 mb-1">{item}</Badge>)}</div>;
    }
    if (typeof value === 'object' && value !== null) {
        return (
            <div className="max-h-20 overflow-y-auto">
                <pre className="text-xs bg-gray-100 p-2 rounded-md">
                    {JSON.stringify(value, null, 2)}
                </pre>
            </div>
        );
    }
    return <div className="truncate max-w-xs">{String(value)}</div>;
};

export const SeriesTableCard: React.FC<SeriesTableCardProps> = ({ title, data }) => {
    const items = Array.isArray(data) ? data : (data?.items && Array.isArray(data.items)) ? data.items : null;

    if (items && items.length > 0) {
        const initialHeaders = Object.keys(items[0]).filter(key => !key.endsWith('_id') && key !== 'id');

        const naCounts = initialHeaders.reduce((acc, header) => {
            acc[header] = items.filter((item: any) => item[header] === null || item[header] === undefined).length;
            return acc;
        }, {} as Record<string, number>);

        const headers = initialHeaders.sort((a, b) => naCounts[a] - naCounts[b]);

        return (
            <Card className="w-full max-w-4xl">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item: any, index: number) => (
                                <TableRow key={index}>
                                    {headers.map(header => (
                                        <TableCell key={header}>
                                            {renderCell(item[header], header)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    }

    if (typeof data === 'object' && data !== null) {
        const entries = Object.entries(data).filter(([key]) => !key.endsWith('_id') && key !== 'id');
        return (
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Key</TableHead>
                                <TableHead>Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell className="font-medium">{key}</TableCell>
                                    <TableCell>{renderCell(value, key)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    }

    return <InfoCard title={title} data={data} />;
};

