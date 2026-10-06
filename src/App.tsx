import styled from '@emotion/styled';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import router from './router';
import store from './store';
import { ToastContainer } from 'react-toastify';
import theme from './theme';
import packageJson from '../package.json';

const VersionComponent = styled.div`
  position: fixed;
  bottom: 4px;
  right: 4px;
  font-size: 10px;
`;

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <ToastContainer
          position="bottom-right"
          limit={10}
          style={{ maxHeight: 'calc(100vh - 100px)' }}
        />
        <RouterProvider router={router} />
        <VersionComponent>UI version: {packageJson.version}</VersionComponent>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
