import { CalculatorWizard } from "./components/calculator/wizard";
import { LicenseGate } from "./components/license/license-gate";
import { UpdateGate } from "./components/update/update-gate";
import "./App.css";

function App() {
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
