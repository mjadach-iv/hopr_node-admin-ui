import React from 'react';
import styled from '@emotion/styled';

export const Tables = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  .mobile-only {
    display: none;
  }
  @media only screen and (max-width: 820px) {
    flex-direction: column;
    gap: 0px;
    .not-on-mobile {
      display: none;
    }
    .mobile-only {
      display: table;
    }
  }
`;

export const Table = styled.table`
  font-family: var(--font-sans);
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  th {
    text-align: left;
    vertical-align: top;
    font-weight: 450;
    color: var(--text-2);
  }
  td {
    color: var(--text);
    font-weight: 550;
  }
  tr {
    border-top: 1px solid var(--border);
  }
  th,
  td {
    padding: 8px 8px 8px 0;
  }
  td {
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  th {
    overflow-wrap: break-word;
  }
  th:first-of-type {
    width: ${(props) => (props.width1stColumn ? props.width1stColumn : '160')}px;
  }
  &.table-has-title {
    tr:first-of-type {
      border-top: 1px solid var(--border);
    }
  }
  ${(props) => props.noTopBorder && `tr:first-of-type { border-top: none; }`};

  @media screen and (max-width: 992px) {
    tr {
      display: flex;
      flex-direction: column;
    }
    th:first-of-type {
      padding-top: 12px;
      padding-bottom: 0px;
    }
    td {
      padding-top: 2px;
    }
  }
`;

const Content = styled.div`
  color: var(--text);
  width: 100%;
  .title {
    display: flex;
    align-items: center;
    height: 40px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
`;

export function TableExtended(props) {
  return (
    <Content style={props.style}>
      {props.title && <div className="title">{props.title}</div>}
      <Table
        className="table-has-title"
        width1stColumn={props.width1stColumn}
      >
        {props.children}
      </Table>
    </Content>
  );
}

// elemet should accept only <tbody>
export default function TableDataColumed(props) {
  return (
    <Tables className={['columned-data'].join(' ')}>
      {props.children.length > 0 ? (
        props.children?.map((elem, key) => {
          return (
            <Table
              className="not-on-mobile"
              width1stColumn={props.width1stColumn}
              key={key}
            >
              {elem}
            </Table>
          );
        })
      ) : (
        <Table>{props.children}</Table>
      )}
      <Table className="mobile-only">{props.children.length > 0 && props.children?.map((elem) => elem)}</Table>
    </Tables>
  );
}
