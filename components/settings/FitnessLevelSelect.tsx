"use client";

import { useState, useRef, useEffect } from "react";

interface FitnessLevel {
  value: string;
  label: string;
  description: string;
}

const FITNESS_LEVELS: FitnessLevel[] = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Less than 3,000 steps per day, minimal physical activity",
  },
  {
    value: "lightly_active",
    label: "Lightly Active",
    description: "3,000-7,500 steps per day, light exercise 1-3 days/week",
  },
  {
    value: "moderately_active",
    label: "Moderately Active",
    description: "7,500-10,000 steps per day, moderate exercise 3-5 days/week",
  },
  {
    value: "very_active",
    label: "Very Active",
    description: "10,000+ steps per day, intense exercise 6-7 days/week",
  },
  {
    value: "extremely_active",
    label: "Extremely Active",
    description: "Heavy physical activity or workout every day, physically demanding job",
  },
];

interface FitnessLevelSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FitnessLevelSelect({ value, onChange }: FitnessLevelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLevel = FITNESS_LEVELS.find((level) => level.value === value) || FITNESS_LEVELS[2];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (levelValue: string) => {
    onChange(levelValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 text-left bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-sm">{selectedLevel.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedLevel.description}
            </div>
          </div>
          <svg
            className={`ml-2 h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-96 overflow-auto">
          <ul className="py-1" role="listbox">
            {FITNESS_LEVELS.map((level) => (
              <li
                key={level.value}
                role="option"
                aria-selected={level.value === value}
                onClick={() => handleSelect(level.value)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  level.value === value
                    ? "bg-indigo-50 dark:bg-indigo-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium ${
                        level.value === value
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {level.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {level.description}
                    </div>
                  </div>
                  {level.value === value && (
                    <svg
                      className="ml-2 h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
