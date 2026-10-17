import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, FilePlus, FolderOpen, MoreHorizontal, PencilLine, Trash2, Upload, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EmptyState, FileTypeBadge, PageHeader } from '@/components/common';
import { FileActions } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api, type Dir, type FileInfo } from '@/lib/api';
import { FILE_TYPES } from '@/lib/constants';
import { cn, formatBytes, formatTime } from '@/lib/utils';

function FileTable({ dir, files, reload }: { dir: Dir; files: FileInfo[]; reload: () => void }) {
  const [renaming, setRenaming] = useState<{ file: FileInfo; mode: 'rename' | 'copy' } | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<FileInfo | null>(null);
  const [filter, setFilter] = useState('');

  const shown = files.filter((f) => !filter || (f.name + ' ' + (f.title ?? '')).toLowerCase().includes(filter.toLowerCase()));

  const doRename = async () => {
    if (!renaming) return;
    try {
      await api.fileAction(dir, renaming.file.name, renaming.mode, newName);
      toast.success(renaming.mode === 'rename' ? 'File renamed' : 'File duplicated');
      setRenaming(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteFile(dir, deleting.name);
      toast.success(`'${deleting.name}' deleted`);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="mb-3">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files..." className="max-w-xs" />
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Details</TableHead>
                <TableHead className="hidden lg:table-cell">Size</TableHead>
                <TableHead className="hidden lg:table-cell">Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((f) => (
                <TableRow key={f.name}>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs" title={f.name}>
                    {f.name}
                  </TableCell>
                  <TableCell>
                    <FileTypeBadge type={f.file_type} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {[f.title, f.domain, f.version && 'v' + f.version].filter(Boolean).join(' · ')}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground tabular-nums lg:table-cell">{formatBytes(f.size)}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatTime(f.modified)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <FileActions file={{ dir, name: f.name }} fileType={f.file_type} compact onChange={reload} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenaming({ file: f, mode: 'rename' });
                              setNewName(f.name);
                            }}
                          >
                            <PencilLine /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenaming({ file: f, mode: 'copy' });
                              setNewName(f.name.replace(/(\.\w+)$/, '-copy$1'));
                            }}
                          >
                            <Copy /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(f)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renaming?.mode === 'rename' ? 'Rename file' : 'Duplicate file'}</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doRename()} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={doRename} disabled={!newName.trim()}>
              {renaming?.mode === 'rename' ? 'Rename' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete '{deleting?.name}'?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the file. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={doDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function FilesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'input';
  const navigate = useNavigate();
  const input = useAsync(() => api.files('input'), []);
  const output = useAsync(() => api.files('output'), []);
  const info = useAsync(() => api.info(), []);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      const result = await api.upload('input', list);
      toast.success(`${result.length} file(s) uploaded`);
      input.reload();
      setParams({ tab: 'input' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const importSample = async (name: string) => {
    try {
      const f = await api.fileAction('sample', name, 'import-sample');
      toast.success(`'${f.name}' added to your files`);
      input.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files);
      }}
      className={cn('min-h-[60vh] rounded-xl transition-colors', dragging && 'bg-primary/5 ring-2 ring-primary/40 ring-dashed')}
    >
      <PageHeader
        title="Files"
        icon={FolderOpen}
        description="Your YAML administration files (input) and everything DeTT&CT generates (output). Drop files anywhere on this page to upload them."
        actions={
          <>
            <input ref={uploadRef} type="file" multiple accept=".yaml,.yml" className="hidden" onChange={(e) => upload(e.target.files)} />
            <Button variant="outline" onClick={() => uploadRef.current?.click()}>
              <Upload /> Upload
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <FilePlus /> New file
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>New administration file</DropdownMenuLabel>
                {Object.entries(FILE_TYPES).map(([, t]) => (
                  <DropdownMenuItem key={t.route} onClick={() => navigate(t.route + '?new=1')}>
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="input">My files ({input.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="output">Output ({output.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
        </TabsList>
        <TabsContent value="input">
          {input.data?.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No files yet" description="Upload your YAML administration files, create a new one, or start from a sample file.">
              <Button onClick={() => uploadRef.current?.click()}>
                <Upload /> Upload
              </Button>
              <Button variant="outline" onClick={() => setParams({ tab: 'samples' })}>
                Browse samples
              </Button>
            </EmptyState>
          ) : (
            <FileTable dir="input" files={input.data ?? []} reload={input.reload} />
          )}
        </TabsContent>
        <TabsContent value="output">
          {output.data?.length === 0 ? (
            <EmptyState icon={FileDown} title="No output yet" description="Navigator layers, Excel files, graphs and generated YAML files appear here after running an analysis." />
          ) : (
            <FileTable dir="output" files={output.data ?? []} reload={output.reload} />
          )}
        </TabsContent>
        <TabsContent value="samples">
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableBody>
                  {info.data?.sample_files.map((name) => (
                    <TableRow key={name}>
                      <TableCell className="font-mono text-xs">{name}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => importSample(name)}>
                          <Copy /> Add to my files
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
