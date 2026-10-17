import { Link } from 'react-router-dom';
import { Activity, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/common';
import { JobStatusBadge } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/utils';

export function JobsPage() {
  const jobs = useAsync(() => api.jobs(), []);
  return (
    <>
      <PageHeader
        title="Jobs"
        icon={Activity}
        description="Every analysis runs as a job. Jobs are kept until the server restarts."
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              await api.clearJobs();
              jobs.reload();
            }}
          >
            <Trash2 /> Clear finished jobs
          </Button>
        }
      />
      {jobs.data?.length === 0 ? (
        <EmptyState icon={Activity} title="No jobs yet" description="Run an analysis to see it here." />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="hidden md:table-cell">Command</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data?.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link to={`/jobs/${j.id}`} className="font-medium hover:underline">
                        {j.title}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-md truncate font-mono text-xs text-muted-foreground md:table-cell" title={j.command}>
                      {j.command}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatTime(j.created)}</TableCell>
                    <TableCell className="tabular-nums">{j.files.length}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={j.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
