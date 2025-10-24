import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, BookTemplate } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import { ReactionMessageTemplateOut, ReactionActionType } from "@/lib/api/generated";
import { useContextRegistryStore } from "@/store/chat-context-registry";

interface TemplateListProps {
  templates: ReactionMessageTemplateOut[];
  isLoading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: ReactionActionType | 'all';
  onFilterChange: (value: ReactionActionType | 'all') => void;
  onCreate: () => void;
  onEdit: (template: ReactionMessageTemplateOut) => void;
  onDelete: (template: ReactionMessageTemplateOut) => void;
}

export function TemplateList({
  templates,
  isLoading,
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  onCreate,
  onEdit,
  onDelete,
}: TemplateListProps) {
  const { registerEmission } = useContextRegistryStore();

  // Register templates in context registry
  React.useEffect(() => {
    templates.forEach(template => {
      const typePrefix = template.template_type === 'dm' ? 'DM' :
                        template.template_type === 'reply' ? 'Reply' : '';
      const baseLabel = template.title || `Template ${template.id}`;
      const label = typePrefix ? `${typePrefix} ${baseLabel}` : baseLabel;

      registerEmission('template_id', {
        value: template.id.toString(),
        label: label,
        icon: 'BookTemplate',
        meta: {
          template_id: template.id,
          template_type: template.template_type,
          tag_key: template.tag_key
        }
      });
    });
  }, [templates, registerEmission]);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tag_key?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || template.template_type === filterType;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Message Templates</h2>
          <p className="text-gray-600">Manage reusable message templates for your reactive rules</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={filterType} onValueChange={onFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={ReactionActionType.dm}>DM Templates</SelectItem>
              <SelectItem value={ReactionActionType.reply}>Reply Templates</SelectItem>
              <SelectItem value={ReactionActionType.alert}>Alert Templates</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <BookTemplate className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {templates.length === 0 ? "No templates yet" : "No templates found"}
          </h3>
          <p className="text-gray-500 mb-6">
            {templates.length === 0
              ? "Create your first message template to get started"
              : "Try adjusting your search or filter criteria"
            }
          </p>
          {templates.length === 0 && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {templates.length > 0 && (
        <div className="text-center text-sm text-gray-500 pt-4 border-t">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      )}
    </div>
  );
}
