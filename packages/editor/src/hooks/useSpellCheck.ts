// Spell check hook using typo-js
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect } from "react";
import Typo from "typo-js";

interface SpellCheckResult {
  word: string;
  suggestions: string[];
  isValid: boolean;
}

interface UseSpellCheckReturn {
  checkText: (text: string) => SpellCheckResult[];
  checkWord: (word: string) => SpellCheckResult | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

let dictionaryCache: Typo | null = null;
let dictionaryLoading = false;
let dictionaryListeners: (() => void)[] = [];

function notifyListeners() {
  dictionaryListeners.forEach((cb) => cb());
}

export function useSpellCheck(): UseSpellCheckReturn {
  const [isLoaded, setIsLoaded] = useState(!!dictionaryCache);
  const [isLoading, setIsLoading] = useState(dictionaryLoading);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dictionaryCache) {
      setIsLoaded(true);
      return;
    }

    if (dictionaryLoading) {
      const listener = () => {
        setIsLoaded(!!dictionaryCache);
        setIsLoading(dictionaryLoading);
      };
      dictionaryListeners.push(listener);
      return () => {
        dictionaryListeners = dictionaryListeners.filter((l) => l !== listener);
      };
    }

    // Load dictionary
    dictionaryLoading = true;
    setIsLoading(true);

    Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/dictionary-en@3.2.0/index.aff").then((r) => r.text()),
      fetch("https://cdn.jsdelivr.net/npm/dictionary-en@3.2.0/index.dic").then((r) => r.text()),
    ])
      .then(([affData, dicData]) => {
        dictionaryCache = new Typo("en_US", affData, dicData);
        dictionaryLoading = false;
        setIsLoaded(true);
        setIsLoading(false);
        notifyListeners();
      })
      .catch((err) => {
        dictionaryLoading = false;
        setIsLoading(false);
        setError(`Failed to load dictionary: ${err.message}`);
        notifyListeners();
      });
  }, []);

  const checkWord = useCallback(
    (word: string): SpellCheckResult | null => {
      if (!dictionaryCache || !word.trim()) return null;

      const cleanWord = word.toLowerCase().replace(/[^a-z']/g, "");
      if (!cleanWord || cleanWord.length < 2) return null;

      const isValid = dictionaryCache.check(cleanWord);
      if (isValid) {
        return { word: cleanWord, suggestions: [], isValid: true };
      }

      const suggestions = dictionaryCache.suggest(cleanWord).slice(0, 5);
      return { word: cleanWord, suggestions, isValid: false };
    },
    [isLoaded]
  );

  const checkText = useCallback(
    (text: string): SpellCheckResult[] => {
      if (!dictionaryCache || !text.trim()) return [];

      const words = text.match(/\b[a-zA-Z']+\b/g) || [];
      const results: SpellCheckResult[] = [];
      const seen = new Set<string>();

      for (const word of words) {
        const lower = word.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);

        const result = checkWord(word);
        if (result && !result.isValid) {
          results.push(result);
        }
      }

      return results;
    },
    [checkWord]
  );

  return { checkText, checkWord, isLoaded, isLoading, error };
}
