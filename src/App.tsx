import { RepoProvider, useRepo } from "./state/RepoContext";
import { Toolbar } from "./components/Toolbar";
import { EmptyState } from "./components/EmptyState";
import { LeftPane } from "./components/LeftPane";
import { GraphPane } from "./components/GraphPane";
import { CommitPanel } from "./components/CommitPanel";
import "./App.css";

function Shell() {
  const { repo } = useRepo();
  return (
    <div className="app">
      <Toolbar />
      {!repo ? (
        <EmptyState />
      ) : (
        <div className="workspace">
          <LeftPane />
          <GraphPane />
          <CommitPanel />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <RepoProvider>
      <Shell />
    </RepoProvider>
  );
}

export default App;