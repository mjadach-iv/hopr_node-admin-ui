import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type SyntheticEvent,
} from 'react';
import MuiTooltip, { TooltipProps } from '@mui/material/Tooltip';

type ChildProps = {
  className?: string;
  style?: CSSProperties;
  onMouseOver?: (event: SyntheticEvent) => void;
  onFocus?: (event: SyntheticEvent) => void;
};

// child indexes from root down to node, to find the same element after a remount
const pathFrom = (root: Element, node: Element) => {
  const path: number[] = [];
  for (let el = node; el !== root && el.parentElement; el = el.parentElement) {
    path.unshift(Array.from(el.parentElement.children).indexOf(el));
  }
  return path;
};

/**
 * MUI Tooltip that mounts on the first hover or keyboard focus of its child.
 * Tables render hundreds of tooltips and mounting them all up front is slow.
 */
const LazyTooltip = (props: TooltipProps) => {
  const [active, set_active] = useState(false);
  const [open, set_open] = useState(false);
  const childRef = useRef<Element>(null);
  const focusPath = useRef<number[] | null>(null);
  const hovered = useRef(false);

  // mounting the tooltip remounts the child, give focus back to the same element
  useEffect(() => {
    if (!active || !focusPath.current || !childRef.current) return;
    const target = focusPath.current.reduce<Element | undefined>((el, i) => el?.children[i], childRef.current);
    focusPath.current = null;
    (target as HTMLElement | undefined)?.focus({ preventScroll: true });
  }, [active]);

  // the remounted child gets no mouseleave if the pointer left it before moving again
  useEffect(() => {
    if (!active || !hovered.current) return;
    hovered.current = false;
    const timer = setTimeout(() => set_open(true), props.enterDelay ?? 100);
    const onMouseOver = (event: MouseEvent) => {
      document.removeEventListener('mouseover', onMouseOver, true);
      clearTimeout(timer);
      // inside, MUI sees this mouseover and takes over
      if (!childRef.current?.contains(event.target as Node)) set_open(false);
    };
    document.addEventListener('mouseover', onMouseOver, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseover', onMouseOver, true);
    };
  }, [active]);

  if (props.open !== undefined) return <MuiTooltip {...props} />;

  if (!active) {
    const child = props.children as ReactElement<ChildProps>;
    // MUI Tooltip passes these on to the child too
    return cloneElement(child, {
      className: [props.className, child.props.className].filter(Boolean).join(' ') || undefined,
      style: props.style ? { ...props.style, ...child.props.style } : child.props.style,
      onMouseOver: (event: SyntheticEvent) => {
        child.props.onMouseOver?.(event);
        hovered.current = true;
        set_active(true);
      },
      onFocus: (event: SyntheticEvent) => {
        child.props.onFocus?.(event);
        const target = event.target as Element;
        if (!target.matches?.(':focus-visible')) return;
        focusPath.current = pathFrom(event.currentTarget as Element, target);
        set_active(true);
        set_open(true);
      },
    });
  }

  return (
    <MuiTooltip
      {...props}
      ref={childRef}
      open={open}
      onOpen={(event) => {
        set_open(true);
        props.onOpen?.(event);
      }}
      onClose={(event) => {
        set_open(false);
        props.onClose?.(event);
      }}
    />
  );
};

export default LazyTooltip;
