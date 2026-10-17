import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  CornerDownLeft,
  Download,
  ExternalLink,
  Eye,
  FilePlus2,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Square,
  Terminal,
  XCircle,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, fileUrl, type Job, type JobFile } from '@/lib/api';
import { FILE_TYPES, type FileType } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  switch (status) {
    case 'running':
      return (
        <Badge variant="default" className="gap-1">
          <Loader2 className="animate-spin" /> Running
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="secondary">
          <Clock /> Queued
        </Badge>
      );
    case 'finished':
      return (
        <Badge variant="success">
          <CheckCircle2 /> Finished
        </Badge>
      );
    case 'cancelled':
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return (
        <Badge variant="destructive">
          <XCircle /> Failed
        </Badge>
      );
  }
}

interface Prompt {
  kind: 'yesno' | 'choice' | 'continue' | 'text';
  question: string;
  options?: { value: string; label: string }[];
}

/**
 * Detect whether the process is waiting for input, based on the tail of its output.
 */
function detectPrompt(output: string): Prompt | null {
  if (!output || output.endsWith('\n')) return null;
  const lines = output.split('\n');
  const last = lines[lines.length - 1];
  const prev = lines.slice(Math.max(0, lines.length - 15), lines.length - 1);
  if (/y\(yes\) \/ n\(no\):\s*$/.test(last)) {
    const question = last.replace(/\s*>>.*$/, '').trim() || [...prev].reverse().find((l) => l.trim()) || 'Answer the question';
    return { kind: 'yesno', question };
  }
  if (last.includes('Press a key to continue')) return { kind: 'continue', question: 'Press continue to proceed' };
  if (/^\s*>>\s*$/.test(last)) {
    const options: { value: string; label: string }[] = [];
    let i = prev.length - 1;
    while (i >= 0 && prev[i].trim() === '') i--;
    while (i >= 0 && /^\s+\d+\)\s/.test(prev[i])) {
      const m = prev[i].match(/^\s+(\d+)\)\s(.*)$/)!;
      options.unshift({ value: m[1], label: m[2] });
      i--;
    }
    const question = i >= 0 ? prev[i].trim() : 'Choose an option';
    if (options.length) return { kind: 'choice', question, options };
  }
  if (!/[:?>]\s*$/.test(last)) return null;
  return { kind: 'text', question: last.replace(/^\s*>>\s*/, '').trim() || 'The process is waiting for input' };
}

function elapsed(job: Job, now: number) {
  if (!job.started) return '';
  const s = Math.round(((job.ended ?? now / 1000) - job.started) * 10) / 10;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function navigatorUrl(name: string) {
  const url = `${window.location.origin}${fileUrl('output', name)}`;
  return `https://mitre-attack.github.io/attack-navigator/#layerURL=${encodeURIComponent(url)}`;
}

export function FileActions({ file, fileType, compact = false, onChange }: { file: { dir: 'input' | 'output'; name: string }; fileType?: string; compact?: boolean; onChange?: () => void }) {
  const navigate = useNavigate();
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isYaml = ext === 'yaml' || ext === 'yml';
  const editorRoute = fileType && fileType in FILE_TYPES ? FILE_TYPES[fileType as FileType].route : null;
  const size = compact ? 'icon-sm' : 'sm';

  const copyToWorkspace = async () => {
    try {
      const info = await api.fileAction('output', file.name, 'copy-to-input');
      toast.success(`Copied to your files as '${info.name}'`);
      onChange?.();
      return info;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(ext === 'html' || ext === 'json' || isYaml) && (
        <Button variant="outline" size={size} asChild title="View">
          <Link to={`/view/${file.dir}/${encodeURIComponent(file.name)}`}>
            <Eye />
            {!compact && 'View'}
          </Link>
        </Button>
      )}
      {isYaml && editorRoute && file.dir === 'input' && (
        <Button variant="outline" size={size} title="Open in editor" onClick={() => navigate(`${editorRoute}?file=${encodeURIComponent(file.name)}`)}>
          <Pencil />
          {!compact && 'Edit'}
        </Button>
      )}
      {isYaml && file.dir === 'output' && (
        <Button
          variant="outline"
          size={size}
          title="Copy to my files (so it can be edited and used as input)"
          onClick={async () => {
            const info = await copyToWorkspace();
            if (info && editorRoute) navigate(`${editorRoute}?file=${encodeURIComponent(info.name)}`);
          }}
        >
          <FilePlus2 />
          {!compact && 'Copy to my files'}
        </Button>
      )}
      {ext === 'json' && file.dir === 'output' && (
        <Button variant="outline" size={size} asChild title="Open in ATT&CK Navigator">
          <a href={navigatorUrl(file.name)} target="_blank" rel="noreferrer">
            <ExternalLink />
            {!compact && 'Navigator'}
          </a>
        </Button>
      )}
      <Button variant="outline" size={size} asChild title="Download">
        <a href={fileUrl(file.dir, file.name, true)}>
          <Download />
          {!compact && 'Download'}
        </a>
      </Button>
    </div>
  );
}

function ProducedFiles({ files }: { files: JobFile[] }) {
  if (!files.length) return null;
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">Created / changed files</div>
      {files.map((f) => {
        return (
          <div key={f.dir + f.name} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm">{f.name}</div>
              <div className="text-xs text-muted-foreground">
                {f.dir === 'input' ? 'My files' : 'Output'} · {f.new ? 'new' : 'updated'}
              </div>
            </div>
            <FileActions file={f} fileType={f.file_type} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Shows a live view of a job: its console output, questions that need an answer and the files it produced.
 */
export function JobPanel({ jobId, onFinished, className }: { jobId: string; onFinished?: (job: Job) => void; className?: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [output, setOutput] = useState('');
  const [answer, setAnswer] = useState('');
  const [now, setNow] = useState(Date.now());
  const preRef = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => {
    setOutput('');
    setJob(null);
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.addEventListener('output', (e) => setOutput((o) => o + JSON.parse((e as MessageEvent).data)));
    es.addEventListener('status', (e) => setJob(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('end', async () => {
      es.close();
      const final = await api.job(jobId);
      setJob(final);
      setOutput(final.output ?? '');
      finishedRef.current?.(final);
    });
    es.onerror = () => {
      es.close();
      api.job(jobId).then((j) => {
        setJob(j);
        setOutput(j.output ?? '');
      });
    };
    return () => es.close();
  }, [jobId]);

  useEffect(() => {
    if (job?.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [job?.status]);

  useEffect(() => {
    if (stick.current && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [output]);

  const running = job?.status === 'running';
  const prompt = useMemo(() => (running ? detectPrompt(output) : null), [running, output]);

  const send = async (text: string) => {
    try {
      await api.jobInput(jobId, text);
      setAnswer('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className={cn('min-w-0 gap-4', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="size-4" />
          {job?.title ?? 'Job'}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {job && <span className="text-xs text-muted-foreground tabular-nums">{elapsed(job, now)}</span>}
          {job && <JobStatusBadge status={job.status} />}
          {(running || job?.status === 'queued') && (
            <Button variant="outline" size="sm" onClick={() => api.cancelJob(jobId)}>
              <Square /> Stop
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {job && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
            <span className="text-primary">$</span>
            <span className="min-w-0 flex-1 truncate" title={job.command}>
              python {job.command}
            </span>
            <button
              type="button"
              className="hover:text-foreground"
              title="Copy command"
              onClick={() => {
                navigator.clipboard?.writeText('python ' + job.command);
                toast.success('Command copied');
              }}
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        )}
        <pre
          ref={preRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="max-h-[480px] min-h-40 overflow-auto rounded-lg border bg-zinc-950 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-zinc-100"
        >
          {output || (job?.status === 'queued' ? 'Waiting for other jobs to finish...' : 'Starting...')}
          {running && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-zinc-300" />}
        </pre>

        {prompt && (
          <div className="grid gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-start gap-2 text-sm font-medium">
              <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
              {prompt.question}
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.kind === 'yesno' && (
                <>
                  <Button size="sm" onClick={() => send('y')}>
                    Yes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => send('n')}>
                    No
                  </Button>
                </>
              )}
              {prompt.kind === 'continue' && (
                <Button size="sm" onClick={() => send('')}>
                  Continue
                </Button>
              )}
              {prompt.kind === 'choice' &&
                prompt.options!.map((o, i) => (
                  <Button key={o.value} size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => send(o.value)}>
                    {o.label}
                  </Button>
                ))}
            </div>
          </div>
        )}
        {running && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(answer);
            }}
          >
            <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type an answer for the process and press Enter" className="font-mono text-sm" />
            <Button type="submit" variant="secondary">
              <CornerDownLeft /> Send
            </Button>
          </form>
        )}
        {job && !running && job.status !== 'queued' && <ProducedFiles files={job.files} />}
      </CardContent>
    </Card>
  );
}
