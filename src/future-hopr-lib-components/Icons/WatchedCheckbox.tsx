import { useId } from 'react';
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

// the ticked Material checkbox with an eye cut out where the tick would be
export default function WatchedCheckbox(props: SvgIconProps) {
  const maskId = `WatchedCheckboxMask${useId()}`;
  return (
    <SvgIcon {...props}>
      <defs>
        <mask id={maskId}>
          <rect
            width="24"
            height="24"
            fill="white"
          />
          <path
            d="M12 7.5c-3.3 0-5.9 2-7 4.5 1.1 2.5 3.7 4.5 7 4.5s5.9-2 7-4.5c-1.1-2.5-3.7-4.5-7-4.5z"
            fill="black"
          />
          <circle
            cx="12"
            cy="12"
            r="2.6"
            fill="white"
          />
          <circle
            cx="12"
            cy="12"
            r="1.2"
            fill="black"
          />
        </mask>
      </defs>
      <path
        mask={`url(#${maskId})`}
        d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2z"
      />
    </SvgIcon>
  );
}
