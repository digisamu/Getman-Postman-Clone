type Props = {
  direction: "horizontal" | "vertical";
  onDrag: (clientPosition: number) => void;
  onReset?: () => void;
};

/** A drag handle between two panes. `horizontal` splits left/right, `vertical` splits top/bottom. */
export function Splitter({ direction, onDrag, onReset }: Props) {
  const horizontal = direction === "horizontal";

  function start(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    let frame = 0;
    const move = (moveEvent: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onDrag(horizontal ? moveEvent.clientX : moveEvent.clientY));
    };
    const end = () => {
      cancelAnimationFrame(frame);
      document.body.style.cursor = "";
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      onPointerDown={start}
      onDoubleClick={onReset}
      className={`group relative z-10 shrink-0 ${horizontal ? "-mx-[3px] w-[7px] cursor-col-resize" : "-my-[3px] h-[7px] cursor-row-resize"}`}
    >
      <div
        className={`absolute bg-line transition-colors group-hover:bg-accent group-active:bg-accent ${
          horizontal ? "inset-y-0 left-[3px] w-px" : "inset-x-0 top-[3px] h-px"
        }`}
      />
    </div>
  );
}
