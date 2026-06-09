import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import {
  PROCUREMENT_STORAGE_ADDRESS,
  PROCUREMENT_STORAGE_ABI,
  SOMNIA_TESTNET_CONFIG
} from "../contracts/config";
import { History as HistoryIcon, Loader2, ArrowRight, ExternalLink, Calendar, Search } from "lucide-react";

interface HistoryItem {
  id: string;
  productName: string;
  requester: string;
  budget: string;
  processed: boolean;
  txHash: string;
  timestamp: number; // Block timestamp
  recommendationWinner?: string;
}

export const History: React.FC = () => {
  const { provider } = useWeb3();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadHistoryLogs = useCallback(async () => {
    const queryProvider = provider || new ethers.JsonRpcProvider("https://api.infra.testnet.somnia.network/");
    setLoading(true);
    setError(null);

    try {
      const storageContract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        queryProvider
      );

      const procurementTopic = ethers.id("ProcurementCreated(uint256,address,string)");
      const evaluationTopic = ethers.id("EvaluationStored(uint256,string,uint256)");

      // Fetch logs
      const [procureLogs, evalLogs] = await Promise.all([
        queryProvider.getLogs({
          address: PROCUREMENT_STORAGE_ADDRESS,
          topics: [procurementTopic],
          fromBlock: 0,
          toBlock: "latest"
        }),
        queryProvider.getLogs({
          address: PROCUREMENT_STORAGE_ADDRESS,
          topics: [evaluationTopic],
          fromBlock: 0,
          toBlock: "latest"
        })
      ]);

      // Parse evaluations to map by ID
      const evalMap = new Map<string, { winner: string; score: number }>();
      for (const log of evalLogs) {
        try {
          const parsed = storageContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          if (parsed && parsed.args) {
            evalMap.set(parsed.args.requestId.toString(), {
              winner: parsed.args.vendorName,
              score: Number(parsed.args.score)
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // Parse procurements
      const items: HistoryItem[] = [];
      const blockPromises: Promise<any>[] = [];
      const requestPromises: Promise<any>[] = [];

      for (const log of procureLogs) {
        try {
          const parsed = storageContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });

          if (parsed && parsed.args) {
            const reqId = parsed.args.requestId.toString();
            
            // Queue contract state details load
            requestPromises.push(storageContract.requests(reqId));
            
            // Queue block data load to get block timestamp
            blockPromises.push(queryProvider.getBlock(log.blockNumber));

            items.push({
              id: reqId,
              productName: parsed.args.productName,
              requester: parsed.args.requester,
              budget: "0",
              processed: false,
              txHash: log.transactionHash,
              timestamp: Date.now() / 1000 // Temporary fallback
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // Resolve all details in parallel
      const resolvedRequests = await Promise.all(requestPromises);
      const resolvedBlocks = await Promise.all(blockPromises);

      // Merge data
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const reqDetail = resolvedRequests[index];
        const blockDetail = resolvedBlocks[index];

        if (reqDetail) {
          item.budget = ethers.formatEther(reqDetail.budget);
          item.processed = reqDetail.processed;
        }

        if (blockDetail) {
          item.timestamp = blockDetail.timestamp;
        }

        // Attach recommendation winner if processed
        const ev = evalMap.get(item.id);
        if (ev) {
          item.recommendationWinner = ev.winner;
        }
      }

      // Sort by timestamp descending
      items.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(items);

    } catch (err: any) {
      console.error("Error loading history logs:", err);
      setError("Failed to query history logs from Somnia contracts: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadHistoryLogs();
  }, [loadHistoryLogs]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredHistory = history.filter((item) => {
    const term = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(term) ||
      item.productName.toLowerCase().includes(term) ||
      item.requester.toLowerCase().includes(term) ||
      (item.recommendationWinner && item.recommendationWinner.toLowerCase().includes(term))
    );
  });

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
            <p className="text-xs text-gray-500 font-medium">Audit logs of all submitted demands and contract evaluations.</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search log history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brandCyan focus:bg-white/[0.07] transition-all"
          />
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
          <p className="text-sm text-gray-400">Reconstructing event logs...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
          <p className="text-xs text-gray-500">No matching procurement records found on the Somnia Testnet.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-wider bg-black/20">
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">ID</th>
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-6">Budget</th>
                  <th className="py-3.5 px-6">Recommendation</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 px-6 text-gray-400 font-medium">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                        <span>{formatDate(item.timestamp)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-gray-400">#{item.id}</td>
                    <td className="py-4 px-6 font-semibold text-white">{item.productName}</td>
                    <td className="py-4 px-6 font-extrabold text-brandCyan">{item.budget} STT</td>
                    <td className="py-4 px-6">
                      {item.recommendationWinner ? (
                        <span className="text-brandPink font-bold">{item.recommendationWinner}</span>
                      ) : (
                        <span className="text-gray-500 italic">No Recommendation Stored</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.processed
                          ? "bg-green-500/10 text-green-400 border border-green-500/10"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                      }`}>
                        {item.processed ? "Processed" : "Pending"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <a
                          href={`${SOMNIA_TESTNET_CONFIG.blockExplorerUrls[0]}tx/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-brandCyan transition-colors"
                          title="View Transaction"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Link
                          to={`/request/${item.id}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brandPurple/10 text-brandPurple font-semibold border border-brandPurple/20 hover:bg-brandPurple/20 transition-all text-[11px]"
                        >
                          <span>Workspace</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
