import { Heart } from "lucide-react";

export default function QuoteCard() {
  return (
    <figure className="quote-card">
      <span className="quote-mark" aria-hidden="true">
        “
      </span>
      <blockquote>A life we love, built together.</blockquote>
      <Heart className="quote-heart" aria-hidden="true" size={26} fill="currentColor" />
    </figure>
  );
}
