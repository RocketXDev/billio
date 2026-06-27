import { useEffect, useState } from "react";
import "./RotatingWord.css";

interface RotatingWordProps {
  words?: string[];
  intervalMs?: number;
  // "onDark" swaps in a warm gold/pink metallic gradient (matching the
  // landing page hero's accent text) for use on dark backgrounds — the
  // default indigo/violet gradient is tuned for light sections instead.
  // "plain" drops the gradient shimmer entirely and just shows solid white
  // text with the letter-by-letter flip-in (used on the About page, where
  // the gradient/background-clip effect hasn't rendered reliably).
  variant?: "default" | "onDark" | "plain";
}

const DEFAULT_WORDS = ["coaches", "instructors", "teachers", "tutors", "nannies", "therapists"];

export default function RotatingWord({
  words = DEFAULT_WORDS,
  intervalMs = 2200,
  variant = "default",
}: RotatingWordProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);

  const word = words[index];

  return (
    <span className="rotating-word-wrap">
      <span className={`rotating-word${variant === "onDark" ? " on-dark" : ""}${variant === "plain" ? " plain" : ""}`} aria-hidden="true">
        {word.split("").map((char, i) => (
          <span
            key={`${index}-${i}`}
            className="rotating-letter"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            {char}
          </span>
        ))}
      </span>
      <span className="visually-hidden">{words.join(", ")}</span>
    </span>
  );
}
