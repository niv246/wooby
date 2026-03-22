import { io } from 'socket.io-client';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
});

export default socket;
