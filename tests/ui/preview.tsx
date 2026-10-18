import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import LoadingScreen from '../../src/components/LoadingScreen';
import { DialogProvider } from '../../src/components/DialogProvider';
import { SessionProvider } from './session';
import '../../src/index.css';

localStorage.clear();
if (new URLSearchParams(location.search).get('scenario') !== 'login') {
  localStorage.setItem('coup_session_token', 'player1');
  localStorage.setItem('coup_player_name', 'ผู้เล่นทดสอบ');
  if (new URLSearchParams(location.search).get('scenario') !== 'lobby') localStorage.setItem('coup_current_room', 'TEST');
}
const params = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(<StrictMode><DialogProvider><SessionProvider>{params.get('scenario') === 'loading-preview'
  ? <LoadingScreen progress={Number(params.get('progress') ?? 50)} detail="เตรียมภาพและข้อมูลสำหรับเข้าเกม" />
  : <App />}</SessionProvider></DialogProvider></StrictMode>);
