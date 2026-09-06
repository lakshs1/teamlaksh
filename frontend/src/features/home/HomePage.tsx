import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import styles from './HomePage.module.css';

const FEATURES = [
  { title: 'Lightning Fast', desc: 'Built on Vite with instant HMR and optimized builds.' },
  { title: 'Design System', desc: 'CSS custom properties for instant theme switching.' },
  { title: 'Auth Ready', desc: 'Role-based routing with guards, JWT tokens, and persistent sessions.' },
  { title: 'Dashboard', desc: 'Pre-built admin and user dashboards with charts and data tables.' },
  { title: 'Component Library', desc: 'Button, Card, Input, Modal, Badge, Tabs, DataTable, and more.' },
  { title: 'Docker Ready', desc: 'Multi-stage Dockerfile with nginx for production deployment.' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Hackathon Frontend<br />Template
          </h1>
          <p className={styles.heroSub}>
            A production-ready React + TypeScript starter with auth, dashboards, 
            and a complete UI component library. Go from idea to demo in hours, not days.
          </p>
          <div className={styles.heroCta}>
            <Button size="lg" onClick={() => navigate('/auth/register')}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/dashboard')}>
              View Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything You Need</h2>
        <p className={styles.sectionSub}>Pre-built infrastructure so you can focus on your hackathon idea.</p>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <Card key={f.title} variant="bordered" padding="md" className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className={styles.techSection}>
        <h2 className={styles.sectionTitle}>Tech Stack</h2>
        <div className={styles.techGrid}>
          {['React 19', 'TypeScript', 'Vite', 'CSS Modules', 'Zustand', 'React Query', 'Recharts', 'Axios'].map((t) => (
            <div key={t} className={styles.techChip}>{t}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
