import { CalculatorWizard } from "./components/calculator/wizard";
import { LicenseGate } from "./components/license/license-gate";
import "./App.css";

function App() {
  return (
    <LicenseGate>
      <div className="min-h-screen bg-background text-foreground">
        <CalculatorWizard />
      </div>
    </LicenseGate>
  );
}

export default App;
