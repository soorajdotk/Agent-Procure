import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import { SOMNIA_TESTNET_CONFIG } from "../contracts/config";

interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToSomnia: () => Promise<boolean>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initWeb3 = async (browserProvider: ethers.BrowserProvider) => {
    try {
      const network = await browserProvider.getNetwork();
      const currentChainId = "0x" + network.chainId.toString(16);
      setChainId(currentChainId);

      const accounts = await browserProvider.listAccounts();
      if (accounts.length > 0) {
        const activeSigner = await browserProvider.getSigner();
        setSigner(activeSigner);
        setAccount(accounts[0].address);
      } else {
        setSigner(null);
        setAccount(null);
      }
      setProvider(browserProvider);
      setError(null);
    } catch (err: any) {
      console.error("Web3 initialization error:", err);
      setError("Failed to initialize Web3 provider.");
    }
  };

  const switchToSomnia = async (): Promise<boolean> => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SOMNIA_TESTNET_CONFIG.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // Chain not added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SOMNIA_TESTNET_CONFIG],
          });
          return true;
        } catch (addError: any) {
          console.error("Failed to add Somnia Network:", addError);
          setError("Failed to add Somnia network to wallet.");
          return false;
        }
      }
      console.error("Failed to switch to Somnia Network:", switchError);
      setError("Please switch your network to Somnia Shannon Testnet.");
      return false;
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it to interact with this application.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      
      // Request accounts
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      // Check network
      const network = await browserProvider.getNetwork();
      const currentChainId = "0x" + network.chainId.toString(16);
      
      if (currentChainId !== SOMNIA_TESTNET_CONFIG.chainId) {
        const switched = await switchToSomnia();
        if (!switched) {
          setIsConnecting(false);
          return;
        }
      }

      await initWeb3(browserProvider);
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setSigner(null);
    setAccount(null);
    setProvider(null);
    setChainId(null);
  };

  useEffect(() => {
    if (window.ethereum) {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      
      // Auto connect if already authorized
      browserProvider.listAccounts().then((accounts) => {
        if (accounts.length > 0) {
          initWeb3(browserProvider);
        }
      }).catch(console.error);

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          initWeb3(browserProvider);
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    } else {
      setError("No Ethereum browser extension detected. Please install MetaMask.");
    }
  }, []);

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        account,
        chainId,
        isConnected: !!account,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        switchToSomnia,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};

// Extend global window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
