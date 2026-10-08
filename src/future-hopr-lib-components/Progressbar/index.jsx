import React from 'react';
import styled from '@emotion/styled';

// compact meter: a thin bar followed by the percentage
const Meter = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 96px;
  .track {
    position: relative;
    flex: 0 0 48px;
    height: 6px;
    border-radius: 3px;
    background: var(--border);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 3px;
  }
  .red {
    background-color: var(--red);
  }
  .orange {
    background-color: #f79009;
  }
  .green {
    background-color: #17b26a;
  }
  .value {
    font-variant-numeric: tabular-nums;
    min-width: 40px;
    text-align: right;
  }
`;

function ProgressBar(props) {
  function percentage() {
    if (!props.value) return '0%';
    if (props.value > 1) return '100%';
    return `${Math.round(props.value * 1000) / 10}%`;
  }

  function color() {
    if (!props.value || props.value <= 0.25) return 'red';
    if (props.value <= 0.76) return 'orange';
    return 'green';
  }

  return (
    <Meter className="ProgressBar">
      <div className="track">
        <div
          className={`fill ${color()}`}
          style={{ width: percentage() }}
        />
      </div>
      <span className="value">{percentage()}</span>
    </Meter>
  );
}

export default ProgressBar;
