import { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import styles from './AdminUsersPage.module.css';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const USERS: MockUser[] = [
  { id: '1', name: 'Jane Cooper', email: 'jane@example.com', role: 'USER', status: 'ACTIVE', createdAt: '2026-08-15' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'MANAGER', status: 'ACTIVE', createdAt: '2026-08-12' },
  { id: '3', name: 'Alice Johnson', email: 'alice@example.com', role: 'USER', status: 'ACTIVE', createdAt: '2026-08-10' },
  { id: '4', name: 'Carlos Ruiz', email: 'carlos@example.com', role: 'USER', status: 'BANNED', createdAt: '2026-07-28' },
  { id: '5', name: 'Diana Kim', email: 'diana@example.com', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-07-20' },
  { id: '6', name: 'Edward Lee', email: 'edward@example.com', role: 'USER', status: 'ACTIVE', createdAt: '2026-07-15' },
];

const columns: Column<MockUser>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  {
    key: 'role',
    header: 'Role',
    render: (u) => <Badge variant={u.role === 'ADMIN' ? 'primary' : u.role === 'MANAGER' ? 'info' : 'neutral'} size="sm">{u.role}</Badge>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (u) => <Badge variant={u.status === 'ACTIVE' ? 'success' : 'error'} size="sm">{u.status}</Badge>,
  },
  { key: 'createdAt', header: 'Joined' },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');

  const filtered = USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Users</h1>
        <p className={styles.subtitle}>Manage platform users and their roles.</p>
      </div>

      <div className={styles.toolbar}>
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth={false}
          className={styles.searchInput}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="No users found"
        emptyIcon="👥"
      />
    </div>
  );
}
