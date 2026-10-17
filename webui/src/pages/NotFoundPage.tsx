import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common';

export function NotFoundPage() {
  return (
    <EmptyState icon={Compass} title="Page not found" description="This page doesn't exist.">
      <Button asChild>
        <Link to="/">Go to the dashboard</Link>
      </Button>
    </EmptyState>
  );
}
