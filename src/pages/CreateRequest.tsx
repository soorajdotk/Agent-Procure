import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { PROCUREMENT_STORAGE_ADDRESS, PROCUREMENT_STORAGE_ABI } from "../contracts/config";
import { PlusCircle, Loader2, ArrowRight } from "lucide-react";

export const CreateRequest: React.FC = () => {
  const { signer, isConnected, connectWallet } = useWeb3();
  const navigate = useNavigate();

  const [productName, setProductName] = useState("");
  const [budget, setBudget] = useState("");
  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [url3, setUrl3] = useState("");

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !signer) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!productName || !budget || !url1 || !url2 || !url3) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage("Preparing transaction...");

    try {
      const contract = new ethers.Contract(
        PROCUREMENT_STORAGE_ADDRESS,
        PROCUREMENT_STORAGE_ABI,
        signer
      );

      // Parse budget to wei
      const budgetWei = ethers.parseEther(budget);

      setStatusMessage("Please confirm the transaction in MetaMask...");
      const tx = await contract.submitRequest(productName, budgetWei, [url1, url2, url3]);

      setStatusMessage("Mining transaction... Please wait.");
      const receipt = await tx.wait();

      setStatusMessage("Transaction successful! Extracting Request ID...");
      
      let requestId = "";
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsedLog && parsedLog.name === "ProcurementCreated") {
            requestId = parsedLog.args.requestId.toString();
            break;
          }
        } catch (e) {
          // Skip if log doesn't belong to this contract ABI
        }
      }

      if (!requestId) {
        // Fallback: fetch requestCounter
        const counter = await contract.requestCounter();
        requestId = (Number(counter) - 1).toString();
      }

      // Store in local storage for local tracking of recent tx hashes
      const storedTxHashes = JSON.parse(localStorage.getItem("procurement_tx_hashes") || "{}");
      storedTxHashes[requestId] = receipt.hash;
      localStorage.setItem("procurement_tx_hashes", JSON.stringify(storedTxHashes));

      // Also store creation date
      const storedDates = JSON.parse(localStorage.getItem("procurement_dates") || "{}");
      storedDates[requestId] = new Date().toISOString();
      localStorage.setItem("procurement_dates", JSON.stringify(storedDates));

      setStatusMessage("Redirecting to request page...");
      setTimeout(() => {
        navigate(`/request/${requestId}`);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.reason || err.message || "An error occurred while submitting the request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-brandPurple/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brandCyan/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="mb-6 flex items-center space-x-3">
          <PlusCircle className="h-7 w-7 text-brandCyan" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Create Procurement Request
          </h1>
        </div>

        <p className="mb-8 text-sm text-gray-400">
          Initiate an automated procurement workflow. Your vendor URLs will be parsed on-chain and evaluated by Somnia's AI recommendation engine.
        </p>

        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4 text-sm">You must connect your MetaMask wallet to submit a request.</p>
            <button
              onClick={connectWallet}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-brandPurple to-brandCyan text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="productName" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Product / Service Name
              </label>
              <input
                type="text"
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Enterprise SSD Storage Units"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brandCyan text-white placeholder-gray-600 transition-colors"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="budget" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Budget (STT)
              </label>
              <input
                type="number"
                step="any"
                id="budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 50"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brandCyan text-white placeholder-gray-600 transition-colors"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Vendor Product Page URLs
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                Provide exactly three vendor links for cross-analysis.
              </p>

              <div>
                <input
                  type="url"
                  value={url1}
                  onChange={(e) => setUrl1(e.target.value)}
                  placeholder="https://vendor-one.com/product"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brandCyan text-white placeholder-gray-600 transition-colors"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <input
                  type="url"
                  value={url2}
                  onChange={(e) => setUrl2(e.target.value)}
                  placeholder="https://vendor-two.com/product"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brandCyan text-white placeholder-gray-600 transition-colors"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <input
                  type="url"
                  value={url3}
                  onChange={(e) => setUrl3(e.target.value)}
                  placeholder="https://vendor-three.com/product"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brandCyan text-white placeholder-gray-600 transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-brandCyan" />
                <span className="text-sm text-gray-400 font-medium">{statusMessage}</span>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-brandPurple to-brandCyan hover:opacity-90 py-4 text-sm font-semibold text-white transition-opacity"
              >
                <span>Submit Procurement Request</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
