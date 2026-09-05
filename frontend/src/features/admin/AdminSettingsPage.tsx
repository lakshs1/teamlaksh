import { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Toggle } from '../../components/ui/Toggle';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import toast from 'react-hot-toast';
import styles from './AdminSettingsPage.module.css';

export default function AdminSettingsPage() {
  const [appName, setAppName] = useState('AppName');
  const [description, setDescription] = useState('A hackathon-ready frontend template.');
  const [defaultRole, setDefaultRole] = useState('USER');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Configure application preferences.</p>
      </div>

      <Card variant="bordered" padding="lg" className={styles.section}>
        <h2 className={styles.sectionTitle}>General</h2>
        <div className={styles.form}>
          <Input
            label="Application Name"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <Select
            label="Default User Role"
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value)}
            options={[
              { value: 'USER', label: 'User' },
              { value: 'MANAGER', label: 'Manager' },
            ]}
          />
        </div>
      </Card>

      <Card variant="bordered" padding="lg" className={styles.section}>
        <h2 className={styles.sectionTitle}>Notifications</h2>
        <div className={styles.toggleGroup}>
          <Toggle
            checked={emailNotifications}
            onChange={setEmailNotifications}
            label="Email notifications"
          />
          <Toggle
            checked={maintenanceMode}
            onChange={setMaintenanceMode}
            label="Maintenance mode"
          />
        </div>
      </Card>

      <div className={styles.actions}>
        <Button onClick={handleSave}>Save Changes</Button>
        <Button variant="outline">Cancel</Button>
      </div>
    </div>
  );
}
