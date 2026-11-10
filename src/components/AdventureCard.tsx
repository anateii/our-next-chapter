import { ArrowRight } from "lucide-react";
import type { Adventure } from "../types";
import Countdown from "./Countdown";

// The featured goal: title, countdown, date and plan progress over its photo.
export default function AdventureCard({ adventure }: Readonly<{ adventure: Adventure }>) {
  return (
    <section className={adventure.image ? "adventure" : "adventure no-image"}>
      {adventure.image && <img src={adventure.image} alt="" width={2170} height={725} />}
      <div className="adventure-body">
        <p className="adventure-kicker">Our next adventure</p>
        <h2>{adventure.title}</h2>
        {adventure.subtitle && <p className="adventure-sub">{adventure.subtitle}</p>}
        <Countdown adventure={adventure} />
        <div className="adventure-progress">
          <div
            className="progress"
            role="progressbar"
            aria-label={`${adventure.title} plan progress`}
            aria-valuenow={adventure.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${adventure.progress}%` }} />
          </div>
          <span>{adventure.progress}% planned</span>
          <a className="round-link" href="#goals" aria-label={`Open the ${adventure.title} goal`}>
            <ArrowRight aria-hidden="true" size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
