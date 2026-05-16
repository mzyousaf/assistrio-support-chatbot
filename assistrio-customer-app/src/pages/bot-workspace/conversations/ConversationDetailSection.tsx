import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function ConversationDetailSection({ title, children, className }: Props) {
  return (
    <Card className={cn('overflow-hidden shadow-sm', className)}>
      <CardHeader className="border-slate-100/90 px-4 py-2.5">
        <CardTitle className="text-[0.8125rem] font-semibold text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2.5 px-4 py-3">{children}</CardBody>
    </Card>
  );
}
