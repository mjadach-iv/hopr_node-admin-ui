import React from 'react';
import styled from '@emotion/styled';

import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { clipboardAvailable } from '../../utils/clipboard';

const SIconButton = styled(IconButton)`
  margin-left: 8px;
`;

function copy(copyText) {
  navigator.clipboard.writeText(copyText);
}

function CopyButton(props) {
  if (!clipboardAvailable) return null;
  return (
    <SIconButton
      color="primary"
      aria-label="upload picture"
      component="span"
      onClick={() => {
        copy(props.copy);
      }}
    >
      <ContentCopyIcon />
    </SIconButton>
  );
}

export default CopyButton;
