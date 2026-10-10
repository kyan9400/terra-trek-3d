"use client";

/* Small-screen section menu. A disclosure button + a solid sheet under the header.
   Escape or a link closes it, focus moves in on open and back to the button on close,
   page scroll (native and Lenis) is locked while it is open, and everything outside
   the header is inert so screen-reader swipes stay in the sheet too. */

import { useCallback, useEffect, useRef, useState } from "react";

type Link = { href: string; label: string };

export default function MobileMenu({ links, cta }: { links: Link[]; cta: Link }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  const close = useCallback((returnFocus: boolean) => {
    restoreFocus.current = returnFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocus.current) buttonRef.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
      return;
    }
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const behind = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(panel ?? null) && el.tagName !== "SCRIPT",
    );
    behind.forEach((el) => (el.inert = true));

    // Lenis drives wheel scrolling itself, so overflow alone does not stop it
    const onWheel = (e: WheelEvent) => {
      (e as WheelEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
      if (!panel?.contains(e.target as Node) && e.cancelable) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Keep Tab inside the button + panel while the sheet covers the page
      const items = [buttonRef.current, ...panel.querySelectorAll<HTMLElement>("a")].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const wide = window.matchMedia("(min-width: 900px)");
    const onWide = () => {
      if (wide.matches) close(false);
    };

    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = prevOverflow;
      behind.forEach((el) => (el.inert = false));
      window.removeEventListener("wheel", onWheel, { capture: true });
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, close]);

  return (
    <div className="mobile-menu">
      <button
        ref={buttonRef}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
        <span>{open ? "Close" : "Menu"}</span>
      </button>

      <div
        ref={panelRef}
        id="mobile-menu-panel"
        className="menu-panel"
        data-open={open ? "" : undefined}
        data-lenis-prevent
      >
        <nav aria-label="Sections">
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => close(true)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a className="btn btn-ember menu-cta" href={cta.href} onClick={() => close(true)}>
          {cta.label}
        </a>
      </div>
    </div>
  );
}
