import { LockKeyhole } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p>© {new Date().getFullYear()} Mancing NFT</p>
        <p className="app-footer__status">
          <LockKeyhole aria-hidden="true" size={14} />
          Wallet-signed trades · Prices are estimates
        </p>
      </div>
    </footer>
  );
}
