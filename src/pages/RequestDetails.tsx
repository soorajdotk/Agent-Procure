import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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

console.log("PARSE_WEBSITE_ADDRESS:", PARSE_WEBSITE_ADDRESS);

import {
  Globe,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Sliders,
  Send
} from "lucide-react";

interface RequestData {
  id: string;
  requester: string;
  productName: string;
  budget: string;
  processed: boolean;
}

interface ParsingState {
  status: "idle" | "submitting" | "parsing" | "completed" | "failed";
  parseRequestId: string;
  resultText: string;
  txHash: string;
  error?: string;
}

interface AIState {
  status: "idle" | "submitting" | "analyzing" | "completed" | "failed";
  agentRequestId: string;
  resultText: string;
  winner: string;
  reason: string;
  txHash: string;
  error?: string;
}

interface EvaluationState {
  status: "idle" | "submitting" | "stored" | "failed";
  txHash: string;
  priceScore: number;
  qualityScore: number;
  reliabilityScore: number;
  overallScore: number;
  storedWinner?: string;
  storedRecommendation?: string;
}

export const RequestDetails: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const { provider, signer, isConnected } = useWeb3();

  // On-Chain request data
  const [request, setRequest] = useState<RequestData | null>(null);
  const [vendorUrls, setVendorUrls] = useState<string[]>([]);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Parsing states for the 3 URLs
  const [parsingStates, setParsingStates] = useState<Record<number, ParsingState>>({
    0: { status: "idle", parseRequestId: "", resultText: "", txHash: "" },
    1: { status: "idle", parseRequestId: "", resultText: "", txHash: "" },
    2: { status: "idle", parseRequestId: "", resultText: "", txHash: "" }
  });
  // Ref to always have fresh parsingStates inside async callbacks (avoids stale closure)
  const parsingStatesRef = React.useRef<Record<number, ParsingState>>({
    0: { status: "idle", parseRequestId: "", resultText: "", txHash: "" },
    1: { status: "idle", parseRequestId: "", resultText: "", txHash: "" },
    2: { status: "idle", parseRequestId: "", resultText: "", txHash: "" }
  });

  // AI Recommendation state
  const [aiState, setAiState] = useState<AIState>({
    status: "idle",
    agentRequestId: "",
    resultText: "",
    winner: "",
    reason: "",
    txHash: ""
  });

  // On-chain stored evaluation status
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evaluationState, setEvaluationState] = useState<EvaluationState>({
    status: "idle",
    txHash: "",
    priceScore: 80,
    qualityScore: 80,
    reliabilityScore: 80,
    overallScore: 80
  });

  // Load from localStorage on mount
  useEffect(() => {
    if (!requestId) return;
    
    const storedParsing = localStorage.getItem(`procurement_parsing_${requestId}`);
    if (storedParsing) {
      try { setParsingStates(JSON.parse(storedParsing)); } catch (e) { console.error(e); }
    }

    const storedAi = localStorage.getItem(`procurement_ai_${requestId}`);
    if (storedAi) {
      try { setAiState(JSON.parse(storedAi)); } catch (e) { console.error(e); }
    }
  }, [requestId]);

  // Persist states to localStorage — always merges a single index update safely
  const updateParsingState = (index: number, partial: Partial<ParsingState>) => {
    setParsingStates(prev => {
      const next = {
        ...prev,
        [index]: { ...prev[index], ...partial }
      };
      parsingStatesRef.current = next;
      if (requestId) {
        localStorage.setItem(`procurement_parsing_${requestId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Keep ref in sync when state is loaded from localStorage
  const saveParsingStates = (states: Record<number, ParsingState>) => {
    parsingStatesRef.current = states;
    setParsingStates(states);
    if (requestId) {
      localStorage.setItem(`procurement_parsing_${requestId}`, JSON.stringify(states));
    }
  };

  const saveAiState = (state: AIState) => {
    setAiState(state);
    if (requestId) {
      localStorage.setItem(`procurement_ai_${requestId}`, JSON.stringify(state));
    }
  };

  // Fetch initial request data from smart contract
  const fetchRequestData = useCallback(async () => {
    if (!requestId || !provider) return;
    setLoadingRequest(true);
    setLoadError(null);

    try {
      const contract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        provider
      );

      const req = await contract.requests(requestId);
      if (req.requester === ethers.ZeroAddress) {
        setLoadError("Request not found on-chain.");
        setLoadingRequest(false);
        return;
      }

      setRequest({
        id: req.id.toString(),
        requester: req.requester,
        productName: req.productName,
        budget: ethers.formatEther(req.budget),
        processed: req.processed
      });

      const urls = await contract.getVendorUrls(requestId);
      setVendorUrls(urls);

      // Check if there is an evaluation stored on chain
      if (req.processed) {
        const evalData = await contract.evaluations(requestId);
        if (evalData.vendorName) {
          setEvaluation({
            vendorName: evalData.vendorName,
            priceScore: evalData.priceScore.toString(),
            qualityScore: evalData.qualityScore.toString(),
            reliabilityScore: evalData.reliabilityScore.toString(),
            overallScore: evalData.overallScore.toString(),
            recommendation: evalData.recommendation
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setLoadError("Failed to load data from blockchain: " + (err.reason || err.message));
    } finally {
      setLoadingRequest(false);
    }
  }, [requestId, provider]);

  useEffect(() => {
    if (provider) {
      fetchRequestData();
    }
  }, [provider, fetchRequestData]);

  // Website parsing logic — uses updateParsingState to avoid stale closure overwrites
  const handleParseWebsite = async (urlIndex: number, url: string) => {
    if (!signer || !isConnected) {
      alert("Please connect your wallet first.");
      return;
    }

    // Mark this specific URL as submitting (functional update — safe for concurrent calls)
    updateParsingState(urlIndex, {
      status: "submitting",
      parseRequestId: "",
      resultText: "",
      txHash: "",
      error: undefined
    });

    try {
      const contract = new ethers.Contract(
        PARSE_WEBSITE_ADDRESS,
        PARSE_WEBSITE_ABI,
        signer
      );

      // Use getRequiredDeposit() — now available on the new contract
      let valueToSend: bigint;
      try {
        const deposit = await contract.getRequiredDeposit();
        valueToSend = BigInt(deposit.toString());
        console.log("[parseWebsite] getRequiredDeposit():", ethers.formatEther(valueToSend), "STT");
      } catch {
        // Fallback to confirmed working value from Remix testing
        valueToSend = ethers.parseEther("3.3");
        console.warn("[parseWebsite] getRequiredDeposit() failed, using 3.3 STT fallback");
      }

      console.log("Calling parseWebsite with:");
      console.log("  Contract:", PARSE_WEBSITE_ADDRESS);
      console.log("  URL:", url);
      console.log("  Value:", ethers.formatEther(valueToSend), "STT");

      const tx = await contract.parseWebsite(url, { value: valueToSend });

      // Transaction submitted to mempool — update to "parsing"
      updateParsingState(urlIndex, { status: "parsing", txHash: tx.hash });

      const receipt = await tx.wait();
      
      // Extract parseRequestId from receipt events
      let parseId = "";
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          if (parsedLog && parsedLog.name === "ParseRequested") {
            parseId = parsedLog.args.requestId.toString();
            break;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!parseId) {
        throw new Error("Could not extract parse request ID from transaction logs.");
      }

      updateParsingState(urlIndex, { parseRequestId: parseId });

    } catch (err: any) {
      console.error(err);
      updateParsingState(urlIndex, {
        status: "failed",
        error: err.reason || err.message || "Failed to submit parsing request."
      });
    }
  };

  // Watch for ParsingCompleted events + fallback pendingRequests polling
  useEffect(() => {
    const activeItems = Object.entries(parsingStates)
      .filter(([_, state]) => state.status === "parsing" && state.parseRequestId)
      .map(([index, state]) => ({ index: Number(index), parseRequestId: state.parseRequestId }));

    if (activeItems.length === 0 || !provider) return;

    // Watch for ParseCompleted / ParseFailed events + fallback results() polling
    const checkCompletion = async () => {
      const contract = new ethers.Contract(
        PARSE_WEBSITE_ADDRESS,
        PARSE_WEBSITE_ABI,
        provider
      );

      for (const { index, parseRequestId } of activeItems) {
        // Skip already-completed slots (check ref for freshness)
        if (parsingStatesRef.current[index]?.status === "completed") continue;

        try {
          const parseIdBN = BigInt(parseRequestId);

          // Strategy 1: Check ParseCompleted event logs for this requestId
          // Limit to last 900 blocks to stay within Somnia testnet RPC limit (max 1000 blocks)
          const latestBlock = await provider.getBlockNumber();
          const fromBlock = Math.max(0, latestBlock - 900);

          // Check ParseCompleted
          const completedFilter = contract.filters.ParseCompleted(parseIdBN);
          const completedLogs = await contract.queryFilter(completedFilter, fromBlock, "latest");

          if (completedLogs.length > 0) {
            const eventLog = completedLogs[0] as any;
            const resultFromEvent = eventLog.args?.result || eventLog.args?.[1] || "";
            updateParsingState(index, {
              status: "completed",
              resultText: resultFromEvent || "Parsing completed (no text returned)."
            });
            continue;
          }

          // Check ParseFailed
          const failedFilter = contract.filters.ParseFailed(parseIdBN);
          const failedLogs = await contract.queryFilter(failedFilter, fromBlock, "latest");

          if (failedLogs.length > 0) {
            const failedLog = failedLogs[0] as any;
            const failStatus = failedLog.args?.status ?? "unknown";
            updateParsingState(index, {
              status: "failed",
              error: `Agent returned ParseFailed (status code: ${failStatus}). Try re-parsing.`
            });
            continue;
          }

          // Strategy 2: Check results() mapping directly
          const resultData = await contract.results(parseRequestId);
          if (resultData.completed || resultData[2]) {
            const extractedData = resultData.result || resultData[1] || "";
            updateParsingState(index, {
              status: "completed",
              resultText: extractedData || "Parsing completed (no text returned)."
            });
            continue;
          }

          // Strategy 3: Fallback — getResult()
          const [resultText, completed] = await contract.getResult(parseRequestId);
          if (completed || resultText) {
            updateParsingState(index, {
              status: "completed",
              resultText: resultText || "Parsing completed (no text returned)."
            });
          }

        } catch (err) {
          console.error(`Error checking parse status for id ${parseRequestId}:`, err);
        }
      }
    };

    // Run immediately, then every 8 seconds
    checkCompletion();
    const interval = setInterval(checkCompletion, 8000);
    return () => clearInterval(interval);
  }, [parsingStates, provider]);

  // AI Recommendation logic
  const handleAIAnalyze = async () => {
    if (!signer || !isConnected) {
      alert("Please connect your wallet first.");
      return;
    }

    // Double check all 3 parsed results are ready
    const allParsed = Object.values(parsingStates).every(
      (state) => state.status === "completed"
    );
    if (!allParsed) {
      alert("Please complete parsing all three websites first.");
      return;
    }

    saveAiState({
      status: "submitting",
      agentRequestId: "",
      resultText: "",
      winner: "",
      reason: "",
      txHash: ""
    });

    try {
      const contract = new ethers.Contract(
        AI_RECOMMENDATION_ADDRESS,
        AI_RECOMMENDATION_ABI,
        signer
      );

      // Get required deposit
      const deposit = await contract.getRequiredDeposit();

      // Construct prompt dynamically
      const prompt = `Vendor 1:
${parsingStates[0].resultText}

Vendor 2:
${parsingStates[1].resultText}

Vendor 3:
${parsingStates[2].resultText}

Choose the best procurement vendor.
Return:
Winner:
Reason:`;

      const tx = await contract.analyzeVendors(prompt, { value: deposit });
      
      saveAiState({
        status: "analyzing",
        agentRequestId: "",
        resultText: "",
        winner: "",
        reason: "",
        txHash: tx.hash
      });

      const receipt = await tx.wait();

      // Extract agentRequestId from events
      let agentId = "";
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          if (parsedLog && parsedLog.name === "AnalysisRequested") {
            agentId = parsedLog.args.requestId.toString();
            break;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!agentId) {
        throw new Error("Could not parse analysis request ID from events.");
      }

      saveAiState({
        status: "analyzing",
        agentRequestId: agentId,
        resultText: "",
        winner: "",
        reason: "",
        txHash: tx.hash
      });

    } catch (err: any) {
      console.error(err);
      saveAiState({
        status: "failed",
        agentRequestId: "",
        resultText: "",
        winner: "",
        reason: "",
        txHash: "",
        error: err.reason || err.message || "Failed to submit AI evaluation prompt."
      });
    }
  };

  // Poll for AI completion
  useEffect(() => {
    if (aiState.status !== "analyzing" || !aiState.agentRequestId || !provider) return;

    const interval = setInterval(async () => {
      try {
        const contract = new ethers.Contract(
          AI_RECOMMENDATION_ADDRESS,
          AI_RECOMMENDATION_ABI,
          provider
        );

        const isPending = await contract.pendingRequests(aiState.agentRequestId);
        if (!isPending) {
          const [resultText, completed] = await contract.recommendations(aiState.agentRequestId);
          if (completed || resultText) {
            // Parse Winner and Reason dynamically from resultText
            // e.g. "Winner: Vendor Name" or "Winner:\nVendor Name"
            let winner = "Unknown Winner";
            let reason = "No reason provided.";

            const winnerRegex = /Winner:\s*([^\n\r]+)/i;
            const reasonRegex = /Reason:\s*([\s\S]+)/i;

            const wMatch = resultText.match(winnerRegex);
            const rMatch = resultText.match(reasonRegex);

            if (wMatch && wMatch[1]) {
              winner = wMatch[1].trim();
            } else {
              // Try fallback lines
              const lines = resultText.split("\n");
              const wl = lines.find((l: string) => l.toLowerCase().startsWith("winner:"));
              if (wl) winner = wl.replace(/winner:/i, "").trim();
            }

            if (rMatch && rMatch[1]) {
              reason = rMatch[1].trim();
            } else {
              const lines = resultText.split("\n");
              const rlIndex = lines.findIndex((l: string) => l.toLowerCase().startsWith("reason:"));
              if (rlIndex !== -1) {
                reason = lines.slice(rlIndex).join("\n").replace(/reason:/i, "").trim();
              }
            }

            saveAiState({
              status: "completed",
              agentRequestId: aiState.agentRequestId,
              resultText,
              winner,
              reason,
              txHash: aiState.txHash
            });
          }
        }
      } catch (err) {
        console.error("Error polling AI recommendations:", err);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [aiState, provider]);

  // Submit evaluation on-chain
  const handleSubmitEvaluation = async () => {
    if (!signer || !isConnected || !request) return;

    setEvaluationState((prev) => ({ ...prev, status: "submitting" }));

    try {
      const storageContract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        signer
      );

      const tx = await storageContract.storeEvaluation(
        requestId,
        aiState.winner || "AI Recommendation Winner",
        evaluationState.priceScore,
        evaluationState.qualityScore,
        evaluationState.reliabilityScore,
        evaluationState.overallScore,
        aiState.resultText || "Recommendation complete."
      );

      await tx.wait();

      setEvaluationState((prev) => ({
        ...prev,
        status: "stored",
        txHash: tx.hash,
        storedWinner: aiState.winner,
        storedRecommendation: aiState.resultText
      }));

      // Reload page state to load the newly stored evaluation
      fetchRequestData();

    } catch (err: any) {
      console.error(err);
      setEvaluationState((prev) => ({
        ...prev,
        status: "failed"
      }));
      alert("Failed to submit evaluation to Storage Contract: " + (err.reason || err.message));
    }
  };

  const handleScoreChange = (field: keyof EvaluationState, value: number) => {
    setEvaluationState((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Manual force-complete for a specific URL if agent is confirmed done but event was missed
  const handleManualComplete = (urlIndex: number) => {
    updateParsingState(urlIndex, {
      status: "completed",
      resultText: `Parse request #${parsingStates[urlIndex]?.parseRequestId} confirmed. Agent completed on-chain (manually acknowledged).`
    });
  };

  if (loadingRequest) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-brandCyan" />
        <p className="text-sm text-gray-400 font-medium">Fetching contract state...</p>
      </div>
    );
  }

  if (loadError || !request) {
    return (
      <div className="glass-panel max-w-xl mx-auto rounded-3xl p-8 border border-red-500/20 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Failed to Load Request</h2>
        <p className="text-sm text-gray-400 mb-6">{loadError || "Request not found."}</p>
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-brandCyan hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  // LLM button appears when all VENDOR URLs have been either completed or at least all triggered
  // Require at minimum: all parsing states are NOT idle and NOT submitting
  const completedCount = Object.values(parsingStates).filter(s => s.status === "completed").length;
  const allUrlsParsed = vendorUrls.length > 0 && completedCount === vendorUrls.length;
  const anyParsing = Object.values(parsingStates).some(s => s.status === "parsing" || s.status === "submitting");

  return (
    <div className="space-y-8">
      {/* Back to dashboard */}
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
        <span className="text-xs text-gray-500">
          Network ID: <span className="font-mono text-gray-400">{SOMNIA_TESTNET_CONFIG.chainId}</span>
        </span>
      </div>

      {/* Grid: Overview & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Overview Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brandPurple/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] text-brandCyan font-bold tracking-wider uppercase">Procurement Storage</p>
                <h1 className="text-2xl font-extrabold text-white mt-1">{request.productName}</h1>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                request.processed 
                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                  : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              }`}>
                {request.processed ? "Processed & Saved" : "Awaiting Evaluation"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 border-t border-white/5 pt-6">
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Request ID</span>
                <span className="text-sm font-mono text-gray-300 font-bold">#{request.id}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Budget</span>
                <span className="text-sm text-brandCyan font-extrabold">{request.budget} STT</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Requester Address</span>
                <span className="text-xs font-mono text-gray-400 break-all">{request.requester}</span>
              </div>
            </div>
          </div>

          {/* PAGE 3: WEBSITE PARSING SECTION */}
          <div className="glass-panel rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Globe className="h-5 w-5 text-brandCyan" />
                <span>Step 1: Website Scraping & Parsing</span>
              </h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                allUrlsParsed
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : anyParsing
                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "bg-white/5 text-gray-400 border-white/10"
              }`}>
                {completedCount}/{vendorUrls.length} Parsed
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-1">
              Somnia website agent parses the vendor pages. Requires sending a deposit of 0.1 STT per site.
            </p>
            <p className="text-[10px] text-gray-600 mb-6">
              If parsing stays yellow for &gt;2 min, verify on the block explorer then click <span className="text-yellow-400">"Agent finished? Mark complete"</span>.
            </p>

            <div className="space-y-4">
              {vendorUrls.map((url, index) => {
                const parseState = parsingStates[index] || { status: "idle", parseRequestId: "", resultText: "", txHash: "" };
                return (
                  <div key={index} className="border border-white/5 bg-white/[0.02] rounded-2xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-brandPurple block mb-1">VENDOR URL #{index + 1}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-300 font-medium truncate flex items-center hover:text-brandCyan transition-colors">
                          <span className="truncate max-w-[320px]">{url}</span>
                          <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                        </a>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {parseState.status === "idle" && (
                          <button
                            onClick={() => handleParseWebsite(index, url)}
                            disabled={!isConnected}
                            className="text-xs px-4 py-2 rounded-xl bg-brandCyan/10 hover:bg-brandCyan/20 text-brandCyan font-semibold border border-brandCyan/20 transition-all"
                          >
                            Parse Website (3.3 STT)
                          </button>
                        )}
                        {parseState.status === "submitting" && (
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin text-brandCyan" />
                            <span>Confirming...</span>
                          </div>
                        )}
                        {parseState.status === "parsing" && (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center space-x-2 text-xs text-yellow-400 bg-yellow-500/5 px-3 py-1.5 rounded-lg border border-yellow-500/15">
                              <Clock className="h-4 w-4 animate-pulse" />
                              <span>Parsing On-Chain... (ID #{parseState.parseRequestId})</span>
                            </div>
                            {/* Manual override: if agent is done on-chain but event wasn't caught */}
                            <button
                              onClick={() => handleManualComplete(index)}
                              className="text-[10px] px-3 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 transition-all"
                              title="Use this if you confirmed the transaction completed on-chain but the UI hasn't updated"
                            >
                              ✓ Agent finished? Mark complete
                            </button>
                          </div>
                        )}
                        {parseState.status === "completed" && (
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center space-x-1 text-xs text-green-400 bg-green-500/5 px-3 py-1.5 rounded-lg border border-green-500/15">
                              <CheckCircle className="h-4 w-4" />
                              <span>Parsed & Stored</span>
                            </div>
                            {parseState.parseRequestId && (
                              <div className="flex items-center space-x-1.5 text-[10px] text-gray-500 font-mono bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5">
                                <span className="text-gray-600">Agent ID:</span>
                                <span className="text-brandCyan font-bold">#{parseState.parseRequestId}</span>
                              </div>
                            )}
                            {parseState.txHash && (
                              <a
                                href={`https://shannon-explorer.somnia.network/tx/${parseState.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 text-[10px] text-gray-500 hover:text-brandCyan transition-colors font-mono"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>{parseState.txHash.substring(0, 10)}...{parseState.txHash.slice(-6)}</span>
                              </a>
                            )}
                            <button
                              onClick={() => updateParsingState(index, { status: "idle", parseRequestId: "", resultText: "", txHash: "", error: undefined })}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 border border-white/5 transition-all"
                            >
                              ↺ Reset
                            </button>
                          </div>
                        )}
                        {parseState.status === "failed" && (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center space-x-1 text-xs text-red-400 bg-red-500/5 px-3 py-1.5 rounded-lg border border-red-500/15">
                              <AlertCircle className="h-4 w-4" />
                              <span>Failed</span>
                            </div>
                            <button
                              onClick={() => handleParseWebsite(index, url)}
                              className="text-[10px] px-3 py-1 rounded-lg bg-brandCyan/10 hover:bg-brandCyan/20 text-brandCyan border border-brandCyan/20 transition-all"
                            >
                              Retry Parse
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Show parse results or error */}
                    {parseState.error && (
                      <div className="mt-3 p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-[11px] text-red-400 break-all">
                        {parseState.error}
                      </div>
                    )}
                    {parseState.resultText && (
                      <div className="mt-4 border-t border-white/5 pt-3">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Extracted Vendor Data</span>
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 max-h-36 overflow-y-auto text-[11px] font-mono text-gray-400 whitespace-pre-wrap">
                          {parseState.resultText}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* PAGE 4: AI RECOMMENDATION ENGINE */}
          {allUrlsParsed && (
            <div className="glass-panel rounded-3xl p-6 border border-brandPurple/20 relative">
              {/* Corner cyan lighting effect */}
              <div className="absolute -top-[1px] -left-[1px] w-12 h-12 border-t border-l border-brandCyan rounded-tl-3xl"></div>
              
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 mb-4">
                <Sparkles className="h-5 w-5 text-brandPurple animate-pulse" />
                <span>Step 2: AI Recommendation Engine</span>
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                Trigger Somnia LLM Agent to analyze vendor details and pick the best option. Evaluates cost vs capability.
              </p>

              {aiState.status === "idle" && (
                <button
                  onClick={handleAIAnalyze}
                  className="w-full py-4 bg-gradient-to-r from-brandPurple to-brandCyan hover:opacity-90 rounded-2xl font-bold text-sm text-white flex items-center justify-center space-x-2 shadow-lg shadow-brandPurple/10 transition-transform hover:scale-[1.01]"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Execute LLM Agent Analysis</span>
                </button>
              )}

              {aiState.status === "submitting" && (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <Loader2 className="h-7 w-7 animate-spin text-brandPurple" />
                  <span className="text-xs text-gray-400">Requesting MetaMask confirmation...</span>
                </div>
              )}

              {aiState.status === "analyzing" && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                  <Loader2 className="h-8 w-8 animate-spin text-brandCyan" />
                  <span className="text-xs text-yellow-400 font-semibold animate-pulse">
                    Somnia LLM Processing Request #{aiState.agentRequestId}...
                  </span>
                  <p className="text-[10px] text-gray-500">Estimated response time: 20-30 seconds. Polling network.</p>
                </div>
              )}

              {aiState.status === "failed" && (
                <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-xs text-red-400 space-y-3">
                  <p className="font-semibold">Analysis execution failed:</p>
                  <p className="font-mono text-[10px] bg-black/40 p-2 rounded">{aiState.error}</p>
                  <button onClick={handleAIAnalyze} className="text-xs px-4 py-2 bg-brandPurple/20 text-brandPurple rounded-lg border border-brandPurple/30 hover:bg-brandPurple/30">
                    Retry Analysis
                  </button>
                </div>
              )}

              {aiState.status === "completed" && (
                <div className="space-y-6">
                  {/* Highlight card for Winner */}
                  <div className="p-5 bg-gradient-to-tr from-brandPurple/10 to-brandCyan/10 border border-brandPurple/30 rounded-2xl flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-brandCyan/20 flex items-center justify-center border border-brandCyan/30 flex-shrink-0">
                      <ShieldCheck className="h-5 w-5 text-brandCyan" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-brandCyan uppercase tracking-widest block">LLM Winner Recommendation</span>
                      <h3 className="text-xl font-bold text-white mt-1">{aiState.winner}</h3>
                      <p className="text-xs text-gray-400 mt-2 italic">"{aiState.reason}"</p>
                    </div>
                  </div>

                  {/* Complete details */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Full Recommendation Log</span>
                    <div className="bg-black/60 border border-white/5 rounded-2xl p-4 text-xs font-mono text-gray-400 max-h-56 overflow-y-auto whitespace-pre-wrap">
                      {aiState.resultText}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs border-t border-white/5 pt-4">
                    <div>
                      <span className="text-gray-500 font-semibold block">Agent Request ID</span>
                      <span className="font-mono text-gray-300">#{aiState.agentRequestId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-semibold block">Completed Status</span>
                      <span className="text-green-400 font-bold">Completed On-Chain</span>
                    </div>
                  </div>

                  {/* STAGE 3: STORE ON-CHAIN FORM */}
                  {!request.processed && (
                    <div className="border-t border-white/5 pt-6 mt-6 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Sliders className="h-5 w-5 text-brandCyan" />
                        <h3 className="text-sm font-bold text-white">Store Procurement Evaluation</h3>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Finalize this procurement request. Define the scoring metrics to commit the evaluation results permanently on-chain.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            <span>Price Score</span>
                            <span className="text-brandCyan font-bold">{evaluationState.priceScore}</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={evaluationState.priceScore}
                            onChange={(e) => handleScoreChange("priceScore", Number(e.target.value))}
                            className="w-full accent-brandCyan"
                            disabled={evaluationState.status === "submitting"}
                          />
                        </div>

                        <div>
                          <label className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            <span>Quality Score</span>
                            <span className="text-brandCyan font-bold">{evaluationState.qualityScore}</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={evaluationState.qualityScore}
                            onChange={(e) => handleScoreChange("qualityScore", Number(e.target.value))}
                            className="w-full accent-brandCyan"
                            disabled={evaluationState.status === "submitting"}
                          />
                        </div>

                        <div>
                          <label className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            <span>Reliability Score</span>
                            <span className="text-brandCyan font-bold">{evaluationState.reliabilityScore}</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={evaluationState.reliabilityScore}
                            onChange={(e) => handleScoreChange("reliabilityScore", Number(e.target.value))}
                            className="w-full accent-brandCyan"
                            disabled={evaluationState.status === "submitting"}
                          />
                        </div>

                        <div>
                          <label className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            <span>Overall Score</span>
                            <span className="text-brandCyan font-bold">{evaluationState.overallScore}</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={evaluationState.overallScore}
                            onChange={(e) => handleScoreChange("overallScore", Number(e.target.value))}
                            className="w-full accent-brandCyan"
                            disabled={evaluationState.status === "submitting"}
                          />
                        </div>
                      </div>

                      {evaluationState.status === "submitting" ? (
                        <div className="flex items-center justify-center space-x-2 py-3">
                          <Loader2 className="h-5 w-5 animate-spin text-brandCyan" />
                          <span className="text-xs text-gray-400 font-semibold">Submitting to Smart Contract...</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleSubmitEvaluation}
                          className="w-full py-3 bg-brandCyan/20 hover:bg-brandCyan/30 text-brandCyan text-xs font-bold rounded-xl border border-brandCyan/30 flex items-center justify-center space-x-1.5 transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Store Evaluation On-Chain</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Workflow Steps Timeline & Final Verdict if Processed */}
        <div className="space-y-6">
          {/* Active status tracker */}
          <div className="glass-panel rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white mb-4">Request Workflow Status</h3>
            
            <div className="relative border-l border-white/5 pl-4 ml-2 space-y-6 text-xs">
              {/* Step 1 */}
              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 border border-black">
                  <CheckCircle className="h-2.5 w-2.5 text-black" />
                </span>
                <div>
                  <h4 className="font-semibold text-white">Request Created</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Budget and vendor links saved on-chain.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black ${
                  allUrlsParsed 
                    ? "bg-green-500" 
                    : Object.values(parsingStates).some(s => s.status === "parsing" || s.status === "submitting")
                      ? "bg-yellow-500 active-pulse-cyan"
                      : "bg-gray-800"
                }`}>
                  {allUrlsParsed && <CheckCircle className="h-2.5 w-2.5 text-black" />}
                </span>
                <div>
                  <h4 className={`font-semibold ${allUrlsParsed ? "text-white" : "text-gray-400"}`}>Website Parsing</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Extract contents from vendor portals.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black ${
                  aiState.status === "completed" 
                    ? "bg-green-500" 
                    : aiState.status === "analyzing" || aiState.status === "submitting"
                      ? "bg-yellow-500 active-pulse-cyan"
                      : "bg-gray-800"
                }`}>
                  {aiState.status === "completed" && <CheckCircle className="h-2.5 w-2.5 text-black" />}
                </span>
                <div>
                  <h4 className={`font-semibold ${aiState.status === "completed" ? "text-white" : "text-gray-400"}`}>LLM Agent Analysis</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Decide on the best option dynamically.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black ${
                  request.processed ? "bg-green-500" : "bg-gray-800"
                }`}>
                  {request.processed && <CheckCircle className="h-2.5 w-2.5 text-black" />}
                </span>
                <div>
                  <h4 className={`font-semibold ${request.processed ? "text-white" : "text-gray-400"}`}>Stored On Chain</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">Scoring metrics committed to Storage Contract.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stored Evaluation On-Chain display */}
          {request.processed && evaluation && (
            <div className="glass-panel rounded-3xl p-6 border border-green-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center space-x-2 mb-4 text-green-400">
                <Database className="h-5 w-5" />
                <h3 className="font-bold text-white">On-Chain Evaluation Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block">Recommended Vendor</span>
                  <span className="text-sm font-bold text-white">{evaluation.vendorName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block">Price Score</span>
                    <span className="font-bold text-brandCyan">{evaluation.priceScore}/100</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Quality Score</span>
                    <span className="font-bold text-brandCyan">{evaluation.qualityScore}/100</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Reliability Score</span>
                    <span className="font-bold text-brandCyan">{evaluation.reliabilityScore}/100</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Overall Score</span>
                    <span className="font-bold text-green-400">{evaluation.overallScore}/100</span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3">
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Final Verdict Summary</span>
                  <div className="bg-black/30 p-3 rounded-xl text-[11px] text-gray-400 font-mono max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {evaluation.recommendation}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[10px] text-gray-500">
                  <span>Verification Status</span>
                  <span className="text-green-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified On-Chain
                  </span>
                </div>
              </div>
            </div>
        )}
      </div>
      
      </div> {/* Closes Grid */}

      {/* RESULT PAGE: Blockchain Audit & Verification Ledger */}
      <div className="glass-panel rounded-3xl p-8 border border-brandCyan/25 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brandCyan/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-5 mb-6 gap-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="h-6 w-6 text-green-400 animate-pulse" />
            <div>
              <h3 className="text-lg font-bold text-white">On-Chain Result Ledger & Audit</h3>
              <p className="text-[11px] text-gray-500 font-medium font-sans">Cryptographic audit log for all AgentProcure AI workflows</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold font-mono">
            <CheckCircle className="h-3.5 w-3.5 animate-bounce" />
            Verified On-Chain
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-mono">
          {/* Left Column: Identifiers */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-brandCyan uppercase tracking-widest border-b border-white/5 pb-2">Operational Identifiers</h4>
            
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500">Procurement Request ID:</span>
              <span className="text-white font-bold">#{request.id}</span>
            </div>

            <div className="py-1">
              <span className="text-gray-500 block mb-1">Parse Request IDs:</span>
              <div className="space-y-1 pl-3 border-l border-white/10">
                {vendorUrls.map((_, idx) => {
                  const pid = parsingStates[idx]?.parseRequestId;
                  return (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-500">URL #{idx + 1}:</span>
                      <span className="text-gray-300 font-bold">{pid ? `#${pid}` : "Awaiting Execution"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500">Agent Recommendation ID:</span>
              <span className="text-white font-bold">{aiState.agentRequestId ? `#${aiState.agentRequestId}` : "Awaiting Execution"}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500">Network:</span>
              <span className="text-gray-300 font-semibold">{SOMNIA_TESTNET_CONFIG.chainName} ({SOMNIA_TESTNET_CONFIG.chainId})</span>
            </div>
          </div>

          {/* Right Column: Hashes & Contracts */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-brandPurple uppercase tracking-widest border-b border-white/5 pb-2">Contract Audits & Hashes</h4>

            <div className="py-1">
              <span className="text-gray-500 block mb-1">Contract Addresses:</span>
              <div className="space-y-1 pl-3 border-l border-white/10 text-[10px]">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">Procurement Storage:</span>
                  <span className="text-gray-400 break-all select-all">{PROCUREMENT_STORAGE_ADDRESS}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">Website Parser:</span>
                  <span className="text-gray-400 break-all select-all">{PARSE_WEBSITE_ADDRESS}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">AI Recommendation:</span>
                  <span className="text-gray-400 break-all select-all">{AI_RECOMMENDATION_ADDRESS}</span>
                </div>
              </div>
            </div>

            <div className="py-1">
              <span className="text-gray-500 block mb-1">Transaction Signatures:</span>
              <div className="space-y-1 pl-3 border-l border-white/10 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Request Creation:</span>
                  <span className="text-gray-400 truncate max-w-[200px]" title={localStorage.getItem("procurement_tx_hashes") ? JSON.parse(localStorage.getItem("procurement_tx_hashes") || "{}")[request.id] : "Loading..."}>
                    {localStorage.getItem("procurement_tx_hashes") ? JSON.parse(localStorage.getItem("procurement_tx_hashes") || "{}")[request.id] || "On-Chain Log" : "On-Chain Log"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">LLM Generation:</span>
                  <span className="text-gray-400 truncate max-w-[200px]" title={aiState.txHash || ""}>
                    {aiState.txHash || "Awaiting Execution"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verdict Box */}
        {(aiState.winner || evaluation) && (
          <div className="mt-8 border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            <div className="md:col-span-1 p-4 bg-brandPurple/5 border border-brandPurple/20 rounded-2xl">
              <span className="text-[10px] font-bold text-brandPurple uppercase tracking-widest block mb-1">Audit Winner Select</span>
              <span className="text-lg font-black text-white">{evaluation?.vendorName || aiState.winner}</span>
            </div>
            
            <div className="md:col-span-2 p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Audit Recommendation Text</span>
                <p className="text-xs text-gray-300 italic leading-relaxed">
                  "{evaluation?.recommendation || aiState.resultText || "No recommendation loaded."}"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
