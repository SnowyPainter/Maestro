import React from 'react';
import { Instagram, Hash, ExternalLink, Clock, Check, X } from 'lucide-react';

// 메타 정보를 보기 좋게 파싱하는 함수
export const parseMetaInfo = (meta: Record<string, any>) => {
  const parsed: Array<{ key: string; value: React.ReactNode; priority: number }> = [];

  Object.entries(meta).forEach(([key, value]) => {
    // null, undefined, 빈 문자열은 표시하지 않음
    if (value === null || value === undefined || value === '') {
      return;
    }

    let displayValue: React.ReactNode = '';
    let priority = 1; // 기본 우선순위

    switch (key) {
      case 'platform':
        priority = 10;
        if (value === 'PlatformKind.INSTAGRAM') {
          displayValue = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-pink-100 text-pink-800 rounded">
            <Instagram className="w-3 h-3" />
            IG
          </span>;
        } else if (value === 'PlatformKind.THREADS') {
          displayValue = <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-gray-900 text-white rounded">
            <Hash className="w-3 h-3" />
            TH
          </span>;
        } else {
          displayValue = <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded">{String(value)}</span>;
        }
        break;

      case 'permalink':
        priority = 9;
        displayValue = (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-xs inline-flex items-center gap-1"
            title={String(value)}
          >
            <ExternalLink className="w-3 h-3" />
            Link
          </a>
        );
        break;

      case 'author':
        priority = 8;
        displayValue = (
          <span className="text-xs font-medium text-gray-700">@{value}</span>
        );
        break;

      case 'is_owned_by_me':
        priority = 7;
        displayValue = value ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
            <Check className="w-3 h-3" />
            Owned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded">
            <X className="w-3 h-3" />
            External
          </span>
        );
        break;

      case 'best_time_window':
        priority = 6;
        displayValue = <span className="text-xs text-green-600 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {String(value)}
        </span>;
        break;

      case 'embedding_provider':
      case 'embedding_model':
        priority = 0; // 표시하지 않음
        return;
        break;

      case 'best_tone':
        priority = 5;
        displayValue = <span className="text-xs text-gray-600">{String(value)}</span>;
        break;

      case 'comment_external_id':
        priority = 3;
        displayValue = <span className="text-xs text-gray-500 font-mono">{String(value).slice(-6)}</span>;
        break;

      default:
        // 간단한 값만 표시
        if (typeof value === 'string' && value.length > 20) {
          displayValue = <span className="text-xs text-gray-600">{value.slice(0, 20)}...</span>;
        } else if (Array.isArray(value)) {
          displayValue = <span className="text-xs text-gray-600">[{value.length}]</span>;
        } else if (typeof value === 'object' && value !== null) {
          displayValue = <span className="text-xs text-gray-600">{"{" + Object.keys(value).length + "}"}</span>;
        } else {
          displayValue = <span className="text-xs text-gray-600">{String(value)}</span>;
        }
        break;
    }

    parsed.push({ key, value: displayValue, priority });
  });

  // 우선순위에 따라 정렬 (높은 우선순위가 먼저)
  return parsed.sort((a, b) => b.priority - a.priority);
};
