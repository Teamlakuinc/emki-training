import DaftarClient from '@/components/DaftarClient';
import { refCode } from '@/lib/ref';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <DaftarClient refCode={refCode()} />;
}
