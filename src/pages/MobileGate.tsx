import { useState, type ReactNode } from "react";
import { Check, Copy, Monitor, Smartphone } from "lucide-react";
import { useEverWide } from "../helpers/screen";
import "./MobileGate.css";

// Ourly runs on desktop browsers and (soon) as an iPhone app. On phone and
// tablet widths this screen replaces the app, in the landing page's look:
// dark, with the brand glows and glass cards. The app itself only mounts once
// the window has been wide enough, so phones never load it.
export default function MobileGate({ children }: Readonly<{ children: ReactNode }>) {
  const everWide = useEverWide();
  const [copied, setCopied] = useState(false);
  const { host, origin } = globalThis.location;

  // Clipboard can be refused; the address stays on screen to type by hand.
  const copy = () =>
    navigator.clipboard
      .writeText(origin)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));

  return (
    <>
      <main className="gate">
        <div className="gate-orb gate-orb-1" aria-hidden="true" />
        <div className="gate-orb gate-orb-2" aria-hidden="true" />
        <div className="gate-orb gate-orb-3" aria-hidden="true" />

        <div className="gate-inner">
          <img src="/ourly-logo-dark-sidebar.png" alt="Ourly" width={404} height={120} />
          <h1>
            Ourly is made for a <span className="gate-serif gate-grad-a">bigger</span>{" "}
            <span className="gate-serif gate-grad-b">screen.</span>
          </h1>
          <p className="gate-lead">
            The web version is designed for computers. Open it there to plan your goals, tasks and
            money together.
          </p>

          <ul className="gate-cards">
            <li className="gate-card">
              <span className="gate-icon gate-icon-white" aria-hidden="true">
                <Monitor size={22} />
              </span>
              <span className="gate-card-text">
                <strong>Open it on your computer</strong>
                <span>{host}</span>
              </span>
              <button type="button" className="gate-copy" onClick={() => void copy()}>
                {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </li>
            <li className="gate-card">
              <span className="gate-icon gate-icon-sage" aria-hidden="true">
                <Smartphone size={22} />
              </span>
              <span className="gate-card-text">
                <strong>Ourly for iPhone</strong>
                <span>We're building it now</span>
              </span>
              <span className="gate-soon">Coming soon</span>
            </li>
          </ul>
        </div>
      </main>
      {everWide && <div className="gate-app">{children}</div>}
    </>
  );
}
