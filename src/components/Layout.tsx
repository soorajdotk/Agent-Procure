import React from "react";
import { Header } from "./Header";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-white/5 py-6 bg-darkBg/30 text-center text-xs text-gray-500">
        <p>© 2026 AgentProcure AI. Powered by Somnia Shannon Testnet Agents.</p>
        <p className="mt-1 font-semibold text-gray-600">All data read directly from decentralized smart contracts.</p>
      </footer>
    </div>
  );
};
