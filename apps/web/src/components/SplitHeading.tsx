import { useMemo } from "react";

interface SplitHeadingProps {
  as?: "h1" | "h2";
  text: string;
  className?: string;
  wordClassName?: string;
  accentWords?: string[];
}

/**
 * Splits text into per-word spans for GSAP stagger reveals while keeping a
 * single unsplit accessible name (aria-label) for assistive tech, and
 * leaving the real text visible and readable with JavaScript disabled.
 */
export function SplitHeading({
  as = "h2",
  text,
  className,
  wordClassName = "word",
  accentWords = [],
}: SplitHeadingProps) {
  const words = useMemo(() => text.split(" "), [text]);
  const Tag = as;

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span
            key={i}
            className={accentWords.includes(word) ? `${wordClassName} accent-word` : wordClassName}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </Tag>
  );
}
