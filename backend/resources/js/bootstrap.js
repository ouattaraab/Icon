import axios from 'axios';
window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

// Connect WebSocket through the same host/port as the current page
// (nginx proxies /app to the Reverb server)
const wsHost = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
const wsPort = import.meta.env.VITE_REVERB_PORT || window.location.port || 80;
const wsScheme = import.meta.env.VITE_REVERB_SCHEME || window.location.protocol.replace(':', '');

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: wsHost,
    wsPort: wsScheme === 'https' ? 443 : wsPort,
    wssPort: wsScheme === 'https' ? 443 : wsPort,
    forceTLS: wsScheme === 'https',
    enabledTransports: ['ws', 'wss'],
});
