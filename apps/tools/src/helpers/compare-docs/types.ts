import { type ChildProcess } from 'node:child_process';

export type Side = 'base' | 'candidate';

export type Theme = 'light' | 'dark';

export type ProfileName = 'desktop' | 'mobile-touch' | 'mobile-hover';

export interface Profile {
  viewport: { width: number; height: number };
  isMobile: boolean;
  hasTouch: boolean;
  hover: boolean;
}

export interface CaptureOptions {
  themes: Theme[];
  profiles: ProfileName[];
  maxDepth: number;
  axe: boolean;
  clock: string;
  concurrency: number;
  hoverDedup: boolean;
}

export interface Sighting {
  theme: Theme;
  profileName: ProfileName;
  profile: string;
  route: string;
  trail: string[];
  stateLabel: string;
  key: string;
  label: string;
  record: ControlCoverage;
}

export interface CaptureSession {
  key: string;
  capturePage: (route: string) => Promise<Sighting[]>;
  captureHovers: (route: string, sightings: Sighting[]) => Promise<void>;
  close: () => Promise<void>;
}

export interface Control {
  key: string;
  index: number;
  label: string;
  href: string;
  role: string;
  disabled: boolean;
  trigger: boolean;
  signature: string;
}

export type ScreenshotKind = 'full-page' | 'open-viewport' | 'hover';

export interface Screenshot {
  key: string;
  route: string;
  profile: string;
  kind: ScreenshotKind;
  label: string;
  state: string;
  file: string;
}

export type DiagnosticType =
  | 'accessibility'
  | 'accessibility-check-failed'
  | 'broken-image'
  | 'capture-failed'
  | 'console-error'
  | 'coverage-limit'
  | 'horizontal-overflow'
  | 'hover-failed'
  | 'http-error'
  | 'page-error'
  | 'page-status'
  | 'request-failed'
  | 'unexpected-dialog'
  | 'unexpected-popup'
  | 'unverified-disclosure';

export interface Diagnostic {
  route: string;
  profile: string;
  state: string;
  type: DiagnosticType;
  message: string;
}

export interface ComparedDiagnostic extends Diagnostic {
  status: 'new' | 'existing' | 'resolved';
}

export interface ControlCoverage {
  key: string;
  label: string;
  state: string;
  status: 'disabled' | 'pending' | 'touch-no-hover' | 'captured' | 'failed' | 'covered-elsewhere';
}

export interface DisclosureCoverage {
  key: string;
  label: string;
  trail: string[];
  status?: 'queued' | 'captured' | 'failed' | 'depth-limit';
}

export interface PageCoverage {
  route: string;
  profile: string;
  controls: ControlCoverage[];
  disclosures: DisclosureCoverage[];
  states: number;
  hoverApplicable: boolean;
}

export interface CaptureData {
  screenshots: Screenshot[];
  diagnostics: Diagnostic[];
  coverage: PageCoverage[];
}

export interface Revision {
  label: string;
  commit: string;
  directory: string;
}

export interface ReportSite {
  label: string;
  commit?: string;
  directory?: string;
  origin?: string;
}

export interface RunningSite extends ReportSite {
  origin: string;
}

export interface Check {
  side: Side;
  name: 'install' | 'lint' | 'build';
  log: string;
  status: 'passed' | 'failed';
  error?: string;
}

export interface Comparison extends Screenshot {
  status: 'identical' | 'changed' | 'added' | 'removed';
  before?: string;
  after?: string;
  pixels?: number;
  percent?: number;
  dimensions?: { before: [number, number]; after: [number, number] };
  diff?: string;
  region?: [number, number, number, number];
  signature?: string;
  group?: string;
}

export interface Report {
  started: string;
  finished?: string;
  complete: boolean;
  threshold: number;
  options: CaptureOptions;
  checks: Check[];
  comparisons: Comparison[];
  diagnostics: ComparedDiagnostic[];
  coverage: { base?: PageCoverage[]; candidate?: PageCoverage[] };
  output: string;
  base?: ReportSite;
  candidate?: ReportSite;
  routes?: { base: string[]; candidate: string[] };
  routeChanges?: { added: string[]; removed: string[] };
  error?: string;
}

export interface ComparisonRequest {
  branch?: string;
  base: string;
  keepCheckout: boolean;
  keepWorktrees: boolean;
  pages?: string[];
  threshold: number;
  output?: string;
  baseUrl?: string;
  candidateUrl?: string;
  options: CaptureOptions;
}

export type BackgroundProcess = ChildProcess & { failure?: Error };
