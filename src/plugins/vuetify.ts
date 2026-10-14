import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

import { createVuetify } from 'vuetify';

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
  },
  defaults: {
    VBtn: {
      rounded: 'lg',
    },
    VSlider: {
      color: 'primary',
      trackColor: 'rgba(255,255,255,0.18)',
      thumbSize: 16,
    },
    VSnackbar: {
      rounded: 'lg',
      location: 'bottom',
    },
    VTooltip: {
      location: 'bottom',
      openDelay: 350,
    },
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#0a0a0b',
          surface: '#141416',
          'surface-variant': '#26262a',
          'on-surface-variant': '#f5f5f7',
          primary: '#d4ff3f',
          'on-primary': '#0a0a0b',
          secondary: '#26262a',
          error: '#ff5a5f',
          success: '#3ddc97',
          'on-background': '#f5f5f7',
          'on-surface': '#f5f5f7',
        },
      },
    },
  },
});
