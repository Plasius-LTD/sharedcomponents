import {
  useId,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import styles from "./StarRating.module.css";

/** The closed value range accepted by the star control. */
export type StarRatingValue = 1 | 2 | 3 | 4 | 5;

/** Exactly five caller-translated labels, ordered from one to five. */
export type StarRatingLabels = readonly [
  string,
  string,
  string,
  string,
  string,
];

export interface StarRatingProps {
  /** Visible legend and accessible radiogroup name. */
  label: string;
  /** Caller-translated meanings for values one through five. */
  labels: StarRatingLabels;
  /** Controlled selection, or null while no value is selected. */
  value: StarRatingValue | null;
  /** Receives pointer and keyboard selection changes. */
  onChange: (value: StarRatingValue) => void;
  /** Native form field name. A generated name is used when omitted. */
  name?: string;
  /** Optional stable id prefix. */
  id?: string;
  /** Marks the group required for assistive technology and native forms. */
  required?: boolean;
  /** Prevents focus and changes. */
  disabled?: boolean;
  /** Keeps the selected value focusable while preventing changes. */
  readOnly?: boolean;
  /** Optional class applied to the fieldset. */
  className?: string;
}

const ratingValues = [1, 2, 3, 4, 5] as const;

function isNavigationKey(key: string): boolean {
  return [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ].includes(key);
}

function nextValueForKey(
  current: StarRatingValue,
  key: string,
): StarRatingValue {
  if (key === "Home") {
    return 1;
  }
  if (key === "End") {
    return 5;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return (current === 1 ? 5 : current - 1) as StarRatingValue;
  }
  return (current === 5 ? 1 : current + 1) as StarRatingValue;
}

/** Accessible, controlled one-to-five star radiogroup. */
export function StarRating({
  label,
  labels,
  value,
  onChange,
  name,
  id,
  required = false,
  disabled = false,
  readOnly = false,
  className,
}: StarRatingProps) {
  const generatedId = useId();
  const idPrefix = id ?? `star-rating-${generatedId}`;
  const fieldName = name ?? idPrefix;
  const legendId = `${idPrefix}-legend`;
  const selectedTextId = `${idPrefix}-selected`;
  const selectedText = useMemo(
    () => (value === null ? null : `${value} / 5 — ${labels[value - 1]}`),
    [labels, value],
  );

  const select = (
    nextValue: StarRatingValue,
    target?: HTMLInputElement,
  ) => {
    if (disabled || readOnly) {
      return;
    }
    onChange(nextValue);
    target?.focus();
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
    nextValue: StarRatingValue,
  ) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    select(nextValue);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    current: StarRatingValue,
  ) => {
    if (!isNavigationKey(event.key)) {
      return;
    }
    event.preventDefault();
    if (disabled || readOnly) {
      return;
    }
    const nextValue = nextValueForKey(current, event.key);
    const nextInput = document.getElementById(
      `${idPrefix}-${nextValue}`,
    ) as HTMLInputElement | null;
    select(nextValue, nextInput ?? undefined);
  };

  return (
    <fieldset
      className={[styles.fieldset, className].filter(Boolean).join(" ")}
      disabled={disabled}
    >
      <legend id={legendId} className={styles.legend}>
        {label}
      </legend>
      <div
        className={styles.radiogroup}
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={selectedText ? selectedTextId : undefined}
        aria-required={required}
        aria-readonly={readOnly || undefined}
      >
        {ratingValues.map((rating) => {
          const checked = value === rating;
          const filled = value !== null && rating <= value;
          const inputId = `${idPrefix}-${rating}`;
          return (
            <span className={styles.option} key={rating}>
              <input
                id={inputId}
                className={styles.input}
                type="radio"
                role="radio"
                name={fieldName}
                value={rating}
                checked={checked}
                required={required}
                disabled={disabled}
                tabIndex={
                  value === null ? (rating === 1 ? 0 : -1) : checked ? 0 : -1
                }
                aria-label={`${rating}: ${labels[rating - 1]}`}
                aria-checked={checked}
                onChange={(event) => handleChange(event, rating)}
                onClick={(event) => {
                  if (readOnly) {
                    event.preventDefault();
                  }
                }}
                onKeyDown={(event) => handleKeyDown(event, rating)}
              />
              <label
                htmlFor={inputId}
                className={[
                  styles.star,
                  filled ? styles.filled : undefined,
                  checked ? styles.selected : undefined,
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden="true"
              >
                {filled ? "★" : "☆"}
              </label>
            </span>
          );
        })}
      </div>
      {selectedText ? (
        <output id={selectedTextId} className={styles.selectedText}>
          {selectedText}
        </output>
      ) : null}
    </fieldset>
  );
}

export default StarRating;
