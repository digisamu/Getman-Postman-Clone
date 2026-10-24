import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

/** A floating panel anchored below an element. Closes on outside click, Escape, blur or resize. */
export function Popover({ anchor, open, onClose, children, align = "start", className = "menu" }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor || !panel.current) return;
    const rect = anchor.getBoundingClientRect();
    const width = panel.current.offsetWidth;
    const height = panel.current.offsetHeight;
    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
    setPosition({ top, left });
  }, [open, anchor, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panel}
      className={`${className} fade-in fixed`}
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, visibility: position ? "visible" : "hidden" }}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

type MenuItem =
  | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; shortcut?: string; checked?: boolean }
  | "separator";

export function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <>
      {items.map((item, index) =>
        item === "separator" ? (
          <div className="menu-sep" key={`sep-${index}`} />
        ) : (
          <button
            key={item.label}
            className="menu-item"
            data-danger={item.danger}
            role="menuitem"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span className="grid w-4 place-items-center text-muted">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.checked && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            {item.shortcut && <span className="text-2xs text-faint">{item.shortcut}</span>}
          </button>
        )
      )}
    </>
  );
}

/** Small helper for "button that opens a popover" state. */
export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return {
    anchor,
    open: Boolean(anchor),
    toggle: (element: HTMLElement) => setAnchor((current) => (current ? null : element)),
    close: () => setAnchor(null)
  };
}
