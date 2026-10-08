import { useEffect, useState, type JSX } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Card, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import styled from '@emotion/styled';

const StyledCard = styled(Card)`
  display: flex;
  flex-direction: column;
  width: 206px;
  font-size: 12px;
  border-radius: var(--radius);
  margin-right: 8px;
  padding: 8px;
  box-shadow: none;
  width: 300px;
  padding: 12px;
  &.blue {
    background-color: var(--surface);
  }
  &.pink {
    background-color: #ffe7e7;
  }
`;

const StyledChip = styled(Chip)`
  align-self: flex-start;
  font-weight: 700;
  min-width: 7rem;
  text-transform: uppercase;

  &.blue {
    background-color: var(--hopr-yellow);
    color: var(--hopr-dark-blue);
  }
  &.pink {
    background-color: #ffafa3;
    color: var(--text-2);
  }
`;

const StyledAccordion = styled(Accordion)`
  box-shadow: none;
  border: none;
  margin: 0;

  &::before {
    display: none;
  }

  &.Mui-expanded {
    margin: 0;
  }
`;

const SAccordionSummary = styled(AccordionSummary)`
  border-bottom: 1px solid var(--border);
  padding: 0;
  font-size: 11px;

  &.Mui-expanded {
    min-height: 48px;
  }
  &.blue {
    background-color: var(--surface);
  }
  &.pink {
    background-color: #ffe7e7;
  }
  .MuiAccordionSummary-content,
  .MuiAccordionSummary-content.Mui-expanded {
    margin: 4px 2px;
  }
`;

const Title = styled.h3`
  color: var(--text-2);
  font-weight: 700;
  margin: 0;
`;

const AccordionContent = styled(AccordionDetails)`
  margin: 0;
  padding: 0.75rem 0;

  &.blue {
    background-color: var(--surface);
  }
  &.pink {
    background-color: #ffe7e7;
  }
`;

const Content = styled.div`
  color: var(--text-2);
  overflow-wrap: break-word;

  a {
    color: var(--hopr-sky-blue);
    text-decoration: underline;
  }
`;

type FaqProps = {
  variant: 'blue' | 'pink';
  label: string;
  data: {
    id: number;
    title: string;
    content: string | JSX.Element;
  }[];
};

export default function FAQ({ variant, label, data }: FaqProps) {
  const [expandedId, set_expandedId] = useState<number | false>(false);

  useEffect(() => {
    set_expandedId(false);
  }, [data]);

  const handleAccordionClick = (id: number) => {
    set_expandedId((prevId) => {
      return prevId === id ? false : id;
    });
  };

  return (
    <StyledCard className={`Faq ${variant}`}>
      <StyledChip
        className={`Chip ${variant}`}
        label={label}
      />
      {data.map((faqItem) => (
        <StyledAccordion
          key={faqItem.id}
          expanded={expandedId === faqItem.id}
          onChange={() => handleAccordionClick(faqItem.id)}
        >
          <SAccordionSummary
            className={`SAccordionSummary ${variant}`}
            expandIcon={<ExpandMoreIcon />}
          >
            <Title>{faqItem.title}</Title>
          </SAccordionSummary>
          <AccordionContent className={`Content ${variant}`}>
            <Content>{faqItem.content}</Content>
          </AccordionContent>
        </StyledAccordion>
      ))}
    </StyledCard>
  );
}
