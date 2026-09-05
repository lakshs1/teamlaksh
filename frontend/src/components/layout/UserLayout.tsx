import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import OdooNavbar from './OdooNavbar';
import { useAuthStore } from '../../stores/authStore';

export default function UserLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'customer') {
      const target = (user as any).portal_token || (user as any).portalToken ? `/portal/${(user as any).portal_token || (user as any).portalToken}` : '/portal';
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <OdooNavbar />
      <main style={{ padding: '1.5rem', maxWidth: 1280, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
