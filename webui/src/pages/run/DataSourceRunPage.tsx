import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileStack, FileText, Layers, LineChart, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, PageHeader } from '@/components/common';
import { FilePicker } from '@/components/FilePicker';
import { TagInput } from '@/components/TagInput';
import { CommonOptionsEditor, OutputOption, RunLayout, commonArgs, defaultCommon, useFileParam, useYamlFile } from '@/components/run/RunCommon';

export function DataSourceRunPage() {
  const [file, setFile] = useFileParam();
  const [techFile, setTechFile] = useState('');
  const [applicableTo, setApplicableTo] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [out, setOut] = useState({ layer: true, excel: false, graph: false, yaml: false, yamlAll: false, update: false });
  const [common, setCommon] = useState(defaultCommon());
  const doc = useYamlFile(file);
  const systems = useMemo(() => ((doc?.systems as { applicable_to: string }[] | undefined) ?? []).map((s) => String(s.applicable_to)), [doc]);

  const args = ['ds', '-fd', file ? 'input/' + file : '<file>'];
  if (out.update) args.push('-ft', techFile ? 'input/' + techFile : '<technique file>');
  applicableTo.forEach((a) => args.push('-a', a));
  if (search.trim()) args.push('-s', search.trim());
  if (out.layer) args.push('-l');
  if (out.excel) args.push('-e');
  if (out.graph) args.push('-g');
  if (out.yaml) args.push('-y');
  if (out.yaml && out.yamlAll) args.push('-ya');
  if (out.update) args.push('-u');
  args.push(...commonArgs(common, { layer: out.layer }));

  const anyOutput = out.layer || out.excel || out.graph || out.yaml || out.update || common.health;
  const set = (patch: Partial<typeof out>) => setOut({ ...out, ...patch });

  return (
    <>
      <PageHeader title="Data source mapping" icon={FileStack} description="Map your data sources to ATT&CK: generate a Navigator layer, an Excel overview, a graph over time, or visibility scores for your technique administration." />
      <RunLayout
        title="Options"
        args={args}
        jobTitle={`Data sources: ${file}`}
        canRun={!!file && anyOutput && (!out.update || !!techFile)}
        runLabel="Generate"
        hint={!file ? 'Select a data source file first.' : !anyOutput ? 'Select at least one output.' : undefined}
      >
        <Field label="Data source administration file">
          <FilePicker fileType="data-source-administration" value={file} onChange={setFile} />
        </Field>
        <div className="grid gap-2">
          <div className="text-sm font-medium">Outputs</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <OutputOption icon={Layers} title="Navigator layer" description="A heat map of the techniques covered by your data sources." checked={out.layer} onChange={(v) => set({ layer: v })} />
            <OutputOption icon={FileSpreadsheet} title="Excel" description="All data sources with their details and data quality." checked={out.excel} onChange={(v) => set({ excel: v })} />
            <OutputOption icon={LineChart} title="Graph" description="Data sources connected over time (date connected)." checked={out.graph} onChange={(v) => set({ graph: v })} />
            <OutputOption icon={FileText} title="Technique administration YAML" description="New technique file with visibility scores based on the nr. of data sources." checked={out.yaml} onChange={(v) => set({ yaml: v })} />
            <OutputOption
              icon={RefreshCw}
              title="Update visibility scores"
              description="Update the visibility scores in an existing technique file. You approve changes to manual scores."
              checked={out.update}
              onChange={(v) => set({ update: v })}
            />
          </div>
        </div>
        {out.yaml && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={out.yamlAll} onCheckedChange={(v) => set({ yamlAll: v })} /> Include all ATT&CK techniques of the platform(s) in the generated YAML file
          </label>
        )}
        {out.update && (
          <Field label="Technique administration file to update" description="A backup of the file is created before it's updated.">
            <FilePicker fileType="technique-administration" value={techFile} onChange={setTechFile} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Only include systems (applicable to)" help="Filter the data sources on one or more applicable to values (types of systems).">
            <TagInput value={applicableTo} onChange={setApplicableTo} options={systems} allowCustom={false} addLabel="Add system" />
          </Field>
          <Field label="EQL search" help="Only include data sources matching this EQL query, e.g.: data_sources where products = 'Sysmon'">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="data_sources where ..." className="font-mono text-xs" />
          </Field>
        </div>
        <CommonOptionsEditor value={common} onChange={setCommon} layer={out.layer} />
      </RunLayout>
    </>
  );
}
