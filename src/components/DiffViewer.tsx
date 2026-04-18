import React from "react";

interface DiffViewerProps {
  content: string;
  maxLines?: number;
}

/**
 * Renders suggested file content with basic diff-like visualization.
 * Since suggested_diff contains the FULL new file content (not a unified diff),
 * we display it as a clean code viewer with line numbers.
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({ content, maxLines = 100 }) => {
  const { lines, totalLineCount } = React.useMemo(() => {
    const allLines = content.split('\n');
    return {
      lines: maxLines ? allLines.slice(0, maxLines) : allLines,
      totalLineCount: allLines.length,
    };
  }, [content, maxLines]);

  const truncated = totalLineCount > (maxLines || Infinity);

  return (
    <div className="rounded-xl border border-border-main overflow-hidden">
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto bg-[#1e1e2e]">
        <table className="w-full border-collapse font-mono text-xs leading-relaxed">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td className="text-right px-3 py-0 select-none text-text-muted opacity-30 border-r border-white/5 w-12 text-xs">
                  {i + 1}
                </td>
                <td className="px-4 py-0 whitespace-pre text-emerald-300/80">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div className="text-center text-xs text-text-muted py-1.5 bg-[var(--panel-muted)] border-t border-border-main">
          Showing first {maxLines} of {totalLineCount} lines
        </div>
      )}
    </div>
  );
};
