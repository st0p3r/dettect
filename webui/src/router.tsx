import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { FilesPage } from '@/pages/FilesPage';
import { CoveragePage } from '@/pages/CoveragePage';
import { DataSourcesEditorPage } from '@/pages/editor/DataSourcesEditorPage';
import { TechniquesEditorPage } from '@/pages/editor/TechniquesEditorPage';
import { GroupsEditorPage } from '@/pages/editor/GroupsEditorPage';
import { DataSourceRunPage } from '@/pages/run/DataSourceRunPage';
import { CoverageRunPage } from '@/pages/run/CoverageRunPage';
import { GroupRunPage } from '@/pages/run/GroupRunPage';
import { GenericRunPage } from '@/pages/run/GenericRunPage';
import { JobsPage } from '@/pages/JobsPage';
import { JobPage } from '@/pages/JobPage';
import { ViewerPage } from '@/pages/ViewerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'coverage', element: <CoveragePage /> },
      { path: 'editor/data-sources', element: <DataSourcesEditorPage /> },
      { path: 'editor/techniques', element: <TechniquesEditorPage /> },
      { path: 'editor/groups', element: <GroupsEditorPage /> },
      { path: 'run/data-sources', element: <DataSourceRunPage /> },
      { path: 'run/visibility', element: <CoverageRunPage kind="visibility" /> },
      { path: 'run/detection', element: <CoverageRunPage kind="detection" /> },
      { path: 'run/groups', element: <GroupRunPage /> },
      { path: 'run/generic', element: <GenericRunPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobPage /> },
      { path: 'view/:dir/:name', element: <ViewerPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
]);
