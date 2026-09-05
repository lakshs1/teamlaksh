import { useState } from 'react';
import toast from 'react-hot-toast';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email] = useState(user?.email ?? '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with real API call
      if (user) setUser({ ...user, name });
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Manage your account information.</p>
      </div>

      <Card variant="bordered" padding="lg" className={styles.profileCard}>
        <div className={styles.avatarSection}>
          <Avatar name={user?.name} src={user?.avatar} size="lg" />
          <div>
            <div className={styles.profileName}>{user?.name}</div>
            <div className={styles.profileRole}>{user?.role}</div>
          </div>
        </div>

        <div className={styles.form}>
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email Address" value={email} disabled helperText="Email cannot be changed" />
          <div className={styles.actions}>
            <Button onClick={handleSave} isLoading={isLoading}>Save Changes</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
