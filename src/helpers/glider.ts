// Sliding highlight for tab bars and view toggles: instead of each button
// painting its own "selected" background, one highlight per group glides to
// the pressed button. It reads the DOM (aria-pressed), so every existing tab
// bar gets it without changes. The highlight itself is CSS (.has-glider::before
// in index.css), placed with --gx/--gy/--gw/--gh on the group.
const GROUPS = ".segmented, .mini-seg, .view-toggle";

const sized = new WeakSet<Element>();
let frame = 0;

const resize = new ResizeObserver((entries) => {
  for (const e of entries) place(e.target as HTMLElement);
});

function place(group: HTMLElement) {
  if (!group.classList.contains("has-glider")) group.classList.add("has-glider");
  const on = group.querySelector<HTMLElement>(':scope > [aria-pressed="true"]');
  const s = group.style;
  if (!on) {
    s.setProperty("--go", "0");
    return;
  }
  s.setProperty("--go", "1");
  s.setProperty("--gx", `${on.offsetLeft}px`);
  s.setProperty("--gy", `${on.offsetTop}px`);
  s.setProperty("--gw", `${on.offsetWidth}px`);
  s.setProperty("--gh", `${on.offsetHeight}px`);
  // First placement jumps; only later moves glide.
  if (!group.classList.contains("glider-ready"))
    requestAnimationFrame(() => group.classList.add("glider-ready"));
}

function placeAll() {
  frame = 0;
  for (const g of document.querySelectorAll<HTMLElement>(GROUPS)) {
    place(g);
    if (!sized.has(g)) {
      sized.add(g);
      resize.observe(g);
    }
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(placeAll);
};

export function startGlider() {
  // New tab bars mount and pressed buttons change as React renders.
  new MutationObserver(schedule).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-pressed"],
  });
  // Web fonts change button widths once they load.
  void document.fonts?.ready.then(schedule);
  schedule();
}
