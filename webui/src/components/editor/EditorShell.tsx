import * as React from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Download, FilePlus, FolderOpen, HeartPulse, Play, Save, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/common';
import { JobPanel } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import type { AdminFileState } from '@/hooks/use-admin-file';
import { api } from '@/lib/api';
import { FILE_TYPES, type FileType } from '@/lib/constants';
import type { AnyFile } from '@/lib/yaml';

const HEALTH_ARGS: Record<FileType, (path: string) => string[]> = {
  'data-source-administration': (p) => ['ds', '-fd', p, '--health'],
  'technique-administration': (p) => ['v', '-ft', p, '--health'],
  'group-administration': (p) => ['g', '-g', p, '--health']
};

/**
 * Common frame for the three editors: file handling toolbar, warnings and the unsaved changes dialog.
 */
export function EditorShell<T extends AnyFile>({
  fileType,
  state,
  icon,
  description,
  runRoute,
  children
}: {
  fileType: FileType;
  state: AdminFileState<T>;
  icon: React.ElementType;
  description: string;
  runRoute: string;
  children: React.ReactNode;
}) {
  const label = FILE_TYPES[fileType].label;
  const files = useAsync(() => api.files('input'), [state.filename, state.isNew]);
  const localRef = useRef<HTMLInputElement>(null);
  const [saveAs, setSaveAs] = useState<string | null>(null);
  const [healthJob, setHealthJob] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const matching = (files.data ?? []).filter((f) => f.file_type === fileType);

  const guard = (action: () => void) => (state.dirty ? setConfirmAction(() => action) : action());

  const doSave = async () => {
    if (state.isNew) setSaveAs(state.filename);
    else await state.save();
  };

  const runHealth = async () => {
    if (state.dirty || state.isNew) {
      const ok = state.isNew ? false : await state.save();
      if (!ok) {
        if (state.isNew) setSaveAs(state.filename);
        return;
      }
    }
    const job = await api.runJob(`Health check: ${state.filename}`, HEALTH_ARGS[fileType]('input/' + state.filename));
    setHealthJob(job.id);
  };

  return (
    <>
      <PageHeader
        title={`${label} editor`}
        icon={icon}
        description={description}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FolderOpen /> Open <ChevronDown className="opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>My {label.toLowerCase()} files</DropdownMenuLabel>
                {matching.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No files yet</div>}
                {matching.map((f) => (
                  <DropdownMenuItem key={f.name} onClick={() => guard(() => state.open(f.name))}>
                    <span className="truncate font-mono text-xs">{f.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => guard(() => localRef.current?.click())}>
                  <Upload /> Open from computer...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={localRef}
              type="file"
              accept=".yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) state.openLocal(f);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => guard(state.create)}>
              <FilePlus /> New
            </Button>
            {state.doc && (
              <>
                <Button variant="outline" onClick={state.download} title="Download the YAML file to your computer">
                  <Download />
                </Button>
                <Button variant="outline" onClick={() => setSaveAs(state.filename.replace(/(\.ya?ml)?$/, '-copy.yaml'))}>
                  Save as
                </Button>
                <Button onClick={doSave} disabled={!state.dirty && !state.isNew}>
                  <Save /> Save
                </Button>
              </>
            )}
          </>
        }
      />

      {state.loadError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle />
          <AlertTitle>Could not open the file</AlertTitle>
          <AlertDescription>{state.loadError}</AlertDescription>
        </Alert>
      )}

      {!state.doc && !state.loading && (
        <EmptyState icon={icon} title={`No ${label.toLowerCase()} file opened`} description={`Open one of your ${label.toLowerCase()} administration files or create a new one.`}>
          {matching.slice(0, 3).map((f) => (
            <Button key={f.name} variant="outline" onClick={() => state.open(f.name)}>
              <FolderOpen /> {f.name}
            </Button>
          ))}
          <Button onClick={state.create}>
            <FilePlus /> New file
          </Button>
        </EmptyState>
      )}

      {state.doc && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {state.filename}
            </Badge>
            {state.isNew && <Badge variant="secondary">not saved yet</Badge>}
            {state.dirty && <Badge variant="warning">unsaved changes</Badge>}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={runHealth}>
              <HeartPulse /> Health check
            </Button>
            {!state.isNew && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`${runRoute}?file=${encodeURIComponent(state.filename)}`}>
                  <Play /> Analyze
                </Link>
              </Button>
            )}
          </div>
          {state.warnings.length > 0 && (
            <Alert variant="warning" className="mb-4">
              <AlertTriangle />
              <AlertTitle>The file was repaired while loading ({state.warnings.length})</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {state.warnings.slice(0, 8).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {state.warnings.length > 8 && <li>and {state.warnings.length - 8} more...</li>}
                </ul>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => state.setWarnings([])}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {children}
        </>
      )}

      <Dialog open={saveAs !== null} onOpenChange={(o) => !o && setSaveAs(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as</DialogTitle>
            <DialogDescription>The file is stored in "My files" so it can be used for analysis.</DialogDescription>
          </DialogHeader>
          <Input value={saveAs ?? ''} onChange={(e) => setSaveAs(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAs(null)}>
              Cancel
            </Button>
            <Button
              disabled={!saveAs?.trim()}
              onClick={async () => {
                let name = saveAs!.trim();
                if (!/\.ya?ml$/i.test(name)) name += '.yaml';
                if (await state.save(name, false)) setSaveAs(null);
              }}
            >
              <Save /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!healthJob} onOpenChange={(o) => !o && setHealthJob(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Health check</DialogTitle>
            <DialogDescription>DeTT&CT checks the file for errors. No output means the file is healthy.</DialogDescription>
          </DialogHeader>
          {healthJob && <JobPanel jobId={healthJob} className="border-0 py-0 shadow-none [&>[data-slot=card-content]]:px-0 [&>[data-slot=card-header]]:px-0" />}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={state.blocker.state === 'blocked' || !!confirmAction}
        onOpenChange={(o) => {
          if (!o) {
            if (state.blocker.state === 'blocked') state.blocker.reset();
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes in '{state.filename}' that will be lost if you continue.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (state.blocker.state === 'blocked') state.blocker.proceed();
                confirmAction?.();
                setConfirmAction(null);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
