import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/authStore';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email address';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // TODO: Replace with real API call
      const mockUser = {
        id: 'user_' + Math.random().toString(36).substring(2, 9),
        name,
        email,
        role: role as 'USER' | 'MANAGER' | 'ADMIN',
        status: 'ACTIVE' as const,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      toast.success('Account created successfully!');
      setAuth(mockUser, 'mock_jwt_' + Date.now());

      if (role === 'MANAGER') navigate('/dashboard');
      else if (role === 'ADMIN') navigate('/admin');
      else navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={styles.card} variant="bordered" padding="lg">
      <div className={styles.header}>
        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.subtitle}>Get started with your free account</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Input label="Full Name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Email Address" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Select label="Account Type" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: 'USER', label: 'User' }, { value: 'MANAGER', label: 'Manager' }]} />
        <Button type="submit" size="lg" fullWidth isLoading={isLoading}>Create Account</Button>
      </form>

      <div className={styles.footer}>
        Already have an account? <Link to="/auth/login" className={styles.link}>Sign in</Link>
      </div>
    </Card>
  );
}
