const fs = require('fs');
const path = require('path');

const PAGES = [
  { path: 'data/personas', title: 'Personas & Fit', module: 'Data', name: 'PersonasFit' },
  { path: 'data/conversion', title: 'Conversion by Stage', module: 'Data', name: 'ConversionByStage' },
  { path: 'data/objections', title: 'Objections', module: 'Data', name: 'Objections' },
  { path: 'data/churn', title: 'Churn & Post-Sale', module: 'Data', name: 'ChurnPostSale' },
  { path: 'data/team-performance', title: 'Team Performance', module: 'Data', name: 'TeamPerformance' },
  { path: 'reports/generator', title: 'Report Generator', module: 'Reports', name: 'ReportGenerator' },
  { path: 'reports/saved', title: 'Saved Reports', module: 'Reports', name: 'SavedReports' },
  { path: 'reports/exports', title: 'Exports', module: 'Reports', name: 'Exports' },
  { path: 'modules/commercial', title: 'Commercial', module: 'Modules', name: 'Commercial' },
  { path: 'modules/post-sale', title: 'Post-Sale', module: 'Modules', name: 'PostSale' },
  { path: 'modules/consulting', title: 'Consulting', module: 'Modules', name: 'Consulting' },
  { path: 'modules/automation', title: 'Automation', module: 'Modules', name: 'Automation' },
  { path: 'settings/organization', title: 'Organization', module: 'Settings', name: 'Organization' },
  { path: 'settings/branding', title: 'Branding', module: 'Settings', name: 'Branding' },
  { path: 'settings/roles', title: 'Roles & Permissions', module: 'Settings', name: 'RolesPermissions' },
  { path: 'settings/pipelines', title: 'Pipelines & Stages', module: 'Settings', name: 'PipelinesStages' },
  { path: 'settings/audit', title: 'Audit', module: 'Settings', name: 'Audit' }
];

const basePath = path.join(__dirname, 'src', 'app', '(dashboard)');

PAGES.forEach(page => {
  const dirPath = path.join(basePath, page.path);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const content = `import { PlaceholderShell } from "@/components/shared/placeholder-shell";

export const metadata = {
  title: "${page.title} | Aexion Core",
};

export default function ${page.name}Page() {
  return <PlaceholderShell title="${page.title}" module="${page.module}" />;
}
`;
  
  fs.writeFileSync(path.join(dirPath, 'page.tsx'), content);
  console.log(`Created ${page.path}`);
});
