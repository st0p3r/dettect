import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { NEW_FILES, type FileType } from '@/lib/constants';
import { parseAdministration, serializeAdministration, validateAdministration, type AnyFile } from '@/lib/yaml';

const DEFAULT_NAMES: Record<FileType, string> = {
  'data-source-administration': 'data-sources-new.yaml',
  'technique-administration': 'techniques-administration-new.yaml',
  'group-administration': 'groups-new.yaml'
};

/**
 * State management for editing a YAML administration file: loading from "My files" or the computer, creating a new
 * file, tracking unsaved changes and saving.
 */
export function useAdminFile<T extends AnyFile>(fileType: FileType) {
  const [params, setParams] = useSearchParams();
  const [doc, setDoc] = useState<T | null>(null);
  const [filename, setFilename] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedParam = useRef<string | null>(null);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const loadContent = useCallback(
    (content: string, name: string, fromWorkspace: boolean) => {
      const result = parseAdministration(content, fileType);
      setDoc(result.doc as T);
      setWarnings(result.warnings);
      setFilename(name);
      setIsNew(!fromWorkspace);
      setDirty(!fromWorkspace);
      setLoadError(null);
    },
    [fileType]
  );

  const open = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const content = await api.readFile('input', name);
        loadContent(content, name, true);
        loadedParam.current = name;
        setParams({ file: name }, { replace: true });
      } catch (e) {
        setLoadError((e as Error).message);
        setDoc(null);
      } finally {
        setLoading(false);
      }
    },
    [loadContent, setParams]
  );

  const create = useCallback(() => {
    setDoc(NEW_FILES[fileType]() as T);
    setFilename(DEFAULT_NAMES[fileType]);
    setIsNew(true);
    setDirty(false);
    setWarnings([]);
    setLoadError(null);
    setParams({}, { replace: true });
  }, [fileType, setParams]);

  const openLocal = useCallback(
    async (file: File) => {
      try {
        loadContent(await file.text(), file.name, false);
        setParams({}, { replace: true });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [loadContent, setParams]
  );

  // Load the file from the URL (?file=name) or create a new file (?new=1)
  useEffect(() => {
    const file = params.get('file');
    if (file && file !== loadedParam.current) open(file);
    else if (params.get('new') && !doc) create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback((fn: (draft: T) => void) => {
    setDoc((d) => {
      if (!d) return d;
      const copy = structuredClone(d);
      fn(copy);
      return copy;
    });
    setDirty(true);
  }, []);

  const save = useCallback(
    async (name = filename, overwrite = !isNew) => {
      if (!doc) return false;
      const errors = validateAdministration(doc);
      if (errors.length) {
        errors.forEach((e) => toast.error(e));
        return false;
      }
      try {
        await api.writeFile('input', name, serializeAdministration(doc), overwrite);
        setFilename(name);
        setIsNew(false);
        setDirty(false);
        loadedParam.current = name;
        setParams({ file: name }, { replace: true });
        toast.success(`Saved '${name}'`);
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [doc, filename, isNew, setParams]
  );

  const download = useCallback(() => {
    if (!doc) return;
    const blob = new Blob([serializeAdministration(doc)], { type: 'text/yaml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [doc, filename]);

  return { doc, filename, isNew, dirty, warnings, setWarnings, loading, loadError, blocker, open, create, openLocal, update, save, download };
}

export type AdminFileState<T extends AnyFile> = ReturnType<typeof useAdminFile<T>>;
