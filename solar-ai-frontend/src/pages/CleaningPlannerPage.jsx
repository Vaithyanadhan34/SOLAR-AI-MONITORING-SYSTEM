import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useSolar } from '../context/SolarContext';
import { fetchCleaningDecision, fetchPolicyComparison } from '../services/api';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
} from '../utils/chartConfig';

// Decision status color styling
const getDecisionBadgeClass = (decision) => {
  if (decision === 'Clean now') return 'badge-clean-now';
  if (decision === 'Inspect') return 'badge-inspect';
  return 'badge-wait';
};

/**
 * Memoized Decision Hero Card
 * Fixed height and tabular numerals prevent any layout jumping.
 */
const DecisionHero = memo(function DecisionHero({
  decision,
  actionLine,
  cumValue,
  cumKwh,
  cleaningCost,
  thresholdKwh,
  waterSaved,
  isLoading,
  isUpdating,
}) {
  return (
    <div className="planner-decision-hero">
      <div className="decision-status-side">
        <span className="decision-overhead-label">Operational Recommendation</span>
        <div className="decision-title-group">
          <span className={`decision-badge ${getDecisionBadgeClass(decision)}`}>
            {isLoading ? 'Evaluating...' : (decision || 'Calculating')}
          </span>
          {isUpdating && <span className="updating-pill">Syncing...</span>}
        </div>
        <p className="decision-action-line">
          {isLoading ? 'Checking economic balance against telemetry history...' : (actionLine || 'No telemetry history')}
        </p>
      </div>

      <div className="decision-metrics-side">
        <div className="decision-stat-box">
          <span className="stat-label">Cumulative Loss</span>
          <span className="stat-value">
            {cumValue != null ? `₹${Number(cumValue).toFixed(0)}` : '--'}
          </span>
          <span className="stat-sub">{cumKwh != null ? `${cumKwh} kWh lost` : ''}</span>
        </div>

        <div className="decision-stat-box">
          <span className="stat-label">Cleaning Cost</span>
          <span className="stat-value">₹{cleaningCost}</span>
          <span className="stat-sub">threshold: {thresholdKwh != null ? `${thresholdKwh} kWh` : ''}</span>
        </div>

        <div className="decision-stat-box highlight-box">
          <span className="stat-label">Water Saved</span>
          <span className="stat-value">
            {waterSaved != null ? `${waterSaved} L` : '0 L'}
          </span>
          <span className="stat-sub text-muted">scenario estimate</span>
        </div>
      </div>
    </div>
  );
});

/**
 * Memoized Interactive Sliders Panel
 * Value labels render directly from draft values without delay.
 */
const PlannerAssumptions = memo(function PlannerAssumptions({
  water,
  cost,
  tariff,
  soiling,
  onWaterChange,
  onCostChange,
  onTariffChange,
  onSoilingChange,
  onPointerUp,
}) {
  return (
    <div className="planner-assumptions-card">
      <div className="assumptions-card-header">
        <h3 className="assumptions-title">Economic & Environmental Parameters</h3>
        <span className="assumptions-badge">Live simulation sliders</span>
      </div>
      <div className="assumptions-sliders-grid">
        <div className="slider-group">
          <div className="slider-label-row">
            <label htmlFor="water-input">Water per wash:</label>
            <span className="slider-val"><strong>{water} L</strong></span>
          </div>
          <input
            id="water-input"
            type="range"
            min="100"
            max="2000"
            step="50"
            value={water}
            onChange={onWaterChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-help">Benchmark: ~5 L per panel (semi-arid solar array)</span>
        </div>

        <div className="slider-group">
          <div className="slider-label-row">
            <label htmlFor="cost-input">Cleaning cost:</label>
            <span className="slider-val"><strong>₹{cost}</strong></span>
          </div>
          <input
            id="cost-input"
            type="range"
            min="100"
            max="2500"
            step="50"
            value={cost}
            onChange={onCostChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-help">Labour and equipment mobilization cost per event</span>
        </div>

        <div className="slider-group">
          <div className="slider-label-row">
            <label htmlFor="tariff-input">Electricity tariff:</label>
            <span className="slider-val"><strong>₹{tariff} / kWh</strong></span>
          </div>
          <input
            id="tariff-input"
            type="range"
            min="2"
            max="25"
            step="0.5"
            value={tariff}
            onChange={onTariffChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-help">Net-metering avoided grid purchase rate</span>
        </div>

        <div className="slider-group">
          <div className="slider-label-row">
            <label htmlFor="soiling-input">Assumed soiling loss %:</label>
            <span className="slider-val"><strong>{soiling}%</strong></span>
          </div>
          <input
            id="soiling-input"
            type="range"
            min="2"
            max="35"
            step="1"
            value={soiling}
            onChange={onSoilingChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-help">Scenario mode rate (assumption, not measured)</span>
        </div>
      </div>
    </div>
  );
});

/**
 * Memoized Cumulative Lost Value vs Cleaning Cost Chart
 * Stays mounted permanently; updates instantly on slider changes without line redrawing.
 */
const CostLossChart = memo(function CostLossChart({
  timeseries,
  crossoverDate,
  isLoading,
  isUpdating,
  errorMessage,
  emptyMessage,
  onSwitchToReplay,
  isFirstRender,
}) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <h2 className="chart-title">Cumulative Energy Loss Value vs Cleaning Cost Line</h2>
          <p className="chart-caption">Financial crossover where cumulative generation shortfall exceeds the cost of a wash cycle.</p>
        </div>
        {crossoverDate && (
          <span className="crossover-flag">
            Crossover date: <strong>{crossoverDate}</strong>
          </span>
        )}
      </div>
      <div className={`chart-body ${isUpdating ? 'is-updating' : ''}`} style={{ height: 320, minHeight: 320 }}>
        {isLoading && !timeseries?.length ? (
          <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
        ) : errorMessage ? (
          <div className="chart-error-state"><p>{errorMessage}</p></div>
        ) : !timeseries?.length ? (
          <div className="chart-empty-state">
            <div className="empty-state-badge">No 2026 Readings Recorded</div>
            <p className="empty-state-msg">{emptyMessage}</p>
            <div className="empty-state-actions">
              <Link to="/" className="btn-empty-action">Save a reading</Link>
              <Link to="/data" className="btn-empty-action">Upload CSV</Link>
              {onSwitchToReplay && (
                <button type="button" onClick={onSwitchToReplay} className="btn-empty-action highlight">
                  Switch to historical replay
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <StandardChartLegend
              items={[
                { label: 'Cleaning cost threshold', color: '#C0392B', type: 'dashed' },
                { label: 'Cumulative lost value', color: '#F2A413', type: 'line' },
              ]}
            />
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                key="planner-cost-loss-composed"
                data={timeseries}
                margin={STANDARD_CHART_MARGIN}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#4A5B6D', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#D9D0C1' }}
                  interval={1}
                  minTickGap={20}
                />
                <YAxis
                  {...getYAxisProps({ title: 'Value (₹ INR)', width: 66 })}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                  formatter={(val, name) => {
                    const labels = {
                      cum_lost_value: 'Cumulative Lost Value',
                      cleaning_cost: 'Cleaning Cost Threshold',
                      daily_lost_kwh: 'Daily Lost Energy',
                    };
                    return [`₹${Number(val).toFixed(1)}`, labels[name] || name];
                  }}
                />

                {/* Fixed cleaning cost reference line */}
                <Line
                  type="stepAfter"
                  dataKey="cleaning_cost"
                  stroke="#C0392B"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Cleaning cost threshold"
                  isAnimationActive={false}
                />

                {/* Cumulative lost energy value */}
                <Line
                  type="monotone"
                  dataKey="cum_lost_value"
                  stroke="#F2A413"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F2A413' }}
                  name="Cumulative lost value"
                  isAnimationActive={false}
                />

                {crossoverDate && (
                  <ReferenceLine
                    x={crossoverDate}
                    stroke="#D98A00"
                    strokeWidth={2}
                    label={{ value: 'Clean now threshold', fill: '#D98A00', fontSize: 11, position: 'top' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Memoized Best Day to Clean Bar Chart (Next 7 Days)
 */
const BestDayChart = memo(function BestDayChart({
  bestDayData,
  isLoading,
  errorMessage,
  emptyMessage,
  isFirstRender,
}) {
  const days = bestDayData?.days || [];
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <h2 className="chart-title">Best Day to Clean (Next 7 Days)</h2>
          <p className="chart-caption">Evaluates upcoming sunlight and yield recovery potential to identify the optimal washing window.</p>
        </div>
        {bestDayData?.best_date && (
          <span className="crossover-flag badge-clean-optimal">
            Recommended: <strong>{bestDayData.best_day_name} ({bestDayData.best_date})</strong>
          </span>
        )}
      </div>
      <div className="chart-body" style={{ height: 280, minHeight: 280 }}>
        {isLoading && !days.length ? (
          <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
        ) : errorMessage ? (
          <div className="chart-error-state"><p>{errorMessage}</p></div>
        ) : !days.length ? (
          <div className="chart-empty-state"><p>{emptyMessage}</p></div>
        ) : (
          <>
            <StandardChartLegend
              items={[
                { label: 'Recommended best day', color: '#2F8F5B', type: 'bar' },
                { label: 'Favourable insolation', color: '#F2A413', type: 'bar' },
                { label: 'Low insolation / overcast', color: '#64748B', type: 'bar' },
              ]}
            />
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                key="planner-best-day-barchart"
                data={days}
                margin={STANDARD_CHART_MARGIN}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#1B2A3A', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#D9D0C1' }}
                  minTickGap={20}
                />
                <YAxis
                  {...getYAxisProps({ title: 'Expected Generation (kWh)', width: 66 })}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                  formatter={(val, name, item) => [
                    `${val} kWh (Suitability: ${item.payload.suitability_score}/100 — ${item.payload.recommendation})`,
                    `${item.payload.date} (${item.payload.day})`,
                  ]}
                />

                <Bar
                  dataKey="expected_generation_kWh"
                  name="Upcoming Generation (kWh)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {days.map((entry, idx) => (
                    <Cell
                      key={`day-cell-${idx}`}
                      fill={entry.is_best ? '#2F8F5B' : (entry.suitability_score >= 70 ? '#F2A413' : '#64748B')}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
      <div className="chart-footer-note">
        <span className="text-muted">
          {bestDayData?.reason || 'Calculates upcoming insolation to maximize post-wash energy generation gains.'}
        </span>
      </div>
    </div>
  );
});

export default function CleaningPlannerPage() {
  const {
    selectedSite,
    setSelectedSite,
    selectedTimestamp,
    setSelectedTimestamp,
    sites,
    siteMinDate,
    siteMaxDate,
    siteMinTimestamp,
    siteMaxTimestamp,
    isBackendConnected,
  } = useSolar();

  // 1. Separate Draft slider states (live while dragging) from Committed states (triggers fetch)
  const [draftWater, setDraftWater] = useState(500);
  const [draftCost, setDraftCost] = useState(500);
  const [draftTariff, setDraftTariff] = useState(8.0);
  const [draftSoiling, setDraftSoiling] = useState(15);

  const [committedWater, setCommittedWater] = useState(500);
  const [committedCost, setCommittedCost] = useState(500);
  const [committedTariff, setCommittedTariff] = useState(8.0);
  const [committedSoiling, setCommittedSoiling] = useState(15);

  // States for Cleaning Decision backend response
  const [decisionLoading, setDecisionLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [baseData, setBaseData] = useState(null);
  const [decisionError, setDecisionError] = useState(null);

  // States for Policy Comparison
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyData, setPolicyData] = useState(null);
  const [policyError, setPolicyError] = useState(null);

  const siteId = selectedSite?.id || 'site-1';
  const siteName = selectedSite?.name || 'Site';
  const emptyRangeMsg = 'No historical telemetry records in this window. Select a date within the site range.';

  // Request sequencing and cancellation refs
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);

  // Debounced commit: commits draft slider values 350ms after user pauses dragging
  useEffect(() => {
    const timer = setTimeout(() => {
      setCommittedWater(draftWater);
      setCommittedCost(draftCost);
      setCommittedTariff(draftTariff);
      setCommittedSoiling(draftSoiling);
    }, 350);
    return () => clearTimeout(timer);
  }, [draftWater, draftCost, draftTariff, draftSoiling]);

  // Immediate commit on pointer release
  const handlePointerUp = useCallback(() => {
    setCommittedWater(draftWater);
    setCommittedCost(draftCost);
    setCommittedTariff(draftTariff);
    setCommittedSoiling(draftSoiling);
  }, [draftWater, draftCost, draftTariff, draftSoiling]);

  // Slider change callbacks for instant draft response
  const handleWaterChange = useCallback((e) => {
    setDraftWater(Number(e.target.value));
  }, []);

  const handleCostChange = useCallback((e) => {
    setDraftCost(Number(e.target.value));
  }, []);

  const handleTariffChange = useCallback((e) => {
    setDraftTariff(Number(e.target.value));
  }, []);

  const handleSoilingChange = useCallback((e) => {
    setDraftSoiling(Number(e.target.value));
  }, []);

  // Fetch cleaning decision whenever site, timestamp, or committed assumptions change
  useEffect(() => {
    if (!isBackendConnected) return;

    // Cancel in-flight previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentReqId = ++requestIdRef.current;

    const loadDecision = async () => {
      if (!baseData) {
        setDecisionLoading(true);
      } else {
        setIsUpdating(true);
      }
      setDecisionError(null);

      try {
        const payload = {
          site: siteId,
          timestamp: selectedTimestamp,
          water_per_wash_L: Number(committedWater),
          cleaning_cost: Number(committedCost),
          tariff_per_kwh: Number(committedTariff),
          assumed_soiling_pct: Number(committedSoiling),
        };
        const res = await fetchCleaningDecision(payload, { signal: abortController.signal });

        if (currentReqId !== requestIdRef.current) return;
        setBaseData(res);
      } catch (err) {
        if (err.isCanceled) return;
        if (currentReqId === requestIdRef.current) {
          setDecisionError(err.message || 'Failed to calculate economic cleaning decision');
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setDecisionLoading(false);
          setIsUpdating(false);
        }
      }
    };

    loadDecision();

    return () => {
      abortController.abort();
    };
  }, [siteId, selectedTimestamp, committedWater, committedCost, committedTariff, committedSoiling, isBackendConnected]);

  // Fetch Policy Comparison simulation (only runs when site changes)
  useEffect(() => {
    let active = true;
    const loadPolicy = async () => {
      setPolicyLoading(true);
      setPolicyError(null);
      try {
        const res = await fetchPolicyComparison(siteId);
        if (!active) return;
        setPolicyData(res);
      } catch (err) {
        if (active) setPolicyError(err.message || 'Failed to load policy comparison simulation');
      } finally {
        if (active) setPolicyLoading(false);
      }
    };

    if (isBackendConnected) {
      loadPolicy();
    }
    return () => { active = false; };
  }, [siteId, isBackendConnected]);

  // 3. Instant local recalculation in useMemo from cached base telemetry series
  // Recalculates cost line, cumulative value line, crossover date, threshold, recommendation instantly at 60 FPS
  const activeData = useMemo(() => {
    if (!baseData) return null;

    const clean_now_threshold_kwh = Math.round((draftCost / draftTariff) * 100) / 100;

    // Handle Planner Scenario mode (when no 2026 telemetry recorded)
    if (baseData.mode === 'scenario' || baseData.status === 'scenario') {
      let crossed_date = null;
      let total_cum_val = 0;
      let total_cum_kwh = 0;
      const days = Array.isArray(baseData.best_day_to_clean?.days) ? baseData.best_day_to_clean.days : [];
      const timeseries = days.map((d) => {
        const d_lost = Math.round(d.expected_generation_kWh * (draftSoiling / 100.0) * 10) / 10;
        total_cum_kwh = Math.round((total_cum_kwh + d_lost) * 10) / 10;
        total_cum_val = Math.round(total_cum_kwh * draftTariff * 10) / 10;
        if (!crossed_date && total_cum_val >= draftCost) {
          crossed_date = d.date;
        }
        return {
          date: d.date,
          day: d.day,
          daily_lost_kwh: d_lost,
          cum_lost_kwh: total_cum_kwh,
          cum_lost_value: total_cum_val,
          cleaning_cost: draftCost,
          threshold_kwh: clean_now_threshold_kwh,
        };
      });

      const decision = total_cum_val >= draftCost ? 'Clean now' : 'Wait';
      const action_line = crossed_date
        ? `Scenario projection (${draftSoiling}% assumed soiling loss): Cumulative loss reaches cleaning cost on ${crossed_date}. Inspection recommended.`
        : `Scenario projection (${draftSoiling}% assumed soiling loss): Cumulative loss (₹${total_cum_val.toFixed(1)}) remains below cleaning cost (₹${draftCost.toFixed(1)}). Wait before washing.`;

      return {
        decision,
        action_line,
        cumulative_lost_value: total_cum_val,
        cumulative_lost_kwh: total_cum_kwh,
        cleaning_cost: draftCost,
        tariff_per_kwh: draftTariff,
        clean_now_threshold_kwh,
        crossed_threshold_date: crossed_date,
        water_saved_scenario_L: total_cum_val < draftCost ? Number(draftWater) : 0,
        timeseries,
        best_day_to_clean: baseData.best_day_to_clean,
        is_scenario: true,
      };
    }

    const baseSeries = Array.isArray(baseData.timeseries) ? baseData.timeseries : [];

    let crossed_date = null;
    let total_cum_val = 0;
    let total_cum_kwh = 0;

    const timeseries = baseSeries.map((pt) => {
      const cum_val = Math.round(pt.cum_lost_kwh * draftTariff * 100) / 100;
      total_cum_val = cum_val;
      total_cum_kwh = pt.cum_lost_kwh;

      if (!crossed_date && cum_val >= draftCost) {
        crossed_date = pt.date;
      }

      return {
        ...pt,
        cum_lost_value: cum_val,
        cleaning_cost: draftCost,
        threshold_kwh: clean_now_threshold_kwh,
      };
    });

    let decision = 'Wait';
    let action_line = '';
    let water_saved = Number(draftWater);

    if (baseData.decision === 'Inspect') {
      decision = 'Inspect';
      action_line = 'Sudden high deficit detected. Inspect electrical wiring, inverters, or physical shading before washing.';
      water_saved = Number(draftWater);
    } else if (total_cum_val >= draftCost) {
      decision = 'Clean now';
      action_line = `Cumulative lost value (${total_cum_val.toFixed(1)}) exceeds cleaning cost (${draftCost.toFixed(1)}). Washing is economically justified.`;
      water_saved = 0.0;
    } else {
      decision = 'Wait';
      action_line = `Cumulative loss (${total_cum_val.toFixed(1)}) has not reached cleaning cost (${draftCost.toFixed(1)}). Wait before washing.`;
      water_saved = Number(draftWater);
    }

    return {
      decision,
      action_line,
      cumulative_lost_value: total_cum_val,
      cumulative_lost_kwh: total_cum_kwh,
      cleaning_cost: draftCost,
      tariff_per_kwh: draftTariff,
      clean_now_threshold_kwh,
      crossed_threshold_date: crossed_date,
      water_saved_scenario_L: water_saved,
      timeseries,
      best_day_to_clean: baseData.best_day_to_clean,
    };
  }, [baseData, draftCost, draftTariff, draftWater, draftSoiling]);

  // Safe references for policy comparison
  const smart = policyData?.smart_policy || policyData?.condition_based_policy;
  const fixed = policyData?.fixed_policy;
  const policyTimeseries = Array.isArray(policyData?.timeseries)
    ? policyData.timeseries
    : (Array.isArray(policyData?.daily_timeseries) ? policyData.daily_timeseries : []);
  const avoidedWashes = (fixed?.cleanings_count ?? 0) - (smart?.cleanings_count ?? 0);
  const waterSavedL = policyData?.water_saved_scenario_L ?? policyData?.comparison?.water_saved_scenario_L ?? (avoidedWashes * draftWater);

  const groupedComparisonData = useMemo(() => {
    if (!fixed || !smart) return [];
    return [
      {
        metric: 'Wash Cycles',
        'Fixed 14-Day Schedule': fixed.cleanings_count,
        'Condition-Based Rule': smart.cleanings_count,
        unit: 'washes',
      },
      {
        metric: 'Assumed Water (kL)',
        'Fixed 14-Day Schedule': Number((fixed.water_used_L / 1000).toFixed(1)),
        'Condition-Based Rule': Number((smart.water_used_L / 1000).toFixed(1)),
        unit: 'kL',
      },
      {
        metric: 'Energy Lost (MWh)',
        'Fixed 14-Day Schedule': Number((fixed.energy_lost_kWh / 1000).toFixed(2)),
        'Condition-Based Rule': Number((smart.energy_lost_kWh / 1000).toFixed(2)),
        unit: 'MWh',
      },
    ];
  }, [fixed, smart]);

  return (
    <div className="planner-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <div className="title-row-with-site">
          <div>
            <h1 className="page-main-title">Cleaning Planner</h1>
            <p className="page-caption">Economics-based solar panel cleaning recommendations from generation shortfalls.</p>
          </div>

          {/* Quick Context Bar */}
          <div className="context-site-pill">
            <span className="context-label">Site:</span>
            <select
              className="context-select"
              value={selectedSite?.id || 'site-1'}
              onChange={(e) => {
                const s = sites.find((x) => x.id === e.target.value);
                if (s) setSelectedSite(s);
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.capacity} kWp)
                </option>
              ))}
            </select>
            <span className="context-divider">•</span>
            <input
              type="datetime-local"
              className="context-date-input"
              value={selectedTimestamp}
              min={siteMinTimestamp}
              max={siteMaxTimestamp}
              onChange={(e) => setSelectedTimestamp(e.target.value)}
              title={`Pick a date between ${siteMinTimestamp} and ${siteMaxTimestamp}`}
            />
          </div>
        </div>
      </div>

      {/* 1. Memoized Decision Banner with Water-Aware Economic Recommendation */}
      <DecisionHero
        decision={activeData?.decision}
        actionLine={activeData?.action_line}
        cumValue={activeData?.cumulative_lost_value}
        cumKwh={activeData?.cumulative_lost_kwh}
        cleaningCost={draftCost}
        thresholdKwh={activeData?.clean_now_threshold_kwh}
        waterSaved={activeData?.water_saved_scenario_L}
        isLoading={decisionLoading}
        isUpdating={isUpdating}
      />

      {/* 2. Memoized Interactive Assumption Controls */}
      <PlannerAssumptions
        water={draftWater}
        cost={draftCost}
        tariff={draftTariff}
        soiling={draftSoiling}
        onWaterChange={handleWaterChange}
        onCostChange={handleCostChange}
        onTariffChange={handleTariffChange}
        onSoilingChange={handleSoilingChange}
        onPointerUp={handlePointerUp}
      />

      {/* 3. Memoized Chart 1: Cumulative Lost Value vs Cleaning Cost */}
      <CostLossChart
        timeseries={activeData?.timeseries}
        crossoverDate={activeData?.crossed_threshold_date}
        isLoading={decisionLoading}
        isUpdating={isUpdating}
        errorMessage={decisionError}
        emptyMessage={emptyRangeMsg}
        isFirstRender={isFirstRenderRef.current}
      />

      {/* 4. Memoized Chart 2: Best Day to Clean (Next 7 Days) */}
      <BestDayChart
        bestDayData={activeData?.best_day_to_clean}
        isLoading={decisionLoading}
        errorMessage={decisionError}
        emptyMessage={emptyRangeMsg}
        isFirstRender={isFirstRenderRef.current}
      />

      {/* What-If Simulation Room Callout */}
      <div className="simulation-cta-banner">
        <div>
          <h3 className="cta-banner-title">Want to test custom washing intervals and thresholds over historical telemetry?</h3>
          <p className="cta-banner-caption">Adjust what-if parameters and compare water and cost savings in the Policy Simulation room.</p>
        </div>
        <Link to="/simulation" className="cta-action-button">
          Open What-If Simulation Room →
        </Link>
      </div>

      {/* Grid of Policy Simulations */}
      <div className="planner-policy-grid">
        {/* Policy Resource Comparison Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Policy Resource Comparison</h2>
              <p className="chart-caption">Fixed 14-day routine cleaning schedule vs Condition-based smart washing rule.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320, minHeight: 320 }}>
            {policyLoading ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : policyError ? (
              <div className="chart-error-state"><p>{policyError}</p></div>
            ) : groupedComparisonData.length === 0 ? (
              <div className="chart-empty-state"><p>{emptyRangeMsg}</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Fixed 14-day schedule', color: '#64748B', type: 'bar' },
                    { label: 'Condition-based smart rule', color: '#2F8F5B', type: 'bar' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedComparisonData} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: '#1B2A3A', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Resource Quantity', width: 62 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name, item) => [
                        `${val} ${item.payload.unit}`,
                        name,
                      ]}
                    />

                    <Bar
                      dataKey="Fixed 14-Day Schedule"
                      fill="#64748B"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="Condition-Based Rule"
                      fill="#2F8F5B"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
          <div className="chart-footer-note">
            <span className="text-muted">
              {avoidedWashes > 0 ? (
                `Smart condition-based rule avoided ${avoidedWashes} washes, saving an estimated ${waterSavedL.toLocaleString()} L of water over ${policyData?.simulation_period_days || 829} days.`
              ) : (
                `Smart rule avoided 0 washes (0 L saved). Threshold used: wash triggered when cumulative lost generation value ≥ cleaning cost (₹${draftCost}) and PR < 0.90.`
              )}
              {' '}(Assumes {draftWater} L water/wash, ₹{draftCost}/wash, and ₹{draftTariff}/kWh).
            </span>
          </div>
        </div>

        {/* Cumulative Lost Energy Line Comparison Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Cumulative Energy Shortfall Over Time</h2>
              <p className="chart-caption">Replay of historical telemetry tracking cumulative generation shortfall across both policies.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320, minHeight: 320 }}>
            {policyLoading ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : policyError ? (
              <div className="chart-error-state"><p>{policyError}</p></div>
            ) : policyTimeseries.length === 0 ? (
              <div className="chart-empty-state"><p>{emptyRangeMsg}</p></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={policyTimeseries} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#6B7A8A', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#D9D0C1' }}
                    interval={Math.ceil(policyTimeseries.length / 7)}
                  />
                  <YAxis
                    unit=" kWh"
                    tick={{ fill: '#6B7A8A', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#D9D0C1' }}
                    label={{ value: 'Cumulative Lost (kWh)', angle: -90, position: 'insideLeft', fill: '#6B7A8A', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                    formatter={(val, name) => [`${Number(val).toFixed(1)} kWh`, name]}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: '#1B2A3A' }} />

                  <Line
                    type="monotone"
                    dataKey="fixed_cum_lost_kWh"
                    stroke="#6B7A8A"
                    strokeWidth={2}
                    dot={false}
                    name="Fixed 14-Day Schedule (kWh)"
                    isAnimationActive={isFirstRenderRef.current}
                  />
                  <Line
                    type="monotone"
                    dataKey="smart_cum_lost_kWh"
                    stroke="#2F8F5B"
                    strokeWidth={2}
                    dot={false}
                    name="Condition-Based Rule (kWh)"
                    isAnimationActive={isFirstRenderRef.current}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="chart-footer-note">
            <span className="text-muted">
              {policyData?.disclaimer || 'Simulation based on historical data and stated assumptions. The dataset contains no real cleaning events.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
