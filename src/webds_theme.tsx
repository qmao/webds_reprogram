import { createTheme } from "@mui/material/styles";

const webdsTheme = createTheme({
  palette: {
    primary: {
      light: '#5aacf6',
      main: '#007dc3',
      dark: '#005192',
      contrastText: '#fff'
    }
  },

  typography: {
    fontFamily: [
      'Arial',
      'Roboto',
      'Helvetica',
      'sans-serif'
    ].join(','),
  },

  components: {
    MuiAvatar: {
      defaultProps: {
        sx: {bgcolor: '#007dc3'}
      }
    },
    MuiButton: {
      defaultProps: {
        variant: 'contained'
      }
    },
    MuiFab: {
      defaultProps: {
        color: 'primary',
        size: 'small'
      }
    }
  },
});

export default webdsTheme