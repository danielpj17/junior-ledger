'use client';

import React from 'react';
import { FileContext } from '../actions/chat';

interface MessageContentProps {
  text: string;
  fileContexts?: FileContext[];
}

export default function MessageContent({ text, fileContexts = [] }: MessageContentProps) {
  // Parse text and render markdown (bold) and citations
  const renderContent = (): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let partKey = 0;

    // Pattern to match citations: [1], [2], etc. but not markdown links or images
    // Citation pattern: [ followed by one or more digits, followed by ]
    const citationPattern = /\[(\d+)\]/g;
    const matches = Array.from(text.matchAll(citationPattern));

    if (matches.length === 0) {
      // No citations, just render markdown
      return [renderMarkdown(text, partKey)];
    }

    // Process text with citations
    matches.forEach((match) => {
      // Add text before citation with markdown rendering
      if (match.index !== undefined && match.index > currentIndex) {
        const beforeText = text.substring(currentIndex, match.index);
        parts.push(renderMarkdown(beforeText, partKey++));
      }

      // Add citation component
      const citationNum = parseInt(match[1], 10);
      const fileIndex = citationNum - 1; // Convert to 0-based index
      const fileName = fileContexts[fileIndex]?.fileName || `File ${citationNum}`;

      parts.push(
        <sup
          key={`citation-${partKey++}`}
          className="text-blue-600 hover:text-blue-800 cursor-help font-medium relative group"
          title={fileName}
        >
          [{citationNum}]
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {fileName}
          </span>
        </sup>
      );

      currentIndex = (match.index || 0) + match[0].length;
    });

    // Add remaining text after last citation
    if (currentIndex < text.length) {
      const afterText = text.substring(currentIndex);
      parts.push(renderMarkdown(afterText, partKey++));
    }

    return parts;
  };

  // Render markdown bold text (**text**)
  // Matches **text** but avoids matching cases like ****text****
  const renderMarkdown = (content: string, key: number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let partKey = 0;

    // Pattern to match **bold** text (non-greedy to handle multiple bold sections)
    const boldPattern = /\*\*(.+?)\*\*/g;
    const matches = Array.from(content.matchAll(boldPattern));

    if (matches.length === 0) {
      // No bold text, return as-is
      return <span key={key}>{content}</span>;
    }

    matches.forEach((match) => {
      // Add text before bold
      if (match.index !== undefined && match.index > currentIndex) {
        const beforeText = content.substring(currentIndex, match.index);
        parts.push(<span key={`${key}-text-${partKey++}`}>{beforeText}</span>);
      }

      // Add bold text
      parts.push(
        <strong key={`${key}-bold-${partKey++}`} className="font-semibold">
          {match[1]}
        </strong>
      );

      currentIndex = (match.index || 0) + match[0].length;
    });

    // Add remaining text after last bold
    if (currentIndex < content.length) {
      const afterText = content.substring(currentIndex);
      parts.push(<span key={`${key}-text-${partKey++}`}>{afterText}</span>);
    }

    return <span key={key}>{parts}</span>;
  };

  return (
    <div className="text-sm whitespace-pre-wrap">
      {renderContent()}
    </div>
  );
}
