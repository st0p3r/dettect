import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAsync } from '@/hooks/use-async';
import { api, type FileInfo } from '@/lib/api';
import { FILE_TYPES, type FileType } from '@/lib/constants';

/**
 * Select one of the YAML administration files from "My files" (the input folder), filtered on file type.
 * Also allows uploading a file from the computer.
 */
export function FilePicker({
  fileType,
  value,
  onChange,
  placeholder,
  allowNone = false
}: {
  fileType: FileType;
  value: string;
  onChange: (name: string, info?: FileInfo) => void;
  placeholder?: string;
  allowNone?: boolean;
}) {
  const { data: files, reload } = useAsync(() => api.files('input'), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const matching = (files ?? []).filter((f) => f.file_type === fileType);
  const label = FILE_TYPES[fileType].label.toLowerCase();

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      const [info] = await api.upload('input', list);
      await reload();
      if (info.file_type !== fileType) toast.warning(`'${info.name}' was uploaded, but it is not a ${label} administration file.`);
      else onChange(info.name, info);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex gap-2">
      <Select value={value || (allowNone ? '__none__' : '')} onValueChange={(v) => onChange(v === '__none__' ? '' : v, matching.find((f) => f.name === v))}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={placeholder ?? `Select a ${label} file`} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="__none__">None</SelectItem>}
          {matching.map((f) => (
            <SelectItem key={f.name} value={f.name}>
              <span className="font-mono text-xs">{f.name}</span>
              {f.title && <span className="text-muted-foreground"> · {f.title}</span>}
            </SelectItem>
          ))}
          {matching.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              No {label} files yet. Upload one, or create one in the{' '}
              <Link className="text-primary underline" to={FILE_TYPES[fileType].route}>
                editor
              </Link>
              .
            </div>
          )}
        </SelectContent>
      </Select>
      <input ref={inputRef} type="file" accept=".yaml,.yml" className="hidden" onChange={(e) => upload(e.target.files)} />
      <Button type="button" variant="outline" size="icon" title="Upload a file from your computer" onClick={() => inputRef.current?.click()}>
        <Upload />
      </Button>
    </div>
  );
}
