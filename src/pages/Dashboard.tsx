import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import {
  PROCUREMENT_STORAGE_ADDRESS,
  PROCUREMENT_STORAGE_ABI,
  PARSE_WEBSITE_ADDRESS,
  AI_RECOMMENDATION_ADDRESS
} from "../contracts/config";
import {
  Layers,
  Globe,
  Sparkles,
  Clock,
  CheckCircle,
  PlusCircle,
  Cpu,
  ArrowRight,
  Loader2,
  FileText
} from "lucide-react";

interface SystemStats {
  totalRequests: number;
  totalParsedWebsites: number;
  totalRecommendations: number;
  pendingRequests: number;
  completedRequests: number;
}

interface RecentRequest {
  id: string;
  productName: string;
  budget: string;
  processed: boolean;
  requester: string;
  date?: string;
}

export const Dashboard: React.FC = () => {
  const { provider } = useWeb3();

  const [stats, setStats] = useState<SystemStats>({
    totalRequests: 0,
    totalParsedWebsites: 0,
    totalRecommendations: 0,
    pendingRequests: 0,
    completedRequests: 0
  });

  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    // If no window.ethereum provider, use a fallback JsonRpcProvider to show dashboard immediately!
    const queryProvider = provider || new ethers.JsonRpcProvider("https://api.infra.testnet.somnia.network/");

    setLoading(true);
    setError(null);

    try {
      const storageContract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        queryProvider
      );

      // Fetch requestCounter
      const requestCounterVal = await storageContract.requestCounter();
      const totalReqCount = Number(requestCounterVal);

      // Somnia testnet RPC limits eth_getLogs to 1000 blocks per query.
      // Fetch the current block number and look back at most 900 blocks to stay safely within the limit.
      const latestBlock = await queryProvider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 900);

      // Topic hashes
      const procurementCreatedTopic = ethers.id("ProcurementCreated(uint256,address,string)");
      const evaluationStoredTopic = ethers.id("EvaluationStored(uint256,string,uint256)");
      const parsingCompletedTopic = ethers.id("ParsingCompleted(uint256,string)");
      const analysisCompletedTopic = ethers.id("AnalysisCompleted(uint256,string)");

      // Fetch logs in parallel — scoped to last 900 blocks to respect RPC limits
      const [procurementLogs, evaluationLogs, parsingLogs, analysisLogs] = await Promise.all([
        queryProvider.getLogs({
          address: PROCUREMENT_STORAGE_ADDRESS,
          topics: [procurementCreatedTopic],
          fromBlock,
          toBlock: "latest"
        }),
        queryProvider.getLogs({
          address: PROCUREMENT_STORAGE_ADDRESS,
          topics: [evaluationStoredTopic],
          fromBlock,
          toBlock: "latest"
        }),
        queryProvider.getLogs({
          address: PARSE_WEBSITE_ADDRESS,
          topics: [parsingCompletedTopic],
          fromBlock,
          toBlock: "latest"
        }),
        queryProvider.getLogs({
          address: AI_RECOMMENDATION_ADDRESS,
          topics: [analysisCompletedTopic],
          fromBlock,
          toBlock: "latest"
        })
      ]);

      // Calculate stats based on logs
      const totalRequests = totalReqCount;
      const totalParsedWebsites = parsingLogs.length;
      const totalRecommendations = analysisLogs.length;

      // Extract evaluations map
      const storedEvaluations = new Set<string>();
      for (const log of evaluationLogs) {
        try {
          const parsed = storageContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          if (parsed && parsed.args && parsed.args.requestId) {
            storedEvaluations.add(parsed.args.requestId.toString());
          }
        } catch (e) {
          // Ignore
        }
      }

      // Fetch details of recent 5 requests
      const recentList: RecentRequest[] = [];
      const fetchCount = Math.min(totalRequests, 5);
      
      // We read backwards from the counter
      for (let i = totalRequests - 1; i >= totalRequests - fetchCount && i >= 0; i--) {
        try {
          const req = await storageContract.requests(i);
          if (req.requester !== ethers.ZeroAddress) {
            // Find local date if exists
            const storedDates = JSON.parse(localStorage.getItem("procurement_dates") || "{}");
            const date = storedDates[i.toString()] || "Blockchain State";

            recentList.push({
              id: req.id.toString(),
              requester: req.requester,
              productName: req.productName,
              budget: ethers.formatEther(req.budget),
              processed: req.processed,
              date
            });
          }
        } catch (err) {
          console.error(`Error loading request ID ${i}:`, err);
        }
      }

      // Calculate pending / completed
      let completedRequests = 0;
      let pendingRequests = 0;
      
      // Check from block logs
      for (const log of procurementLogs) {
        try {
          const parsed = storageContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          if (parsed && parsed.args && parsed.args.requestId) {
            const reqId = parsed.args.requestId.toString();
            if (storedEvaluations.has(reqId)) {
              completedRequests++;
            } else {
              pendingRequests++;
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      // In case logs miss some (e.g. RPC filtering issues), fallback using requestCounter
      if (completedRequests + pendingRequests === 0 && totalRequests > 0) {
        pendingRequests = totalRequests;
      }

      setStats({
        totalRequests,
        totalParsedWebsites,
        totalRecommendations,
        pendingRequests,
        completedRequests
      });

      setRecentRequests(recentList);

    } catch (err: any) {
      console.error("Error loading dashboard metrics:", err);
      setError("Failed to query Somnia testnet contracts: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-brandCyan" />
        <p className="text-sm text-gray-400 font-medium font-sans">Connecting to Somnia Shannon Testnet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Banner / Intro */}
      <div className="relative rounded-3xl glass-panel p-8 border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brandPurple/20 to-brandCyan/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 rounded-xl bg-brandCyan/10 px-3 py-1 text-xs font-semibold text-brandCyan border border-brandCyan/20 mb-4">
            <Cpu className="h-3.5 w-3.5" />
            <span>Agentic Procurement Protocol</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Decentralized Autonomous Vendor Selection
          </h1>
          <p className="mt-4 text-sm text-gray-400 leading-relaxed">
            Submit procurement demands, parse vendor specifications on-chain via dedicated scrapers, and run LLM evaluation agents directly on the Somnia Testnet.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/create"
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-brandPurple to-brandCyan hover:opacity-90 px-5 py-3 text-sm font-semibold text-white transition-opacity"
            >
              <PlusCircle className="h-4.5 w-4.5" />
              <span>Create Request</span>
            </Link>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center space-x-2 rounded-xl bg-white/5 hover:bg-white/10 px-5 py-3 text-sm font-semibold text-white border border-white/10 transition-colors"
            >
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Demands</span>
            <Layers className="h-4 w-4 text-brandPurple" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white">{stats.totalRequests}</span>
            <p className="text-[9px] text-gray-500 mt-1 font-semibold">Total Storage Requests</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Websites Scraped</span>
            <Globe className="h-4 w-4 text-brandCyan" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white">{stats.totalParsedWebsites}</span>
            <p className="text-[9px] text-gray-500 mt-1 font-semibold">Parsed by Somnia Agents</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">LLM Recommendations</span>
            <Sparkles className="h-4 w-4 text-brandPink" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white">{stats.totalRecommendations}</span>
            <p className="text-[9px] text-gray-500 mt-1 font-semibold">Generated on Testnet</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
            <Clock className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white">{stats.pendingRequests}</span>
            <p className="text-[9px] text-gray-500 mt-1 font-semibold">Awaiting Final Evaluation</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white">{stats.completedRequests}</span>
            <p className="text-[9px] text-gray-500 mt-1 font-semibold">Evaluated and Closed</p>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="glass-panel rounded-3xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-brandCyan" />
            <h2 className="text-lg font-bold text-white">Recent Procurement Demands</h2>
          </div>
          <Link to="/history" className="text-xs font-semibold text-brandCyan hover:underline flex items-center space-x-1">
            <span>View All History</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="text-center py-10 bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
            <p className="text-xs text-gray-500">No procurement requests found on-chain. Create a request to begin!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {recentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-gray-400">#{req.id}</td>
                    <td className="py-4 px-4 font-semibold text-white">{req.productName}</td>
                    <td className="py-4 px-4 font-extrabold text-brandCyan">{req.budget} STT</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.processed
                          ? "bg-green-500/10 text-green-400 border border-green-500/10"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                      }`}>
                        {req.processed ? "Processed" : "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[10px] text-gray-500">{`${req.requester.substring(0, 8)}...${req.requester.substring(req.requester.length - 6)}`}</td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={`/request/${req.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brandPurple/10 text-brandPurple font-semibold border border-brandPurple/20 hover:bg-brandPurple/20 transition-all text-[11px]"
                      >
                        <span>View Workspace</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
