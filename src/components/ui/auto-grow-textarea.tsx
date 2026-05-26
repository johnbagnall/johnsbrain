"use client";
import * as React from "react";
import { Textarea, type TextareaProps } from "./textarea";

interface Props extends TextareaProps {
  /** Starting height in rows. */
  minRows?: number;
  /** Cap. Beyond this height, the textarea scrolls internally. */
  maxRows?: number;
}

/**
 * A textarea that resizes itself to fit its content, up to `maxRows`. Past the
 * cap it becomes scrollable instead of pushing the surrounding layout.
 */
export const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ minRows = 3, maxRows = 20, value, onChange, className, style, ...rest }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const cs = window.getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight) || 20;
      const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const maxPx = Math.round(lineHeight * maxRows + paddingY + borderY);
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxPx);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
    }, [maxRows]);

    // Re-measure when the value changes (controlled or after autofill).
    React.useEffect(() => {
      resize();
    }, [value, resize]);

    // Re-measure on viewport resize (font size / wrap changes).
    React.useEffect(() => {
      if (typeof window === "undefined") return;
      const handler = () => resize();
      window.addEventListener("resize", handler);
      return () => window.removeEventListener("resize", handler);
    }, [resize]);

    return (
      <Textarea
        ref={innerRef}
        rows={minRows}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          resize();
        }}
        className={`resize-none ${className ?? ""}`}
        style={style}
        {...rest}
      />
    );
  },
);
AutoGrowTextarea.displayName = "AutoGrowTextarea";
