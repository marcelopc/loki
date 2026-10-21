import { RepoProvider, useRepo } from "./state/RepoContext";
import { Toolbar } from "./components/Toolbar";
import { EmptyState } from "./components/EmptyState";
import { LeftPane } from "./components/LeftPane";
import { GraphPane } from "./components/GraphPane";
import { RightPane } from "./components/DiffView";
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
          <RightPane />
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
