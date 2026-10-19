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

  // mounting the tooltip remounts the child, give focus back to the same element
  useEffect(() => {
    if (!active || !focusPath.current || !childRef.current) return;
    const target = focusPath.current.reduce<Element | undefined>((el, i) => el?.children[i], childRef.current);
    focusPath.current = null;
    (target as HTMLElement | undefined)?.focus({ preventScroll: true });
  }, [active]);

  if (props.open !== undefined) return <MuiTooltip {...props} />;

  if (!active) {
    const child = props.children as ReactElement<ChildProps>;
    const activate = () => {
      set_active(true);
      set_open(true);
    };
    // MUI Tooltip passes these on to the child too
    return cloneElement(child, {
      className: [props.className, child.props.className].filter(Boolean).join(' ') || undefined,
      style: props.style ? { ...props.style, ...child.props.style } : child.props.style,
      onMouseOver: (event: SyntheticEvent) => {
        child.props.onMouseOver?.(event);
        activate();
      },
      onFocus: (event: SyntheticEvent) => {
        child.props.onFocus?.(event);
        const target = event.target as Element;
        if (!target.matches?.(':focus-visible')) return;
        focusPath.current = pathFrom(event.currentTarget as Element, target);
        activate();
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
