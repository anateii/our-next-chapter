import { ArrowRight } from "lucide-react";
import thailand from "../assets/thailand.png";
import type { Adventure } from "../types";

export default function AdventureCard({ adventure }: Readonly<{ adventure: Adventure }>) {
  return (
    <section className="adventure">
      <img
        src={thailand}
        alt="Limestone cliffs and longtail boats on a turquoise bay in Thailand"
        width={2170}
        height={725}
      />
      <div className="adventure-body">
        <p className="adventure-kicker">Our next adventure</p>
        <h2>{adventure.title}</h2>
        <p className="adventure-sub">{adventure.subtitle}</p>
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
          <span>{adventure.progress}%</span>
          <a className="round-link" href="#goals" aria-label={`Open the ${adventure.title} goal`}>
            <ArrowRight aria-hidden="true" size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
