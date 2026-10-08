import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import Tooltip from '../../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';

/** Masonry of cards: 1-3 columns depending on the width, cards never split. */
export const CardGrid = styled.div`
  width: 100%;
  columns: 360px 3;
  column-gap: 12px;
  & > * {
    break-inside: avoid;
    display: inline-block;
    width: 100%;
    margin-bottom: 12px;
  }
`;

const SCard = styled.section`
  box-sizing: border-box;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0 14px 6px;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 40px;
    h3 {
      margin: 0;
      font-size: 12px;
      font-weight: 650;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .extra {
      color: var(--muted);
      font-size: 12px;
      a:hover {
        color: var(--primary);
        text-decoration: underline;
      }
    }
  }
`;

export const Card = ({ title, extra, children }: { title: ReactNode; extra?: ReactNode; children: ReactNode }) => (
  <SCard className="InfoCard">
    <header>
      <h3>{title}</h3>
      {extra && <span className="extra">{extra}</span>}
    </header>
    {children}
  </SCard>
);

const SKV = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 30px;
  border-top: 1px solid var(--border);
  .k {
    flex: 0 0 auto;
    color: var(--text-2);
    cursor: default;
  }
  .v {
    min-width: 0;
    display: block;
    text-align: right;
    font-weight: 550;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    .unit {
      color: var(--muted);
      font-weight: 450;
    }
    .sub {
      color: var(--muted);
      font-weight: 450;
      font-size: 0.85em;
    }
  }
  .v.mono {
    font-family: var(--font-mono);
    font-weight: 450;
    font-size: 12.5px;
  }
  .v > span:not(.unit):not(.sub) {
    vertical-align: middle;
  }
  .unit,
  .sub {
    margin-left: 3px;
  }
  .sub + * {
    margin-left: 3px;
  }
  .MuiIconButton-root {
    margin-left: 2px;
    width: 22px;
    height: 22px;
    svg {
      width: 15px;
      height: 15px;
      color: var(--muted);
    }
  }
`;

/** One labelled value; the label explains itself in a tooltip. */
export const KV = ({
  label,
  tip,
  children,
  mono,
  title,
}: {
  label: ReactNode;
  tip?: ReactNode;
  children: ReactNode;
  mono?: boolean;
  // full value shown on hover when the cell is shortened
  title?: string;
}) => (
  <SKV className="KV">
    <Tooltip
      title={tip ?? ''}
      notWide
      placement="left"
    >
      <span className="k">{label}</span>
    </Tooltip>
    <Tooltip title={title ?? ''}>
      <span className={`v ${mono ? 'mono' : ''}`}>{children ?? '-'}</span>
    </Tooltip>
  </SKV>
);

export const Amount = ({ value, unit }: { value: ReactNode; unit: string }) => (
  <>
    {value}
    <span className="unit">{unit}</span>
  </>
);

const SStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  border-top: 1px solid var(--border);
  padding: 8px 0 6px;
  gap: 4px;
`;

const SStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
  .label {
    font-size: 11.5px;
    color: var(--muted);
  }
  .value {
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.01em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  a.value:hover {
    color: var(--primary-2);
  }
  .meter {
    height: 4px;
    width: 80%;
    max-width: 96px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
    span {
      display: block;
      height: 100%;
      border-radius: 2px;
    }
  }
`;

const meterColor = (share: number) => (share <= 0.25 ? 'var(--red)' : share <= 0.76 ? '#f79009' : '#17b26a');

export const Stats = ({ children }: { children: ReactNode }) => <SStats className="Stats">{children}</SStats>;

export const Stat = ({
  label,
  value,
  tip,
  to,
  meter,
}: {
  label: string;
  value: ReactNode;
  tip?: string;
  to?: string;
  // 0-1, drawn as a thin bar under the value
  meter?: number | null;
}) => (
  <Tooltip
    title={tip ?? ''}
    notWide
  >
    <SStat className="Stat">
      <span className="label">{label}</span>
      {to ? (
        <Link
          className="value"
          to={to}
        >
          {value}
        </Link>
      ) : (
        <span className="value">{value}</span>
      )}
      {typeof meter === 'number' && (
        <span className="meter">
          <span style={{ width: `${Math.min(meter, 1) * 100}%`, background: meterColor(meter) }} />
        </span>
      )}
    </SStat>
  </Tooltip>
);

const SKpiGrid = styled.div`
  width: 100%;
  container-type: inline-size;
  margin-bottom: 12px;
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @container (min-width: 620px) {
    .kpi-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
  }
  @container (min-width: 1360px) {
    .kpi-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }
`;

/** Row of headline figures at the top of the page. */
export const KpiGrid = ({ children }: { children: ReactNode }) => (
  <SKpiGrid>
    <div className="kpi-grid">{children}</div>
  </SKpiGrid>
);

const SKpi = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  .label {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .value {
    font-size: 21px;
    font-weight: 650;
    letter-spacing: -0.02em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    .unit {
      margin-left: 4px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0;
      color: var(--muted);
    }
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &.highlight {
    border-color: rgba(255, 255, 122, 0.35);
    background: linear-gradient(180deg, rgba(255, 255, 122, 0.08), rgba(255, 255, 122, 0) 70%), var(--surface);
  }
  &.tone-green .value {
    color: var(--green);
  }
  &.tone-orange .value {
    color: var(--orange);
  }
  &.tone-red .value {
    color: var(--red);
  }
  a.value:hover {
    color: var(--primary);
  }
`;

export const Kpi = ({
  label,
  value,
  unit,
  sub,
  tip,
  to,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tip?: ReactNode;
  to?: string;
  className?: string;
}) => {
  const content = (
    <>
      {value}
      {unit && <span className="unit">{unit}</span>}
    </>
  );
  return (
    <Tooltip
      title={tip ?? ''}
      notWide
    >
      <SKpi className={`Kpi ${className ?? ''}`}>
        <span className="label">{label}</span>
        {to ? (
          <Link
            className="value"
            to={to}
          >
            {content}
          </Link>
        ) : (
          <span className="value">{content}</span>
        )}
        {sub && <span className="sub">{sub}</span>}
      </SKpi>
    </Tooltip>
  );
};
