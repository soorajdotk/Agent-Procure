import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "./contexts/Web3Context";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { CreateRequest } from "./pages/CreateRequest";
import { RequestDetails } from "./pages/RequestDetails";
import { History } from "./pages/History";
import { AgentActivity } from "./pages/AgentActivity";

function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateRequest />} />
            <Route path="/request/:requestId" element={<RequestDetails />} />
            <Route path="/history" element={<History />} />
            <Route path="/activity" element={<AgentActivity />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
