// Spell Check Panel - Integration for text tool
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useSpellCheck } from "../../hooks/useSpellCheck";
import type { ArtworkObject } from "@artworkpdf/document-model";

interface SpellCheckPanelProps {
  selectedObject: ArtworkObject | null;
  onTextUpdate?: (id: string, newText: string) => void;
}

export function SpellCheckPanel({ selectedObject, onTextUpdate }: SpellCheckPanelProps) {
  const { checkText, isLoaded, isLoading, error } = useSpellCheck();
  const [issues, setIssues] = useState<{ word: string; suggestions: string[] }[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!selectedObject?.text || !isLoaded) {
      setIssues([]);
      return;
    }

    setIsChecking(true);
    // Debounce the check
    const timer = setTimeout(() => {
      const results = checkText(selectedObject.text || "");
      setIssues(results);
      setIsChecking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedObject?.text, isLoaded, checkText]);

  const applySuggestion = (originalWord: string, suggestion: string) => {
    if (!selectedObject?.text || !onTextUpdate) return;

    // Replace all instances of the misspelled word
    const newText = selectedObject.text.replace(
      new RegExp(`\\b${originalWord}\\b`, "gi"),
      suggestion
    );
    onTextUpdate(selectedObject.id, newText);
  };

  const ignoreWord = (word: string) => {
    // In a full implementation, this would add to a custom dictionary
    setIssues((prev) => prev.filter((i) => i.word !== word));
  };

  if (selectedObject?.type !== "text") return null;

  return (
    <div className="border-b border-slate-700">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Spell Check
        </span>
        {isLoading && (
          <span className="text-[10px] text-slate-500">Loading...</span>
        )}
        {!isLoading && isChecking && (
          <span className="text-[10px] text-slate-500">Checking...</span>
        )}
        {isLoaded && !isChecking && (
          <span className="text-[10px] text-slate-500">
            {issues.length === 0 ? "No issues" : `${issues.length} issues`}
          </span>
        )}
      </div>

      {error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {isLoaded && issues.length > 0 && (
        <div className="max-h-48 overflow-y-auto px-3 pb-3 space-y-2">
          {issues.map((issue) => (
            <div key={issue.word} className="rounded bg-slate-700/50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-red-300">{issue.word}</span>
                <button
                  onClick={() => ignoreWord(issue.word)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Ignore
                </button>
              </div>
              {issue.suggestions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {issue.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => applySuggestion(issue.word, suggestion)}
                      className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-500"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isLoaded && issues.length === 0 && selectedObject?.text && (
        <div className="px-3 pb-3">
          <p className="text-xs text-green-400">✓ No spelling issues found</p>
        </div>
      )}
    </div>
  );
}
