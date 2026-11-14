import type { ReactNode } from "react";
import { useEverWide } from "../helpers/screen";
import "./MobileGate.css";

// Ourly runs on desktop browsers and (soon) as a phone app. On phone and
// tablet widths this screen replaces the app, in the landing page's look:
// dark, with the brand glows. The app itself only mounts once the window has
// been wide enough, so phones never load it.
export default function MobileGate({ children }: Readonly<{ children: ReactNode }>) {
  const everWide = useEverWide();

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
            <span className="gate-serif gate-grad-b">screen</span>
          </h1>
          <p className="gate-lead">For now, it works on computers only</p>

          <div className="gate-stores">
            <p className="gate-divider">Mobile apps coming soon</p>
            {/* Not links yet: there is nothing to open until the apps ship */}
            <ul className="gate-badges">
              <li className="gate-badge">
                <img src="/apple-logo.svg" alt="" width={22} height={22} />
                <span>
                  <small>Coming soon on the</small>
                  <b>App Store</b>
                </span>
              </li>
              <li className="gate-badge">
                <img src="/play-logo.png" alt="" width={20} height={22} />
                <span>
                  <small>Coming soon on</small>
                  <b>Google Play</b>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
      {everWide && <div className="gate-app">{children}</div>}
    </>
  );
}
