/**
 * Updates ALL tree files with domain-specific weight dimensions.
 * Run: node scripts/update-all-tree-weights.js
 */
const fs = require("fs");
const path = require("path");

const TREES_DIR = path.join(__dirname, "..", "trees");

// ── Tree weight configurations ──────────────────────────────────
const configs = {
  "airplane-diagnosis.tree.json": {
    defaultWeights: [
      { id: "safetyMargin", label: "Safety Margin", value: 90, color: "#FF4444", icon: "🛡️" },
      { id: "dispatchReliability", label: "Dispatch Reliability", value: 65, color: "#4ECDC4", icon: "✈️" },
      { id: "maintenanceCost", label: "Maintenance Cost", value: 40, color: "#45B7D1", icon: "💰" },
      { id: "regulatoryCompliance", label: "Regulatory Compliance", value: 85, color: "#FF6B6B", icon: "📋" },
      { id: "passengerComfort", label: "Passenger Comfort", value: 50, color: "#DDA0DD", icon: "💺" },
      { id: "systemRedundancy", label: "System Redundancy", value: 75, color: "#96CEB4", icon: "🔄" },
      { id: "diagnosticConfidence", label: "Diagnostic Confidence", value: 70, color: "#FFEAA7", icon: "🔍" },
      { id: "turnaroundTime", label: "Turnaround Time", value: 35, color: "#87CEEB", icon: "⏱️" }
    ],
    nodeReplacements: {
      assumption_recent_mx: {
        weightInfluence: [
          { dimension: "safetyMargin", direction: "reject", strength: 80 },
          { dimension: "turnaroundTime", direction: "accept", strength: 50 }
        ]
      },
      decision_system: {
        weightBias: [
          { dimension: "regulatoryCompliance", favorsBranch: "Engine", strength: 90 },
          { dimension: "safetyMargin", favorsBranch: "Avionics", strength: 40 },
          { dimension: "diagnosticConfidence", favorsBranch: "Hydraulics", strength: 50 }
        ]
      },
      decision_engine: {
        weightBias: [
          { dimension: "regulatoryCompliance", favorsBranch: "Mechanical", strength: 80 },
          { dimension: "turnaroundTime", favorsBranch: "Performance", strength: 30 }
        ]
      },
      decision_avionics: {
        weightBias: [
          { dimension: "diagnosticConfidence", favorsBranch: "Multi-bus", strength: 70 },
          { dimension: "safetyMargin", favorsBranch: "Single system", strength: 40 }
        ]
      },
      decision_hydraulic: {
        weightBias: [
          { dimension: "regulatoryCompliance", favorsBranch: "Fluid loss", strength: 90 },
          { dimension: "turnaroundTime", favorsBranch: "Pressure only", strength: 30 }
        ]
      }
    }
  },

  "app-modernization.tree.json": {
    defaultWeights: [
      { id: "migrationRiskTolerance", label: "Migration Risk Tolerance", value: 40, color: "#FF6B6B", icon: "⚡" },
      { id: "downtimeTolerance", label: "Downtime Tolerance", value: 30, color: "#FFEAA7", icon: "⏱️" },
      { id: "technicalDebtReduction", label: "Technical Debt Reduction", value: 65, color: "#4ECDC4", icon: "🧹" },
      { id: "cloudReadiness", label: "Cloud Readiness", value: 60, color: "#45B7D1", icon: "☁️" },
      { id: "teamTrainingInvestment", label: "Team Training Investment", value: 45, color: "#DDA0DD", icon: "🎓" },
      { id: "legacyDependency", label: "Legacy Dependency", value: 55, color: "#96CEB4", icon: "🏚️" },
      { id: "complianceImpact", label: "Compliance Impact", value: 70, color: "#F0E68C", icon: "📋" },
      { id: "businessContinuity", label: "Business Continuity", value: 75, color: "#87CEEB", icon: "🏢" }
    ],
    nodeReplacements: {
      assumption_recent_mx: {
        weightInfluence: [
          { dimension: "migrationRiskTolerance", direction: "reject", strength: 80 },
          { dimension: "downtimeTolerance", direction: "accept", strength: 50 }
        ]
      },
      decision_system: {
        weightBias: [
          { dimension: "complianceImpact", favorsBranch: "Engine", strength: 90 },
          { dimension: "migrationRiskTolerance", favorsBranch: "Avionics", strength: 40 },
          { dimension: "legacyDependency", favorsBranch: "Hydraulics", strength: 50 }
        ]
      },
      decision_engine: {
        weightBias: [
          { dimension: "complianceImpact", favorsBranch: "Mechanical", strength: 80 },
          { dimension: "downtimeTolerance", favorsBranch: "Performance", strength: 30 }
        ]
      },
      decision_avionics: {
        weightBias: [
          { dimension: "legacyDependency", favorsBranch: "Multi-bus", strength: 70 },
          { dimension: "migrationRiskTolerance", favorsBranch: "Single system", strength: 40 }
        ]
      },
      decision_hydraulic: {
        weightBias: [
          { dimension: "complianceImpact", favorsBranch: "Fluid loss", strength: 90 },
          { dimension: "downtimeTolerance", favorsBranch: "Pressure only", strength: 30 }
        ]
      }
    }
  },

  "architecture-guide.tree.json": {
    defaultWeights: [
      { id: "scalability", label: "Scalability", value: 55, color: "#87CEEB", icon: "📈" },
      { id: "reliability", label: "Reliability", value: 70, color: "#FF6B6B", icon: "🔒" },
      { id: "securityPosture", label: "Security Posture", value: 60, color: "#F0E68C", icon: "🛡️" },
      { id: "costEfficiency", label: "Cost Efficiency", value: 50, color: "#4ECDC4", icon: "💰" },
      { id: "developerExperience", label: "Developer Experience", value: 55, color: "#DDA0DD", icon: "🧑‍💻" },
      { id: "operationalSimplicity", label: "Operational Simplicity", value: 50, color: "#96CEB4", icon: "🎯" },
      { id: "performance", label: "Performance", value: 60, color: "#FFEAA7", icon: "⚡" },
      { id: "extensibility", label: "Extensibility", value: 45, color: "#45B7D1", icon: "🔌" }
    ],
    nodeReplacements: {
      assumption_rollback: {
        weightInfluence: [
          { dimension: "performance", direction: "accept", strength: 90 },
          { dimension: "reliability", direction: "accept", strength: 70 }
        ]
      },
      decision_severity: {
        weightBias: [
          { dimension: "reliability", favorsBranch: "SEV-3/4 — Low", strength: 40 },
          { dimension: "performance", favorsBranch: "SEV-1 — Critical", strength: 70 },
          { dimension: "securityPosture", favorsBranch: "SEV-1 — Critical", strength: 80 }
        ]
      },
      decision_mitigation: {
        weightBias: [
          { dimension: "performance", favorsBranch: "Rollback", strength: 90 },
          { dimension: "reliability", favorsBranch: "Feature flag / kill switch", strength: 50 },
          { dimension: "operationalSimplicity", favorsBranch: "Scale up / restart", strength: 30 }
        ]
      },
      decision_rca: {
        weightBias: [
          { dimension: "operationalSimplicity", favorsBranch: "Systemic / architectural", strength: 70 },
          { dimension: "performance", favorsBranch: "Code bug", strength: 50 },
          { dimension: "securityPosture", favorsBranch: "Security incident", strength: 90 }
        ]
      }
    }
  },

  "codex-spec-builder.tree.json": {
    defaultWeights: [
      { id: "codeQuality", label: "Code Quality", value: 70, color: "#FF6B6B", icon: "✨" },
      { id: "testCoverage", label: "Test Coverage", value: 65, color: "#4ECDC4", icon: "🧪" },
      { id: "aiAutonomy", label: "AI Autonomy", value: 70, color: "#DDA0DD", icon: "🤖" },
      { id: "refactorScope", label: "Refactor Scope", value: 50, color: "#45B7D1", icon: "🔄" },
      { id: "securityAwareness", label: "Security Awareness", value: 60, color: "#F0E68C", icon: "🔒" },
      { id: "performancePriority", label: "Performance Priority", value: 50, color: "#96CEB4", icon: "⚡" },
      { id: "documentationThoroughness", label: "Documentation Thoroughness", value: 55, color: "#FFEAA7", icon: "📝" },
      { id: "deadlinePressure", label: "Deadline Pressure", value: 45, color: "#87CEEB", icon: "⏰" }
    ],
    nodeReplacements: {
      assumption_repo_structure: {
        weightInfluence: [
          { dimension: "aiAutonomy", direction: "accept", strength: 80 },
          { dimension: "documentationThoroughness", direction: "accept", strength: 40 }
        ]
      },
      assumption_test_infra: {
        weightInfluence: [
          { dimension: "codeQuality", direction: "reject", strength: 70 },
          { dimension: "deadlinePressure", direction: "accept", strength: 50 }
        ]
      },
      decision_spec_type: {
        weightBias: [
          { dimension: "aiAutonomy", favorsBranch: "AGENTS.md + Task Specs", strength: 90 },
          { dimension: "deadlinePressure", favorsBranch: "Single Prompt Spec", strength: 70 },
          { dimension: "documentationThoroughness", favorsBranch: "Multi-file Spec Suite", strength: 80 },
          { dimension: "securityAwareness", favorsBranch: "Multi-file Spec Suite", strength: 50 }
        ]
      },
      decision_detail_level: {
        weightBias: [
          { dimension: "aiAutonomy", favorsBranch: "High-level intent only", strength: 60 },
          { dimension: "codeQuality", favorsBranch: "Detailed with examples", strength: 70 },
          { dimension: "deadlinePressure", favorsBranch: "High-level intent only", strength: 50 }
        ]
      },
      decision_validation: {
        weightBias: [
          { dimension: "securityAwareness", favorsBranch: "CI gate + lint + security scan", strength: 80 },
          { dimension: "deadlinePressure", favorsBranch: "Type check + basic tests", strength: 60 },
          { dimension: "codeQuality", favorsBranch: "Type check + basic tests", strength: 40 }
        ]
      }
    }
  },

  "incident-response.tree.json": {
    defaultWeights: [
      { id: "mttrPriority", label: "MTTR Priority", value: 85, color: "#FF6B6B", icon: "⏱️" },
      { id: "blastRadiusConcern", label: "Blast Radius Concern", value: 75, color: "#F0E68C", icon: "💥" },
      { id: "communicationUrgency", label: "Communication Urgency", value: 60, color: "#DDA0DD", icon: "📢" },
      { id: "rootCauseDepth", label: "Root Cause Depth", value: 55, color: "#96CEB4", icon: "🔍" },
      { id: "automationPreference", label: "Automation Preference", value: 45, color: "#45B7D1", icon: "🤖" },
      { id: "rollbackSafety", label: "Rollback Safety", value: 70, color: "#87CEEB", icon: "⏪" },
      { id: "customerImpactTolerance", label: "Customer Impact Tolerance", value: 25, color: "#4ECDC4", icon: "👥" },
      { id: "changeRiskAversion", label: "Change Risk Aversion", value: 65, color: "#FFEAA7", icon: "🚧" }
    ],
    nodeReplacements: {
      assumption_rollback: {
        weightInfluence: [
          { dimension: "mttrPriority", direction: "accept", strength: 90 },
          { dimension: "changeRiskAversion", direction: "accept", strength: 70 }
        ]
      },
      decision_severity: {
        weightBias: [
          { dimension: "changeRiskAversion", favorsBranch: "SEV-3/4 — Low", strength: 40 },
          { dimension: "mttrPriority", favorsBranch: "SEV-1 — Critical", strength: 70 },
          { dimension: "blastRadiusConcern", favorsBranch: "SEV-1 — Critical", strength: 80 }
        ]
      },
      decision_mitigation: {
        weightBias: [
          { dimension: "mttrPriority", favorsBranch: "Rollback", strength: 90 },
          { dimension: "changeRiskAversion", favorsBranch: "Feature flag / kill switch", strength: 50 },
          { dimension: "rootCauseDepth", favorsBranch: "Scale up / restart", strength: 30 }
        ]
      },
      decision_rca: {
        weightBias: [
          { dimension: "rootCauseDepth", favorsBranch: "Systemic / architectural", strength: 70 },
          { dimension: "mttrPriority", favorsBranch: "Code bug", strength: 50 },
          { dimension: "blastRadiusConcern", favorsBranch: "Security incident", strength: 90 }
        ]
      }
    }
  },

  "tech-stack-selector.tree.json": {
    defaultWeights: [
      { id: "scalabilityNeed", label: "Scalability Need", value: 55, color: "#87CEEB", icon: "📈" },
      { id: "teamExpertise", label: "Team Expertise", value: 60, color: "#DDA0DD", icon: "👥" },
      { id: "ecosystemMaturity", label: "Ecosystem Maturity", value: 55, color: "#96CEB4", icon: "🌐" },
      { id: "performanceRequirement", label: "Performance Requirement", value: 50, color: "#F0E68C", icon: "⚡" },
      { id: "costSensitivity", label: "Cost Sensitivity", value: 50, color: "#4ECDC4", icon: "💰" },
      { id: "timeToMarket", label: "Time to Market", value: 55, color: "#FFEAA7", icon: "🚀" },
      { id: "maintainability", label: "Maintainability", value: 60, color: "#FF6B6B", icon: "🔧" },
      { id: "innovationAppetite", label: "Innovation Appetite", value: 45, color: "#45B7D1", icon: "💡" }
    ],
    nodeReplacements: {
      assumption_cloud: {
        weightInfluence: [
          { dimension: "scalabilityNeed", direction: "accept", strength: 70 },
          { dimension: "costSensitivity", direction: "reject", strength: 30 }
        ]
      },
      decision_frontend: {
        weightBias: [
          { dimension: "innovationAppetite", favorsBranch: "React + Next.js", strength: 50 },
          { dimension: "timeToMarket", favorsBranch: "React + Vite SPA", strength: 60 },
          { dimension: "ecosystemMaturity", favorsBranch: "Server-rendered (Razor / Blazor)", strength: 40 },
          { dimension: "scalabilityNeed", favorsBranch: "React + Next.js", strength: 50 }
        ]
      },
      decision_backend: {
        weightBias: [
          { dimension: "scalabilityNeed", favorsBranch: "Go / Rust", strength: 80 },
          { dimension: "timeToMarket", favorsBranch: "Node.js (Express / Fastify)", strength: 70 },
          { dimension: "ecosystemMaturity", favorsBranch: ".NET (ASP.NET Core)", strength: 50 },
          { dimension: "innovationAppetite", favorsBranch: "Python (FastAPI)", strength: 40 }
        ]
      },
      decision_database: {
        weightBias: [
          { dimension: "scalabilityNeed", favorsBranch: "NoSQL (Cosmos DB / MongoDB)", strength: 70 },
          { dimension: "ecosystemMaturity", favorsBranch: "Relational (PostgreSQL / SQL Server)", strength: 40 },
          { dimension: "costSensitivity", favorsBranch: "Relational (PostgreSQL / SQL Server)", strength: 50 },
          { dimension: "innovationAppetite", favorsBranch: "NoSQL (Cosmos DB / MongoDB)", strength: 30 }
        ]
      }
    }
  },

  "troubleshoot-deploy.tree.json": {
    defaultWeights: [
      { id: "rollbackUrgency", label: "Rollback Urgency", value: 60, color: "#FF6B6B", icon: "⏪" },
      { id: "environmentParity", label: "Environment Parity", value: 55, color: "#DDA0DD", icon: "🔄" },
      { id: "cicdMaturity", label: "CI/CD Maturity", value: 50, color: "#45B7D1", icon: "🔧" },
      { id: "monitoringCoverage", label: "Monitoring Coverage", value: 65, color: "#F0E68C", icon: "📊" },
      { id: "configDriftConcern", label: "Config Drift Concern", value: 50, color: "#96CEB4", icon: "⚙️" },
      { id: "dependencyStability", label: "Dependency Stability", value: 55, color: "#87CEEB", icon: "📦" },
      { id: "deploymentFrequency", label: "Deployment Frequency", value: 45, color: "#4ECDC4", icon: "🚀" },
      { id: "incidentSeverity", label: "Incident Severity", value: 70, color: "#FFEAA7", icon: "🚨" }
    ],
    nodeReplacements: {
      assumption_recent: {
        weightInfluence: [
          { dimension: "rollbackUrgency", direction: "accept", strength: 50 },
          { dimension: "incidentSeverity", direction: "accept", strength: 70 }
        ]
      },
      assumption_rollback: {
        weightInfluence: [
          { dimension: "rollbackUrgency", direction: "reject", strength: 40 },
          { dimension: "incidentSeverity", direction: "accept", strength: 80 }
        ]
      },
      decision_error_type: {
        weightBias: [
          { dimension: "incidentSeverity", favorsBranch: "Quick Fix", strength: 60 },
          { dimension: "monitoringCoverage", favorsBranch: "Deep Dive", strength: 70 }
        ]
      }
    }
  }
};

// ── Apply updates ───────────────────────────────────────────────
let totalUpdated = 0;
let errors = [];

for (const [filename, config] of Object.entries(configs)) {
  const filePath = path.join(TREES_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    errors.push(`MISSING: ${filename}`);
    continue;
  }
  
  try {
    const tree = JSON.parse(fs.readFileSync(filePath, "utf8"));
    
    // Update defaultWeights
    tree.defaultWeights = config.defaultWeights;
    
    // Update node weightInfluence/weightBias references
    for (const node of tree.nodes) {
      const replacement = config.nodeReplacements[node.id];
      if (replacement) {
        if (replacement.weightInfluence) {
          node.weightInfluence = replacement.weightInfluence;
        }
        if (replacement.weightBias) {
          node.weightBias = replacement.weightBias;
        }
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(tree, null, 2) + "\n");
    
    // Verify
    const v = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const defIds = new Set(v.defaultWeights.map(w => w.id));
    const refs = new Set();
    for (const n of v.nodes) {
      for (const wi of (n.weightInfluence || [])) refs.add(wi.dimension);
      for (const wb of (n.weightBias || [])) refs.add(wb.dimension);
    }
    const unresolved = [...refs].filter(r => !defIds.has(r));
    
    if (unresolved.length > 0) {
      errors.push(`${filename}: unresolved refs: ${unresolved.join(", ")}`);
    } else {
      console.log(`✓ ${filename} — ${defIds.size} weights, ${refs.size} refs, all match`);
      totalUpdated++;
    }
  } catch (e) {
    errors.push(`${filename}: ${e.message}`);
  }
}

console.log(`\n${totalUpdated}/${Object.keys(configs).length} trees updated successfully`);
if (errors.length > 0) {
  console.log("ERRORS:");
  errors.forEach(e => console.log(`  ✗ ${e}`));
  process.exit(1);
}
