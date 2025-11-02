// 노드 타입별 색상 매핑
export const NODE_TYPE_COLORS: Record<string, string> = {
  playbook: 'bg-blue-500 text-white',
  insight_comment: 'bg-green-500 text-white',
  campaign: 'bg-purple-500 text-white',
  persona: 'bg-orange-500 text-white',
  draft: 'bg-pink-500 text-white',
  default: 'bg-gray-500 text-white'
};

// 노드 타입별 표시 텍스트
export const NODE_TYPE_LABELS: Record<string, string> = {
  playbook: 'Playbook connections',
  insight_comment: 'Comment relationships',
  campaign: 'Campaign relationships',
  persona: 'Persona connections',
  draft: 'Draft relationships',
  default: 'Node connections'
};
