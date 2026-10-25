import styled from '@emotion/styled';
import Button from '@mui/material/Button';

export const Container = styled.div`
  height: 42px;
  display: flex;
  align-items: center;
  padding: 0 4px;
`;

export const SButton = styled(Button)`
  color: var(--primary);
  text-transform: none;
  white-space: nowrap;
  @media (max-width: 600px) {
    min-width: 0;
    .label {
      display: none;
    }
    .MuiButton-startIcon {
      margin: 0;
    }
  }
`;
