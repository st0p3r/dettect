import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common';
import { JobPanel } from '@/components/JobPanel';

export function JobPage() {
  const { id } = useParams() as { id: string };
  return (
    <>
      <PageHeader
        title="Job"
        icon={Activity}
        actions={
          <Button variant="ghost" asChild>
            <Link to="/jobs">
              <ArrowLeft /> All jobs
            </Link>
          </Button>
        }
      />
      <JobPanel jobId={id} />
    </>
  );
}
