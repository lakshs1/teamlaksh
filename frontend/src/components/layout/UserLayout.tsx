import { Outlet } from 'react-router-dom';
import OdooNavbar from './OdooNavbar';

export default function UserLayout() {
  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <OdooNavbar />
      <main style={{ padding: '1.5rem', maxWidth: 1280, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
