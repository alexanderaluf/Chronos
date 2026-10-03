import { createContext, useContext, useEffect, useRef, type RefObject } from "react";
import { Keyboard, Platform, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/** Something on screen that can report its window frame (a field's container view). */
type Measurable = Pick<View, "measureInWindow">;

const RevealContext = createContext<(target: Measurable | null) => void>(() => undefined);

/**
 * For text fields: call with the field's container when it gains focus, and
 * the surrounding FormScreen scrolls it to the middle of the visible area.
 * Call with `null` on blur. Outside a FormScreen it does nothing.
 */
export function useRevealOnFocus() {
  return useContext(RevealContext);
}

export const RevealOnFocusProvider = RevealContext.Provider;

// Let Android finish resizing the screen for the keyboard before measuring.
const SETTLE_DELAY_MS = Platform.OS === "android" ? 80 : 0;

/**
 * FormScreen's half of the focus effect. It tracks the scroll offset and
 * content height, and when a field is revealed (or the keyboard finishes
 * opening for it) scrolls so the field is centered between the top of the
 * visible area and the keyboard or Save dock. Animated unless Reduce Motion is on.
 */
export function useFocusScroll({ scrollRef, topInset, bottomClearance }: {
  scrollRef: RefObject<ScrollView | null>;
  /** Height covered by the floating header (and pinned control) at the top. */
  topInset: number;
  /** Height covered by the floating Save dock above the keyboard / screen bottom. */
  bottomClearance: number;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const focused = useRef<Measurable | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layout = useRef({ topInset, bottomClearance, windowHeight, reduceMotion });
  useEffect(() => {
    layout.current = { topInset, bottomClearance, windowHeight, reduceMotion };
  });

  function scrollToFocused() {
    const target = focused.current;
    const scroll = scrollRef.current;
    const scrollView = scroll?.getNativeScrollRef();
    if (!target || !scroll || !scrollView) return;
    const { topInset: top, bottomClearance: bottom, windowHeight: screen, reduceMotion: still } = layout.current;
    scrollView.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
      target.measureInWindow((_x, targetTop, _w, targetHeight) => {
        const keyboardTop = Keyboard.isVisible() ? Keyboard.metrics()?.screenY ?? screen : screen;
        const visibleTop = scrollTop + top;
        const visibleBottom = Math.min(scrollTop + scrollHeight, keyboardTop) - bottom;
        const space = visibleBottom - visibleTop;
        // Center the field; a field taller than the space starts at the top.
        const desiredTop = targetHeight >= space ? visibleTop + 8 : visibleTop + (space - targetHeight) / 2;
        // iOS adds the keyboard as a bottom inset (automaticallyAdjustKeyboardInsets), so it can scroll further.
        const keyboardInset = Platform.OS === "ios" ? Math.max(0, scrollTop + scrollHeight - keyboardTop) : 0;
        const maxOffset = Math.max(0, contentHeight.current - scrollHeight + keyboardInset);
        const next = Math.min(Math.max(0, offset.current + targetTop - desiredTop), maxOffset);
        if (Math.abs(next - offset.current) > 2) scroll.scrollTo({ y: next, animated: !still });
      });
    });
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => requestAnimationFrame(scrollToFocused), SETTLE_DELAY_MS);
  }

  // Subscribe once: `schedule` only reads refs, and a re-render must not cancel a pending scroll.
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", schedule);
    return () => {
      shown.remove();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reveal(target: Measurable | null) {
    focused.current = target;
    if (!target) return;
    // Already open (moving between fields): scroll now. Otherwise wait for keyboardDidShow.
    if (Keyboard.isVisible()) schedule();
  }

  return {
    reveal,
    scrollProps: {
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = event.nativeEvent.contentOffset.y;
      },
      onContentSizeChange: (_width: number, height: number) => {
        contentHeight.current = height;
      },
    },
  };
}
