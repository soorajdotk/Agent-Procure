import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { Wallet, Activity, History, PlusCircle, LayoutDashboard, Cpu } from "lucide-react";

export const Header: React.FC = () => {
  const { account, isConnected, isConnecting, connectWallet, error } = useWeb3();

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-darkBg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brandPurple to-brandCyan p-[1px] transition-transform duration-300 group-hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-darkBg">
              <Cpu className="h-5 w-5 text-brandCyan group-hover:text-brandPurple transition-colors duration-300" />
            </div>
          </div>
          <div>
            <span className="bg-gradient-to-r from-white via-gray-200 to-brandCyan bg-clip-text text-xl font-bold tracking-tight text-transparent">
              AgentProcure <span className="text-brandPurple">AI</span>
            </span>
            <p className="text-[10px] text-gray-500 tracking-wider font-semibold uppercase">Somnia Shannon Testnet</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/5 text-brandCyan border border-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/create"
            className={({ isActive }) =>
              `flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/5 text-brandCyan border border-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Request</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/5 text-brandCyan border border-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <History className="h-4 w-4" />
            <span>History</span>
          </NavLink>

          <NavLink
            to="/activity"
            className={({ isActive }) =>
              `flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/5 text-brandCyan border border-white/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <Activity className="h-4 w-4" />
            <span>Agent Activity</span>
          </NavLink>
        </nav>

        {/* Wallet Connect */}
        <div className="flex items-center space-x-4">
          {isConnected && account ? (
            <div className="flex items-center space-x-2 rounded-xl border border-brandPurple/20 bg-brandPurple/5 px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs font-mono text-gray-300">{formatAddress(account)}</span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-brandPurple to-brandCyan hover:from-brandPurple/90 hover:to-brandCyan/90 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-brandPurple/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
            >
              <Wallet className="h-4 w-4" />
              <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex border-t border-white/5 bg-darkBg/90 py-2 justify-around px-4">
        <NavLink to="/" className={({ isActive }) => `flex flex-col items-center text-[10px] ${isActive ? "text-brandCyan" : "text-gray-400"}`}>
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => `flex flex-col items-center text-[10px] ${isActive ? "text-brandCyan" : "text-gray-400"}`}>
          <PlusCircle className="h-4 w-4" />
          <span>Create</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `flex flex-col items-center text-[10px] ${isActive ? "text-brandCyan" : "text-gray-400"}`}>
          <History className="h-4 w-4" />
          <span>History</span>
        </NavLink>
        <NavLink to="/activity" className={({ isActive }) => `flex flex-col items-center text-[10px] ${isActive ? "text-brandCyan" : "text-gray-400"}`}>
          <Activity className="h-4 w-4" />
          <span>Activity</span>
        </NavLink>
      </div>

      {error && !isConnected && (
        <div className="bg-red-950/40 border-b border-red-500/30 py-2 text-center text-xs text-red-400">
          {error}
        </div>
      )}
    </header>
  );
};
