import { motion } from "framer-motion";
import {
  Building2,
  Droplets,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

export default function ScenarioDock({
  outage,
  analysisMode,
  setAnalysisMode,
  onToggleOutage,
  selectedBarangay,
}) {
  const actions = [
    {
      key: "development",
      label: "Development",
      icon: Building2,
      onClick: () => setAnalysisMode("development"),
    },
    {
      key: "shortage",
      label: "Shortage",
      icon: ShieldAlert,
      onClick: () => setAnalysisMode("shortage"),
    },
    {
      key: "investment",
      label: "Investment",
      icon: Zap,
      onClick: () => setAnalysisMode("investment"),
    },
  ];

  return (
    <motion.div
      className="scenario-dock"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.28 }}
    >
      <div className="scenario-context">
        <Sparkles size={15} />
        <div>
          <span>SCENARIO LAB</span>
          <strong>{selectedBarangay?.barangay || "Select a barangay"}</strong>
        </div>
      </div>

      <div className="scenario-actions">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              className={analysisMode === action.key ? "active" : ""}
              onClick={action.onClick}
            >
              <Icon size={15} />
              <span>{action.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`scenario-outage ${outage ? "restore" : ""}`}
          onClick={onToggleOutage}
        >
          <Droplets size={15} />
          <span>{outage ? "Restore" : "Outage"}</span>
        </button>
      </div>
    </motion.div>
  );
}
