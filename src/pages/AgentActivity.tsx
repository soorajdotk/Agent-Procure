import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import {
  PROCUREMENT_STORAGE_ADDRESS,
  PROCUREMENT_STORAGE_ABI,
  PARSE_WEBSITE_ADDRESS,
  PARSE_WEBSITE_ABI,
  AI_RECOMMENDATION_ADDRESS,
  AI_RECOMMENDATION_ABI,
  SOMNIA_TESTNET_CONFIG
} from "../contracts/config";
import { Cpu, Loader2, RefreshCw, Terminal, CheckCircle2, PlayCircle, Eye, ExternalLink } from "lucide-react";

interface ActivityItem {
  key: string;
  type: "create" | "parse_start" | "parse_done" | "llm_start" | "llm_done" | "store";
  title: string;
  description: string;
  blockNumber: number;
  txHash: string;
  timeString: string;
  color: string;
}

export const AgentActivity: React.FC = () => {
  const { provider } = useWeb3();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentActivity = useCallback(async () => {
    const queryProvider = provider || new ethers.JsonRpcProvider("https://api.infra.testnet.somnia.network/");
    setLoading(true);
    setError(null);

    try {
      const storageContract = new ethers.Contract(PROCUREMENT_STORAGE_ADDRESS, PROCUREMENT_STORAGE_ABI, queryProvider);
      const parseContract = new ethers.Contract(PARSE_WEBSITE_ADDRESS, PARSE_WEBSITE_ABI, queryProvider);
      const aiContract = new ethers.Contract(AI_RECOMMENDATION_ADDRESS, AI_RECOMMENDATION_ABI, queryProvider);

      // Topic definitions
      const topics = {
        procurementCreated: ethers.id("ProcurementCreated(uint256,address,string)"),
        evaluationStored: ethers.id("EvaluationStored(uint256,string,uint256)"),
        parsingRequested: ethers.id("ParsingRequested(uint256,string)"),
        parsingCompleted: ethers.id("ParsingCompleted(uint256,string)"),
        analysisRequested: ethers.id("AnalysisRequested(uint256)"),
        analysisCompleted: ethers.id("AnalysisCompleted(uint256,string)")
      };

      // Query logs in parallel
      const [
        procLogs,
        evalLogs,
        parseReqLogs,
        parseDoneLogs,
        aiReqLogs,
        aiDoneLogs
      ] = await Promise.all([
        queryProvider.getLogs({ address: PROCUREMENT_STORAGE_ADDRESS, topics: [topics.procurementCreated], fromBlock: 0, toBlock: "latest" }),
        queryProvider.getLogs({ address: PROCUREMENT_STORAGE_ADDRESS, topics: [topics.evaluationStored], fromBlock: 0, toBlock: "latest" }),
        queryProvider.getLogs({ address: PARSE_WEBSITE_ADDRESS, topics: [topics.parsingRequested], fromBlock: 0, toBlock: "latest" }),
        queryProvider.getLogs({ address: PARSE_WEBSITE_ADDRESS, topics: [topics.parsingCompleted], fromBlock: 0, toBlock: "latest" }),
        queryProvider.getLogs({ address: AI_RECOMMENDATION_ADDRESS, topics: [topics.analysisRequested], fromBlock: 0, toBlock: "latest" }),
        queryProvider.getLogs({ address: AI_RECOMMENDATION_ADDRESS, topics: [topics.analysisCompleted], fromBlock: 0, toBlock: "latest" })
      ]);

      const items: ActivityItem[] = [];

      // 1. Process Create Requests
      for (const log of procLogs) {
        try {
          const parsed = storageContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `create-${log.transactionHash}-${parsed.args.requestId}`,
              type: "create",
              title: "Request Created",
              description: `Procurement demand #${parsed.args.requestId} initiated for: "${parsed.args.productName}"`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-brandCyan border-brandCyan/30 bg-brandCyan/5"
            });
          }
        } catch (e) {}
      }

      // 2. Process Parse Requests Start
      for (const log of parseReqLogs) {
        try {
          const parsed = parseContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `parse-start-${log.transactionHash}-${parsed.args.requestId}`,
              type: "parse_start",
              title: "Website Parsing Triggered",
              description: `Scraper Agent called to crawl vendor page (Parse Request #${parsed.args.requestId})`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5"
            });
          }
        } catch (e) {}
      }

      // 3. Process Parse Requests Done
      for (const log of parseDoneLogs) {
        try {
          const parsed = parseContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `parse-done-${log.transactionHash}-${parsed.args.requestId}`,
              type: "parse_done",
              title: "Parsing Completed",
              description: `Scraper Agent successfully processed details for Parse Request #${parsed.args.requestId}`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-green-400 border-green-500/30 bg-green-500/5"
            });
          }
        } catch (e) {}
      }

      // 4. Process LLM Start
      for (const log of aiReqLogs) {
        try {
          const parsed = aiContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `ai-start-${log.transactionHash}-${parsed.args.requestId}`,
              type: "llm_start",
              title: "LLM Analysis Started",
              description: `Somnia LLM agent analyzing vendor parameters (Agent Request #${parsed.args.requestId})`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-brandPurple border-brandPurple/30 bg-brandPurple/5"
            });
          }
        } catch (e) {}
      }

      // 5. Process LLM Done
      for (const log of aiDoneLogs) {
        try {
          const parsed = aiContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `ai-done-${log.transactionHash}-${parsed.args.requestId}`,
              type: "llm_done",
              title: "Recommendation Generated",
              description: `LLM evaluation agent generated decision logs for Request #${parsed.args.requestId}`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-brandPink border-brandPink/30 bg-brandPink/5"
            });
          }
        } catch (e) {}
      }

      // 6. Process Store Evaluation
      for (const log of evalLogs) {
        try {
          const parsed = storageContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.args) {
            items.push({
              key: `store-${log.transactionHash}-${parsed.args.requestId}`,
              type: "store",
              title: "Stored On Chain",
              description: `Final assessment metrics for Request #${parsed.args.requestId} locked on-chain. Selected: "${parsed.args.vendorName}"`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              timeString: `Block #${log.blockNumber}`,
              color: "text-green-500 border-green-500/50 bg-green-500/10"
            });
          }
        } catch (e) {}
      }

      // Sort by block number descending
      items.sort((a, b) => b.blockNumber - a.blockNumber);
      setActivities(items.slice(0, 30)); // Display latest 30 events

    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch live agent activity: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchAgentActivity();
  }, [fetchAgentActivity]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Cpu className="h-7 w-7 text-brandCyan animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Agent Activity Console
            </h1>
            <p className="text-xs text-gray-500 font-medium">Real-time event logs of Somnia Web Scraping & LLM Agents.</p>
          </div>
        </div>

        <button
          onClick={fetchAgentActivity}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-gray-300 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Console</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-brandCyan" />
          <p className="text-sm text-gray-400">Listening for agent event emissions...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/5">
          <p className="text-xs text-gray-500">No agent transactions recorded on the Somnia Testnet.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-6 border border-white/5 relative overflow-hidden">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-4 mb-6">
            <Terminal className="h-4.5 w-4.5 text-gray-500" />
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Protocol Activity Terminal</span>
          </div>

          <div className="relative border-l border-white/5 pl-6 ml-3 space-y-8 font-mono text-xs">
            {activities.map((act) => (
              <div key={act.key} className="relative group">
                {/* Visual marker dot */}
                <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-darkBg shadow-md ${
                  act.type === "store" || act.type === "parse_done" 
                    ? "bg-green-500" 
                    : act.type === "llm_done"
                      ? "bg-brandPink"
                      : act.type === "llm_start"
                        ? "bg-brandPurple"
                        : "bg-brandCyan"
                }`}>
                  {act.type === "store" || act.type === "parse_done" ? (
                    <CheckCircle2 className="h-3 w-3 text-darkBg" />
                  ) : (
                    <PlayCircle className="h-3 w-3 text-darkBg" />
                  )}
                </span>

                <div className={`p-4 border rounded-2xl transition-all duration-300 group-hover:bg-white/[0.02] ${act.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm tracking-wide">{act.title}</span>
                    <span className="text-[10px] text-gray-500 font-semibold">{act.timeString}</span>
                  </div>
                  
                  <p className="text-gray-300 leading-relaxed text-xs font-sans mb-3">{act.description}</p>
                  
                  <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-white/5 pt-2 mt-2">
                    <span className="font-semibold">Tx: {act.txHash.substring(0, 14)}...</span>
                    <a
                      href={`${SOMNIA_TESTNET_CONFIG.blockExplorerUrls[0]}tx/${act.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brandCyan hover:text-brandCyan/80 font-bold flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Verify Block</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
