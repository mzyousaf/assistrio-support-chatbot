import { Table2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui';

/** Phase 6: datasheet grid editor and CSV import are not wired for admin yet. */
export function AdminDatasheetsPlaceholderPage() {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <Table2 size={24} aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Datasheet management is coming soon</h2>
        <p className="max-w-md text-sm text-slate-600">
          Admin datasheet list and grid editing will be added in a later phase. Documents, FAQs, and notes are fully
          available now.
        </p>
      </CardBody>
    </Card>
  );
}
