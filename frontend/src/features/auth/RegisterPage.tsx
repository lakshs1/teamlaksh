import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/apiServices';
import { mapAuthUser } from '../../services/dataMappers';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('rep');
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
      const res = await authApi.register({ name, email, password, role });
      const user = mapAuthUser(res.data.user);
      const token = res.data.token;

      toast.success('Account created successfully!');
      setAuth(user, token);

      if (user.role === 'MANAGER') navigate('/dashboard');
      else if (user.role === 'ADMIN') navigate('/admin');
      else navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Registration failed';
      toast.error(msg);
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
        <Select label="Account Type" value={role} onChange={(e) => setRole(e.target.value)} options={[
          { value: 'rep', label: 'Sales Rep' },
          { value: 'manager', label: 'Sales Manager' },
          { value: 'finance', label: 'Finance' },
          { value: 'operations', label: 'Operations' },
        ]} />
        <Button type="submit" size="lg" fullWidth isLoading={isLoading}>Create Account</Button>
      </form>

      <div className={styles.footer}>
        Already have an account? <Link to="/auth/login" className={styles.link}>Sign in</Link>
      </div>
    </Card>
  );
}
