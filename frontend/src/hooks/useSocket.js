import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (serverUrl = 'http://localhost:3001') => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(serverUrl);
    
    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [serverUrl]);

  return { socket, connected };
};