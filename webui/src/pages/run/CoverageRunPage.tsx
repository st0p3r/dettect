import { useMemo, useState } from 'react';
import { Eye, FileSpreadsheet, Layers, LineChart, ShieldCheck, SquareStack } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, HelpTip, PageHeader } from '@/components/common';
import { FilePicker } from '@/components/FilePicker';
import { TagInput } from '@/components/TagInput';
import { CommonOptionsEditor, OutputOption, RunLayout, commonArgs, defaultCommon, useFileParam, useYamlFile } from '@/components/run/RunCommon';
import { PLATFORMS, type Domain } from '@/lib/constants';

export function CoverageRunPage({ kind }: { kind: 'visibility' | 'detection' }) {
  const other = kind === 'visibility' ? 'detection' : 'visibility';
  const [file, setFile] = useFileParam();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [searchVis, setSearchVis] = useState('');
  const [searchDet, setSearchDet] = useState('');
  const [allScores, setAllScores] = useState(false);
  const [countDetections, setCountDetections] = useState(false);
  const [out, setOut] = useState({ layer: true, overlay: false, graph: false, excel: false });
  const [common, setCommon] = useState(defaultCommon());
  const doc = useYamlFile(file);
  const domain = ((doc?.domain as Domain) ?? 'enterprise-attack') as Domain;
  const platformOptions = useMemo(() => PLATFORMS[domain].filter((p) => p !== 'all'), [domain]);

  const args = [kind === 'visibility' ? 'v' : 'd', '-ft', file ? 'input/' + file : '<file>'];
  platforms.forEach((p) => args.push('-p', p));
  if (searchVis.trim()) args.push('-sv', searchVis.trim());
  if (searchDet.trim()) args.push('-sd', searchDet.trim());
  if (allScores && (searchVis.trim() || searchDet.trim())) args.push('--all-scores');
  if (out.layer) args.push('-l');
  if (out.overlay) args.push('-o');
  if (out.graph) args.push('-g');
  if (out.excel) args.push('-e');
  if (countDetections && (out.layer || out.overlay)) args.push('-cd');
  args.push(...commonArgs(common, { layer: out.layer || out.overlay }));
  const anyOutput = out.layer || out.overlay || out.graph || out.excel || common.health;
  const Icon = kind === 'visibility' ? Eye : ShieldCheck;

  return (
    <>
      <PageHeader
        title={kind === 'visibility' ? 'Visibility coverage' : 'Detection coverage'}
        icon={Icon}
        description={
          kind === 'visibility'
            ? 'Create a heat map based on your visibility scores, overlay visibility with detections, plot visibility over time or export to Excel.'
            : 'Create a heat map based on your detection scores, overlay detections with visibility, plot detections over time or export to Excel.'
        }
      />
      <RunLayout
        title="Options"
        args={args}
        jobTitle={`${kind === 'visibility' ? 'Visibility' : 'Detection'}: ${file}`}
        canRun={!!file && anyOutput}
        runLabel="Generate"
        hint={!file ? 'Select a technique file first.' : !anyOutput ? 'Select at least one output.' : undefined}
      >
        <Field label="Technique administration file">
          <FilePicker fileType="technique-administration" value={file} onChange={setFile} />
        </Field>
        <div className="grid gap-2">
          <div className="text-sm font-medium">Outputs</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <OutputOption icon={Layers} title={`${kind === 'visibility' ? 'Visibility' : 'Detection'} layer`} description={`ATT&CK Navigator heat map of your ${kind} scores.`} checked={out.layer} onChange={(v) => setOut({ ...out, layer: v })} />
            <OutputOption icon={SquareStack} title={`Overlay with ${other}`} description={`Navigator layer that shows ${kind} and ${other} together.`} checked={out.overlay} onChange={(v) => setOut({ ...out, overlay: v })} />
            <OutputOption icon={LineChart} title="Graph" description={`The ${kind} improvements over time.`} checked={out.graph} onChange={(v) => setOut({ ...out, graph: v })} />
            <OutputOption icon={FileSpreadsheet} title="Excel" description="All administrated techniques with their scores." checked={out.excel} onChange={(v) => setOut({ ...out, excel: v })} />
          </div>
        </div>
        <Field label="Platforms" help="Default: the platform(s) in the YAML file.">
          <TagInput value={platforms} onChange={setPlatforms} options={platformOptions} allowCustom={false} addLabel="Add platform" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="EQL search on visibility" help="Only include visibility objects that match this EQL query, e.g.: visibility where score >= 2">
            <Input value={searchVis} onChange={(e) => setSearchVis(e.target.value)} placeholder="visibility where ..." className="font-mono text-xs" />
          </Field>
          <Field label="EQL search on detection" help="Only include detection objects that match this EQL query, e.g.: detection where location = 'EDR'">
            <Input value={searchDet} onChange={(e) => setSearchDet(e.target.value)} placeholder="detection where ..." className="font-mono text-xs" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={allScores} onCheckedChange={setAllScores} /> Search all scores in the score logbook
            <HelpTip>By default only the most recent score objects are included in the EQL search.</HelpTip>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={countDetections} onCheckedChange={setCountDetections} /> Count detections
            <HelpTip>Show the number of detections (grouped by location prefix, e.g. 'EDR: Rule 1') instead of listing all locations in the layer metadata.</HelpTip>
          </label>
        </div>
        <CommonOptionsEditor value={common} onChange={setCommon} layer={out.layer || out.overlay} />
      </RunLayout>
    </>
  );
}
