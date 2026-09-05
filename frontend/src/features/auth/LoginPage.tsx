import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/apiServices';
import { mapAuthUser } from '../../services/dataMappers';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email address';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const user = mapAuthUser(res.data.user);
      const token = res.data.token;

      toast.success('Logged in successfully!');
      setAuth(user, token);

      if (redirectTo) navigate(redirectTo);
      else if (user.role === 'customer') navigate('/portal');
      else if (user.role === 'MANAGER') navigate('/dashboard');
      else if (user.role === 'ADMIN') navigate('/admin');
      else navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.demoLogin(role);
      const user = mapAuthUser(res.data.user);
      const token = res.data.token;

      toast.success(`Logged in as ${role}!`);
      setAuth(user, token);

      if (user.role === 'MANAGER') navigate('/dashboard');
      else if (user.role === 'ADMIN') navigate('/admin');
      else navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Demo login failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const quickFill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  return (
    <Card className={styles.card} variant="bordered" padding="lg">
      <div className={styles.header}>
        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.subtitle}>Log in to access your account</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.demoSection}>
          <span className={styles.demoLabel}>Demo Quick-Fill:</span>
          <div className={styles.demoButtons}>
            <button type="button" className={styles.demoChip} onClick={() => quickFill('user@demo.com')}>👤 User</button>
            <button type="button" className={styles.demoChip} onClick={() => quickFill('manager@demo.com')}>📊 Manager</button>
            <button type="button" className={styles.demoChip} onClick={() => quickFill('admin@demo.com')}>👑 Admin</button>
          </div>
        </div>

        <Input label="Email Address" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />

        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            rightIcon={
              <button type="button" className={styles.togglePassBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? '👁️' : '🙈'}
              </button>
            }
          />
        </div>

        <Button type="submit" size="lg" fullWidth isLoading={isLoading}>Sign In</Button>
      </form>

      <div className={styles.footer}>
        Don't have an account? <Link to="/auth/register" className={styles.link}>Register here</Link>
      </div>
    </Card>
  );
}
