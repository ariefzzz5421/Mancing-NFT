import { LockKeyhole } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <p>Mancing NFT / NFT Quant Execution Terminal</p>
        <p className="app-footer__status">
          <LockKeyhole aria-hidden="true" size={14} />
          Non-custodial / Market estimates, not guaranteed returns
        </p>
      </div>
    </footer>
  );
}
