import { createApp } from 'vue';
import { createPinia } from 'pinia';

import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/oswald';
import '@fontsource-variable/jetbrains-mono';

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import '@/styles/theme.css';
import { registerServiceWorker } from '@/shared/lib/pwa/register-service-worker';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

app.mount('#app');

registerServiceWorker();
