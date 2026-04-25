import { useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CalculatorWizard } from "./components/calculator/wizard";
import { LicenseGate } from "./components/license/license-gate";
import { UpdateGate } from "./components/update/update-gate";
import "./App.css";

function App() {
  useEffect(() => {
    (async () => {
      try {
        const version = await getVersion();
        await getCurrentWindow().setTitle(`CarbonMate v${version}`);
      } catch {
        // 브라우저 환경 또는 Tauri 미초기화 시 무시
      }
    })();
  }, []);

  return (
    <LicenseGate>
      <UpdateGate>
        <div className="min-h-screen bg-background text-foreground">
          <CalculatorWizard />
        </div>
      </UpdateGate>
    </LicenseGate>
  );
}

export default App;
