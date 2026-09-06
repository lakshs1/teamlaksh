import { useState, useEffect } from 'react';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { authApi } from '../../services/apiServices';
import toast from 'react-hot-toast';
import styles from './AdminUsersPage.module.css';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const columns: Column<UserData>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  {
    key: 'role',
    header: 'Role',
    render: (u) => (
      <Badge
        variant={u.role === 'admin' ? 'primary' : u.role === 'manager' || u.role === 'finance' ? 'info' : 'neutral'}
        size="sm"
      >
        {u.role.toUpperCase()}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (u) => (
      <Badge variant={u.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
        {u.status}
      </Badge>
    ),
  },
  { key: 'createdAt', header: 'Joined' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const res = await authApi.getUsers();
        const rawUsers = Array.isArray(res.data) ? res.data : [];
        const mapped: UserData[] = rawUsers.map((u: any) => ({
          id: String(u.id),
          name: u.name || 'Unknown',
          email: u.email || '',
          role: u.role || 'rep',
          status: u.isActive === false ? 'BANNED' : 'ACTIVE',
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A',
        }));
        setUsers(mapped);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filtered = users.filter(
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

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Loading platform users...</div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No users found"
        />
      )}
    </div>
  );
}
