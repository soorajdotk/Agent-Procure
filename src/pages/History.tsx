import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import {
  PROCUREMENT_STORAGE_ADDRESS,
  PROCUREMENT_STORAGE_ABI,
  SOMNIA_TESTNET_CONFIG
} from "../contracts/config";
import { History as HistoryIcon, Loader2, ArrowRight, ExternalLink, Calendar, Search, RefreshCw } from "lucide-react";

interface HistoryItem {
  id: string;
  productName: string;
  requester: string;
  budget: string;
  processed: boolean;
  recommendationWinner?: string;
  overallScore?: string;
}

export const History: React.FC = () => {
  const { provider } = useWeb3();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const loadHistoryData = useCallback(async () => {
    const queryProvider =
      provider || new ethers.JsonRpcProvider("https://api.infra.testnet.somnia.network/");
    setLoading(true);
    setError(null);

    try {
      const storageContract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        queryProvider
      );

      // Get total request count — no getLogs needed, avoids block range RPC limit
      const counterVal = await storageContract.requestCounter();
      const total = Number(counterVal);
      setTotalCount(total);

      if (total === 0) {
        setHistory([]);
        return;
      }

      // Fetch all requests in parallel using direct contract reads (requests mapping)
      const requestPromises = Array.from({ length: total }, (_, i) =>
        storageContract.requests(i).catch(() => null)
      );
      const evaluationPromises = Array.from({ length: total }, (_, i) =>
        storageContract.evaluations(i).catch(() => null)
      );

      const [allRequests, allEvaluations] = await Promise.all([
        Promise.all(requestPromises),
        Promise.all(evaluationPromises)
      ]);

      const items: HistoryItem[] = [];

      for (let i = 0; i < total; i++) {
        const req = allRequests[i];
        if (!req || req.requester === ethers.ZeroAddress) continue;

        const evalData = allEvaluations[i];
        const winner =
          evalData && evalData.vendorName && evalData.vendorName.length > 0
            ? evalData.vendorName
            : undefined;
        const score =
          evalData && evalData.overallScore
            ? evalData.overallScore.toString()
            : undefined;

        items.push({
          id: req.id.toString(),
          productName: req.productName,
          requester: req.requester,
          budget: ethers.formatEther(req.budget),
          processed: req.processed,
          recommendationWinner: winner,
          overallScore: score
        });
      }

      // Show newest first
      items.reverse();
      setHistory(items);
    } catch (err: any) {
      console.error("Error loading history:", err);
      setError("Failed to load history from Somnia contracts: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  const filteredHistory = history.filter((item) => {
    const term = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(term) ||
      item.productName.toLowerCase().includes(term) ||
      item.requester.toLowerCase().includes(term) ||
      (item.recommendationWinner &&
        item.recommendationWinner.toLowerCase().includes(term))
    );
  });

  const formatAddress = (addr: string) =>
    `${addr.substring(0, 8)}...${addr.slice(-6)}`;

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <HistoryIcon className="h-7 w-7 text-brandCyan" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Procurement History Log
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              All {totalCount} on-chain procurement demands — read directly from contract state.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by ID, product, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brandCyan focus:bg-white/[0.07] transition-all"
            />
          </div>
          {/* Refresh */}
          <button
            onClick={loadHistoryData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-brandCyan" />
          <p className="text-sm text-gray-400">
            Loading {totalCount > 0 ? `${totalCount} records` : "records"} from contract...
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
          <HistoryIcon className="h-10 w-10 text-gray-700 mx-auto mb-3" />
          <p className="text-xs text-gray-500">
            {totalCount === 0
              ? "No procurement requests found on the Somnia Testnet."
              : "No matching records for your search."}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-black/20">
                  <th className="py-3.5 px-6">ID</th>
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-6">Budget</th>
                  <th className="py-3.5 px-6">Winner</th>
                  <th className="py-3.5 px-6">Score</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Requester</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-gray-400">#{item.id}</td>
                    <td className="py-4 px-6 font-semibold text-white">{item.productName}</td>
                    <td className="py-4 px-6 font-extrabold text-brandCyan">{item.budget} STT</td>
                    <td className="py-4 px-6">
                      {item.recommendationWinner ? (
                        <span className="text-brandPink font-bold">{item.recommendationWinner}</span>
                      ) : (
                        <span className="text-gray-600 italic text-[10px]">Pending</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {item.overallScore && item.overallScore !== "0" ? (
                        <span className="font-bold text-green-400">{item.overallScore}/100</span>
                      ) : (
                        <span className="text-gray-600 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.processed
                            ? "bg-green-500/10 text-green-400 border border-green-500/10"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                        }`}
                      >
                        {item.processed ? "Processed" : "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-[10px] text-gray-500">
                      <a
                        href={`${SOMNIA_TESTNET_CONFIG.blockExplorerUrls[0]}address/${item.requester}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brandCyan transition-colors flex items-center gap-1"
                      >
                        {formatAddress(item.requester)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        to={`/request/${item.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brandPurple/10 text-brandPurple font-semibold border border-brandPurple/20 hover:bg-brandPurple/20 transition-all text-[11px]"
                      >
                        <span>Workspace</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="border-t border-white/5 px-6 py-3 bg-black/10 flex justify-between items-center">
            <span className="text-[10px] text-gray-600 font-mono">
              Showing {filteredHistory.length} of {totalCount} total requests
            </span>
            <span className="text-[10px] text-gray-700">
              Contract: {PROCUREMENT_STORAGE_ADDRESS.substring(0, 10)}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
