import React, { useState } from "react";
import { useBffReactiveListTemplatesApiBffReactiveMessageTemplatesGet } from "@/lib/api/generated";
import { TemplateList } from "@/entities/reactive/components/template/TemplateList";
import { TemplateCreateModal } from "./TemplateCreateModal";
import { TemplateEditModal } from "./TemplateEditModal";
import { TemplateDeleteModal } from "./TemplateDeleteModal";
import { ReactionMessageTemplateOut, ReactionActionType } from "@/lib/api/generated";

export function TemplateManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<ReactionActionType | 'all'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReactionMessageTemplateOut | null>(null);

  // 템플릿 목록 조회
  const { data: templatesData, isLoading, refetch } = useBffReactiveListTemplatesApiBffReactiveMessageTemplatesGet({
    include_inactive: true, // 비활성 템플릿도 모두 보여주기
  });

  const templates = templatesData?.items || [];

  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  const handleEdit = (template: ReactionMessageTemplateOut) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleDelete = (template: ReactionMessageTemplateOut) => {
    setSelectedTemplate(template);
    setDeleteModalOpen(true);
  };

  const handleCloseModals = () => {
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedTemplate(null);
    refetch(); // 목록 새로고침
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <TemplateList
        templates={templates}
        isLoading={isLoading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterChange={setFilterType}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create Modal */}
      <TemplateCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCloseModals}
      />

      {/* Edit Modal */}
      <TemplateEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        template={selectedTemplate}
        onSuccess={handleCloseModals}
      />

      {/* Delete Modal */}
      <TemplateDeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        template={selectedTemplate}
        onSuccess={handleCloseModals}
      />
    </div>
  );
}
