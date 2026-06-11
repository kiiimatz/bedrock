import { getServices, getIncidents } from '@/lib/data';
import StatusPageClient from '@/components/StatusPageClient';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const [services, incidents] = await Promise.all([
    getServices(),
    getIncidents(),
  ]);

  return <StatusPageClient initialServices={services} initialIncidents={incidents} />;
}
