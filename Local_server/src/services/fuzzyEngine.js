/**
 * Fuzzy Logic Engine - Mamdani Inference System for DSM
 * Local_server: Evaluates grid + appliance data to determine load shedding
 */

/**
 * Triangular Membership Function
 * @param {number} x - Input value
 * @param {number} a - Left point
 * @param {number} b - Peak point
 * @param {number} c - Right point
 */
function triangular(x, a, b, c) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > b && x < c) return (c - x) / (c - b);
  return 0;
}

/**
 * Trapezoidal Membership Function
 * @param {number} x - Input value
 * @param {number} a - Start of base
 * @param {number} b - Start of plateau
 * @param {number} c - End of plateau
 * @param {number} d - End of base
 */
function trapezoidal(x, a, b, c, d) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > c && x < d) return (d - x) / (d - c);
  return 0;
}

/**
 * GLOBAL INPUTS FUZZIFICATION
 */
const GlobalInputs = {
  // gridFrequency (Hz) [Domain: 49.0 to 51.0]
  gridFrequency: {
    Emergency_Low: (x) => trapezoidal(x, 49.0, 49.0, 49.7, 49.8),
    Low: (x) => triangular(x, 49.7, 49.85, 50.0),
    Normal: (x) => trapezoidal(x, 49.9, 50.0, 51.0, 51.0),
  },
  // gridStress [Domain: 0.0 to 1.0]
  gridStress: {
    Relaxed: (x) => trapezoidal(x, 0.0, 0.0, 0.5, 0.65),
    Moderate: (x) => triangular(x, 0.55, 0.75, 0.9),
    Critical: (x) => trapezoidal(x, 0.8, 0.9, 1.0, 1.0),
  },
  // gridPrice (₹) [Domain: 0.0 to 20.0]
  gridPrice: {
    Cheap: (x) => trapezoidal(x, 0.0, 0.0, 3.5, 4.5),
    Standard: (x) => triangular(x, 3.5, 5.5, 7.5),
    Expensive: (x) => triangular(x, 6.5, 9.0, 12.5),
    Surge_Pricing: (x) => trapezoidal(x, 11.0, 13.0, 20.0, 20.0),
  },
  // peakFlag [Domain: 0.0 to 1.0]
  peakFlag: {
    Off_Peak: (x) => trapezoidal(x, 0.0, 0.0, 0.2, 0.4),
    Shoulder: (x) => triangular(x, 0.2, 0.5, 0.8),
    Peak_Hours: (x) => trapezoidal(x, 0.6, 0.8, 1.0, 1.0),
  },
  // globalPowerFactor [Domain: 0.0 to 1.0]
  globalPowerFactor: {
    Lagging_Bad: (x) => trapezoidal(x, 0.0, 0.0, 0.8, 0.87),
    Acceptable: (x) => triangular(x, 0.85, 0.9, 0.96),
    Good: (x) => trapezoidal(x, 0.94, 0.97, 1.0, 1.0),
  },
};

/**
 * LOCAL INPUTS FUZZIFICATION
 */
const LocalInputs = {
  // loadImportance [Domain: 1.0 to 10.0]
  loadImportance: {
    Trivial: (x) => trapezoidal(x, 1.0, 1.0, 3.0, 4.5),
    Flexible: (x) => triangular(x, 3.5, 5.5, 8.0),
    Essential: (x) => trapezoidal(x, 7.0, 8.5, 10.0, 10.0),
  },
  // localPowerFactor [Domain: 0.0 to 1.0]
  localPowerFactor: {
    Highly_Inductive: (x) => trapezoidal(x, 0.0, 0.0, 0.6, 0.75),
    Moderate: (x) => triangular(x, 0.65, 0.85, 0.96),
    Resistive: (x) => trapezoidal(x, 0.94, 0.98, 1.0, 1.0),
  },
  // loadPower (Watts) [Domain: 0.0 to 5000.0]
  loadPower: {
    Light: (x) => trapezoidal(x, 0.0, 0.0, 150.0, 300.0),
    Medium: (x) => triangular(x, 200.0, 800.0, 1800.0),
    Heavy: (x) => trapezoidal(x, 1500.0, 2500.0, 5000.0, 5000.0),
  },
};

/**
 * OUTPUT CONSEQUENT FUZZIFICATION
 */
const OutputMembership = {
  // cutScore [Domain: 0.0 to 1.0]
  Keep_On: (x) => trapezoidal(x, 0.0, 0.0, 0.2, 0.35),
  Moderate_Shed_Risk: (x) => triangular(x, 0.3, 0.5, 0.7),
  Force_Cut: (x) => trapezoidal(x, 0.65, 0.8, 1.0, 1.0),
};

/**
 * Fuzzify global inputs
 */
function fuzzifyGlobal(globalData) {
  return {
    gridFrequency: {
      Emergency_Low: GlobalInputs.gridFrequency.Emergency_Low(globalData.gridFrequency),
      Low: GlobalInputs.gridFrequency.Low(globalData.gridFrequency),
      Normal: GlobalInputs.gridFrequency.Normal(globalData.gridFrequency),
    },
    gridStress: {
      Relaxed: GlobalInputs.gridStress.Relaxed(globalData.gridStress),
      Moderate: GlobalInputs.gridStress.Moderate(globalData.gridStress),
      Critical: GlobalInputs.gridStress.Critical(globalData.gridStress),
    },
    gridPrice: {
      Cheap: GlobalInputs.gridPrice.Cheap(globalData.gridPrice),
      Standard: GlobalInputs.gridPrice.Standard(globalData.gridPrice),
      Expensive: GlobalInputs.gridPrice.Expensive(globalData.gridPrice),
      Surge_Pricing: GlobalInputs.gridPrice.Surge_Pricing(globalData.gridPrice),
    },
    peakFlag: {
      Off_Peak: GlobalInputs.peakFlag.Off_Peak(globalData.peakFlag),
      Shoulder: GlobalInputs.peakFlag.Shoulder(globalData.peakFlag),
      Peak_Hours: GlobalInputs.peakFlag.Peak_Hours(globalData.peakFlag),
    },
    globalPowerFactor: {
      Lagging_Bad: GlobalInputs.globalPowerFactor.Lagging_Bad(globalData.globalPowerFactor),
      Acceptable: GlobalInputs.globalPowerFactor.Acceptable(globalData.globalPowerFactor),
      Good: GlobalInputs.globalPowerFactor.Good(globalData.globalPowerFactor),
    },
  };
}

/**
 * Fuzzify local inputs
 */
function fuzzifyLocal(localData) {
  return {
    loadImportance: {
      Trivial: LocalInputs.loadImportance.Trivial(localData.loadImportance),
      Flexible: LocalInputs.loadImportance.Flexible(localData.loadImportance),
      Essential: LocalInputs.loadImportance.Essential(localData.loadImportance),
    },
    localPowerFactor: {
      Highly_Inductive: LocalInputs.localPowerFactor.Highly_Inductive(localData.localPowerFactor),
      Moderate: LocalInputs.localPowerFactor.Moderate(localData.localPowerFactor),
      Resistive: LocalInputs.localPowerFactor.Resistive(localData.localPowerFactor),
    },
    loadPower: {
      Light: LocalInputs.loadPower.Light(localData.loadPower),
      Medium: LocalInputs.loadPower.Medium(localData.loadPower),
      Heavy: LocalInputs.loadPower.Heavy(localData.loadPower),
    },
  };
}

/**
 * INFERENCE ENGINE - Evaluate fuzzy rules
 */
function inferenceEngine(fuzzGlobal, fuzzLocal) {
  const rules = [];

  // RULE 1: IF (gridFrequency IS Emergency_Low) AND (loadImportance IS NOT Essential) THEN cutScore IS Force_Cut
  const rule1 = Math.min(
    fuzzGlobal.gridFrequency.Emergency_Low,
    1 - fuzzLocal.loadImportance.Essential // NOT Essential
  );
  rules.push({ Force_Cut: rule1 });

  // RULE 2: IF (gridStress IS Critical) AND (loadPower IS Heavy) AND (loadImportance IS Flexible) THEN cutScore IS Force_Cut
  const rule2 = Math.min(
    Math.min(fuzzGlobal.gridStress.Critical, fuzzLocal.loadPower.Heavy),
    fuzzLocal.loadImportance.Flexible
  );
  rules.push({ Force_Cut: rule2 });

  // RULE 3: IF (gridPrice IS Surge_Pricing) AND (peakFlag IS Peak_Hours) AND (loadImportance IS Trivial) THEN cutScore IS Force_Cut
  const rule3 = Math.min(
    Math.min(fuzzGlobal.gridPrice.Surge_Pricing, fuzzGlobal.peakFlag.Peak_Hours),
    fuzzLocal.loadImportance.Trivial
  );
  rules.push({ Force_Cut: rule3 });

  // RULE 4: IF (gridPrice IS Expensive) AND (loadImportance IS Flexible) AND (loadPower IS Heavy) THEN cutScore IS Moderate_Shed_Risk
  const rule4 = Math.min(
    Math.min(fuzzGlobal.gridPrice.Expensive, fuzzLocal.loadImportance.Flexible),
    fuzzLocal.loadPower.Heavy
  );
  rules.push({ Moderate_Shed_Risk: rule4 });

  // RULE 5: IF (gridPrice IS Cheap) THEN cutScore IS Keep_On
  const rule5 = fuzzGlobal.gridPrice.Cheap;
  rules.push({ Keep_On: rule5 });

  // RULE 6: IF (globalPowerFactor IS Lagging_Bad) AND (localPowerFactor IS Highly_Inductive) THEN cutScore IS Force_Cut
  const rule6 = Math.min(
    fuzzGlobal.globalPowerFactor.Lagging_Bad,
    fuzzLocal.localPowerFactor.Highly_Inductive
  );
  rules.push({ Force_Cut: rule6 });

  // RULE 7: IF (globalPowerFactor IS Lagging_Bad) AND (localPowerFactor IS Resistive) THEN cutScore IS Keep_On
  const rule7 = Math.min(
    fuzzGlobal.globalPowerFactor.Lagging_Bad,
    fuzzLocal.localPowerFactor.Resistive
  );
  rules.push({ Keep_On: rule7 });

  // RULE 8: IF (loadImportance IS Essential) AND (gridFrequency IS NOT Emergency_Low) THEN cutScore IS Keep_On
  const rule8 = Math.min(
    fuzzLocal.loadImportance.Essential,
    1 - fuzzGlobal.gridFrequency.Emergency_Low // NOT Emergency_Low
  );
  rules.push({ Keep_On: rule8 });

  // Aggregate rule outputs by membership type
  const aggregated = {
    Keep_On: 0,
    Moderate_Shed_Risk: 0,
    Force_Cut: 0,
  };

  rules.forEach((rule) => {
    Object.keys(rule).forEach((key) => {
      aggregated[key] = Math.max(aggregated[key], rule[key]);
    });
  });

  return aggregated;
}

/**
 * DEFUZZIFICATION - Centroid Method (Center of Gravity)
 * Calculate crisp cutScore from fuzzy output memberships
 */
function defuzzify(aggregated) {
  // Sample the output domain [0, 1] with high resolution
  const samples = 101; // 0.0 to 1.0 in 0.01 increments
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1); // Value from 0 to 1

    // Calculate output membership at this point
    const Keep_On = OutputMembership.Keep_On(x);
    const Moderate_Shed_Risk = OutputMembership.Moderate_Shed_Risk(x);
    const Force_Cut = OutputMembership.Force_Cut(x);

    // Apply aggregated rule membership values
    const y = Math.max(
      aggregated.Keep_On * Keep_On,
      Math.max(aggregated.Moderate_Shed_Risk * Moderate_Shed_Risk, aggregated.Force_Cut * Force_Cut)
    );

    numerator += x * y;
    denominator += y;
  }

  // Return centroid
  return denominator > 0 ? numerator / denominator : 0.5;
}

/**
 * RELAY HYSTERESIS LOGIC
 * Convert cutScore to relay action with deadband
 */
function getRelayAction(cutScore, previousAction = null) {
  let relayAction = previousAction || "NO_CHANGE";

  if (cutScore > 0.75) {
    relayAction = "OPEN"; // Shed the load
  } else if (cutScore < 0.25) {
    relayAction = "CLOSED"; // Restore the load
  }
  // If between 0.25 and 0.75, maintain current state

  return relayAction;
}

/**
 * MAIN EVALUATION FUNCTION
 * Evaluate load for DSM decision
 * @param {Object} globalData - Grid parameters from Global Server
 * @param {Object} localData - Appliance data from room
 * @param {string} previousAction - Previous relay action (for hysteresis)
 * @returns {Object} - Actuation command with cutScore and relayAction
 */
function evaluateLoad(globalData, localData, previousAction = null) {
  // Validate inputs
  if (
    !globalData ||
    !localData ||
    globalData.gridFrequency === undefined ||
    localData.loadImportance === undefined
  ) {
    console.warn("⚠️ Invalid input data for fuzzy engine");
    return {
      applianceId: localData?.applianceId || "unknown",
      cutScore: 0.5,
      relayAction: "NO_CHANGE",
      reason: "Invalid input",
    };
  }

  try {
    // 1. Fuzzification
    const fuzzGlobal = fuzzifyGlobal(globalData);
    const fuzzLocal = fuzzifyLocal(localData);

    // 2. Inference
    const aggregated = inferenceEngine(fuzzGlobal, fuzzLocal);

    // 3. Defuzzification
    const cutScore = defuzzify(aggregated);

    // 4. Relay Hysteresis
    const relayAction = getRelayAction(cutScore, previousAction);

    return {
      applianceId: localData.applianceId,
      roomId: localData.roomId,
      cutScore: parseFloat(cutScore.toFixed(4)),
      relayAction,
      timestamp: Date.now(),
      ruleEvaluations: aggregated, // For debugging
    };
  } catch (error) {
    console.error("❌ Fuzzy engine error:", error);
    return {
      applianceId: localData?.applianceId || "unknown",
      cutScore: 0.5,
      relayAction: "NO_CHANGE",
      error: error.message,
    };
  }
}

module.exports = {
  evaluateLoad,
  fuzzifyGlobal,
  fuzzifyLocal,
  inferenceEngine,
  defuzzify,
  getRelayAction,
};
