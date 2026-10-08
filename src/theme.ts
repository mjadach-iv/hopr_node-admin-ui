import { createTheme } from '@mui/material';

// HOPR palette, see the tokens in index.css
const theme = createTheme({
  typography: {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
  },
  shape: { borderRadius: 10 },
  palette: {
    mode: 'dark',
    primary: { main: '#ffffa0', contrastText: '#000050' },
    secondary: { main: '#b4f0ff', contrastText: '#000050' },
    background: { default: '#04052a', paper: '#0a0c3a' },
    text: { primary: '#f1f3fd', secondary: '#c9d1ee' },
    divider: '#1d2266',
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12, backgroundColor: '#1b2170', color: '#f1f3fd', padding: '6px 8px' },
      },
    },
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
  },
});

export default theme;
