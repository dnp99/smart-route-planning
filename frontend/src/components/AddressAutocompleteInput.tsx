import { useEffect, useId, useMemo, useState } from 'react';
import { resolveApiBaseUrl } from './apiBaseUrl';
import type { AddressSuggestion } from './types';
import {
  extractApiErrorMessage,
  parseAddressAutocompleteResponse,
} from '../../../shared/contracts';

type AddressAutocompleteInputProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
  onChange: (value: string) => void;
  onEnterKey?: () => void;
  onSuggestionSelect?: (value: string) => void;
  onSuggestionPick?: (suggestion: AddressSuggestion) => void;
  onBlur?: () => void;
};

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
const AUTOCOMPLETE_DEBOUNCE_MS = 500;

function AddressAutocompleteInput({
  id,
  label,
  placeholder,
  value,
  required = false,
  disabled = false,
  helperText,
  errorText,
  onChange,
  onEnterKey,
  onSuggestionSelect,
  onSuggestionPick,
  onBlur,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedSuggestionName, setSelectedSuggestionName] = useState(
    value.trim(),
  );
  const listboxId = useId();

  const shouldSearch = value.trim().length >= MIN_QUERY_LENGTH;
  const normalizedValue = value.trim();
  const shouldSuppressSuggestions =
    selectedSuggestionName.length > 0 && normalizedValue === selectedSuggestionName;
  const hasVisibleError = Boolean(errorText || error);

  useEffect(() => {
    if (!shouldSearch || shouldSuppressSuggestions) {
      setSuggestions([]);
      setIsLoading(false);
      setError('');
      setIsDropdownOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const query = normalizedValue;
    const controller = new AbortController();
    let isSubscribed = true;

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError('');

      try {
        const apiBaseUrl = resolveApiBaseUrl();
        const params = new URLSearchParams({ query });
        const response = await fetch(`${apiBaseUrl}/api/address-autocomplete?${params}`, {
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload) ?? 'Unable to load address suggestions.');
        }

        if (isSubscribed) {
          const nextSuggestions = parseAddressAutocompleteResponse(payload, MAX_SUGGESTIONS);
          setSuggestions(nextSuggestions);
          setIsDropdownOpen(nextSuggestions.length > 0);
          setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1);
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return;
        }

        if (isSubscribed) {
          setSuggestions([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load address suggestions.');
          setIsDropdownOpen(false);
          setActiveSuggestionIndex(-1);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      isSubscribed = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [normalizedValue, shouldSearch, shouldSuppressSuggestions]);

  const suggestionNames = useMemo(() => suggestions.map((item) => item.displayName), [suggestions]);
  const showSuggestions = isDropdownOpen && suggestionNames.length > 0;

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    onChange(suggestion.displayName);
    setSelectedSuggestionName(suggestion.displayName.trim());
    setIsDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    onSuggestionSelect?.(suggestion.displayName);
    onSuggestionPick?.(suggestion);
  };

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        <span>{label}</span>
        {required && (
          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Required
          </span>
        )}
      </label>
      <div className="relative w-full">
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setSelectedSuggestionName('');
            setIsDropdownOpen(true);
          }}
          onFocus={() => {
            if (suggestionNames.length > 0) {
              setIsDropdownOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsDropdownOpen(false);
              setActiveSuggestionIndex(-1);
            }, 120);
            onBlur?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!showSuggestions) {
                setIsDropdownOpen(suggestionNames.length > 0);
                setActiveSuggestionIndex(suggestionNames.length > 0 ? 0 : -1);
                return;
              }

              setActiveSuggestionIndex((currentIndex) =>
                Math.min(currentIndex + 1, suggestionNames.length - 1),
              );
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (!showSuggestions) {
                setIsDropdownOpen(suggestionNames.length > 0);
                setActiveSuggestionIndex(suggestionNames.length > 0 ? suggestionNames.length - 1 : -1);
                return;
              }

              setActiveSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
              return;
            }

            if (event.key === 'Escape') {
              setIsDropdownOpen(false);
              setActiveSuggestionIndex(-1);
              return;
            }

            if (event.key === 'Enter') {
              if (showSuggestions && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                event.preventDefault();
                selectSuggestion(suggestions[activeSuggestionIndex]);
                if (onEnterKey && !onSuggestionSelect) {
                  onEnterKey();
                }
                return;
              }

              if (onEnterKey) {
                event.preventDefault();
                onEnterKey();
              }
            }
          }}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            showSuggestions && activeSuggestionIndex >= 0
              ? `${listboxId}-option-${activeSuggestionIndex}`
              : undefined
          }
          aria-invalid={hasVisibleError}
          className={[
            'w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 dark:bg-slate-950 dark:text-slate-100',
            hasVisibleError
              ? 'border-red-400 ring-red-500 focus:border-red-500 dark:border-red-700 dark:focus:border-red-500'
              : 'border-slate-300 ring-blue-500 dark:border-slate-700',
          ].join(' ')}
          required={required}
          disabled={disabled}
        />

        {showSuggestions && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/30">
            <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-2">
              {suggestions.map((suggestion, index) => {
                const isActive = index === activeSuggestionIndex;

                return (
                  <li key={suggestion.placeId} role="presentation">
                    <button
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSuggestion(suggestion);
                      }}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={[
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                        isActive
                          ? 'bg-blue-50 text-slate-950 dark:bg-blue-950/40 dark:text-white'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'mt-1 h-2.5 w-2.5 rounded-full',
                          isActive ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600',
                        ].join(' ')}
                      />
                      <span className="block text-sm font-medium leading-5">{suggestion.displayName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {!isLoading && errorText && (
        <p className="m-0 text-xs text-red-600 dark:text-red-400">{errorText}</p>
      )}

      {!errorText && helperText && (
        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}

      {isLoading && !errorText && (
        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Loading suggestions…</p>
      )}

      {!isLoading && !errorText && error && (
        <p className="m-0 text-xs text-amber-700 dark:text-amber-300">{error}</p>
      )}
    </div>
  );
}

export default AddressAutocompleteInput;
