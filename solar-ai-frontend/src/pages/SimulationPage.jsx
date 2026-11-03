import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useSolar } from '../context/SolarContext';
import { fetchSimulate } from '../services/api';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
} from '../utils/chartConfig';

/**
 * Memoized Simulation KPI Strip
 * Tabular numerals and fixed box heights prevent layout shifts.
 */
const SimulationKPIs = memo(function SimulationKPIs({
  comparison,
  waterPerWash,
  intervalDays,
  simulatedDays,
}) {
  return (
    <div className="simulation-kpi-grid">
      <div className="simulation-kpi-card">
        <span className="kpi-label">Avoided Wash Cycles</span>
        <div className="kpi-value-row">
          <span className="kpi-number text-green">{comparison?.cleanings_avoided ?? '--'}</span>
          <span className="kpi-unit">washes</span>
        </div>
        <span className="kpi-caption">Saved vs {intervalDays}-day routine schedule</span>
      </div>

      <div className="simulation-kpi-card">
        <span className="kpi-label">Estimated Water Saved</span>
        <div className="kpi-value-row">
          <span className="kpi-number text-amber">
            {comparison?.water_saved_scenario_L != null
              ? comparison.water_saved_scenario_L.toLocaleString()
              : '--'}
          </span>
          <span className="kpi-unit">Liters</span>
        </div>
        <span className="kpi-caption">At {waterPerWash} L per wash benchmark (estimate)</span>
      </div>

      <div className="simulation-kpi-card">
        <span className="kpi-label">Net Financial Benefit</span>
        <div className="kpi-value-row">
          <span className="kpi-number">
            {comparison?.cost_difference != null
              ? `₹${comparison.cost_difference.toLocaleString()}`
              : '--'}
          </span>
          <span className="kpi-unit">INR</span>
        </div>
        <span className="kpi-caption">Avoided labour & equipment expenses</span>
      </div>

      <div className="simulation-kpi-card">
        <span className="kpi-label">Replay Duration</span>
        <div className="kpi-value-row">
          <span className="kpi-number">{simulatedDays ?? 829}</span>
          <span className="kpi-unit">days</span>
        </div>
        <span className="kpi-caption">Real 30-min telemetry records evaluated</span>
      </div>
    </div>
  );
});

/**
 * Memoized Simulation Sliders Panel
 */
const SimulationSliders = memo(function SimulationSliders({
  interval,
  threshold,
  water,
  tariff,
  cost,
  onIntervalChange,
  onThresholdChange,
  onWaterChange,
  onTariffChange,
  onCostChange,
  onPointerUp,
  isUpdating,
}) {
  return (
    <div className="simulation-sliders-panel">
      <div className="sliders-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 className="sliders-panel-title">What-If Policy Parameters</h2>
          {isUpdating && <span className="updating-pill">Syncing...</span>}
        </div>
        <p className="sliders-panel-caption">Adjust washing frequencies and economic triggers to re-run the simulation live through the backend.</p>
      </div>

      <div className="sliders-grid-row">
        <div className="slider-box">
          <div className="slider-label-line">
            <label htmlFor="sim-interval" title="Washing Cycle">Washing Cycle:</label>
            <span className="slider-current-val">Every <strong>{interval}d</strong></span>
          </div>
          <input
            id="sim-interval"
            type="range"
            min="3"
            max="60"
            step="1"
            value={interval}
            onChange={onIntervalChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-subtext">Fixed calendar baseline (typical schedule: 14 days)</span>
        </div>

        <div className="slider-box">
          <div className="slider-label-line">
            <label htmlFor="sim-threshold" title="Loss Threshold">Loss Threshold:</label>
            <span className="slider-current-val"><strong>₹{threshold}</strong></span>
          </div>
          <input
            id="sim-threshold"
            type="range"
            min="100"
            max="2500"
            step="50"
            value={threshold}
            onChange={onThresholdChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-subtext">Cumulative energy lost value required to justify washing</span>
        </div>

        <div className="slider-box">
          <div className="slider-label-line">
            <label htmlFor="sim-water" title="Water / Wash">Water / Wash:</label>
            <span className="slider-current-val"><strong>{water} L</strong></span>
          </div>
          <input
            id="sim-water"
            type="range"
            min="100"
            max="1500"
            step="50"
            value={water}
            onChange={onWaterChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-subtext">Cleaning water volume consumption benchmark</span>
        </div>

        <div className="slider-box">
          <div className="slider-label-line">
            <label htmlFor="sim-tariff" title="Tariff">Tariff:</label>
            <span className="slider-current-val"><strong>₹{tariff}/kWh</strong></span>
          </div>
          <input
            id="sim-tariff"
            type="range"
            min="2"
            max="20"
            step="0.5"
            value={tariff}
            onChange={onTariffChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-subtext">Valuation rate for avoided energy losses</span>
        </div>

        <div className="slider-box">
          <div className="slider-label-line">
            <label htmlFor="sim-cost" title="Cleaning Cost">Cleaning Cost:</label>
            <span className="slider-current-val"><strong>₹{cost}</strong></span>
          </div>
          <input
            id="sim-cost"
            type="range"
            min="100"
            max="2500"
            step="50"
            value={cost}
            onChange={onCostChange}
            onPointerUp={onPointerUp}
            className="styled-slider"
          />
          <span className="slider-subtext">Mobilization & labor expense per wash event</span>
        </div>
      </div>
    </div>
  );
});

export default function SimulationPage() {
  const { selectedSite, sites, setSelectedSite, isBackendConnected } = useSolar();

  const siteId = selectedSite?.id || 'site-1';
  const siteName = selectedSite?.name || 'Site 1';

  // Draft states (instant slider tracking)
  const [draftInterval, setDraftInterval] = useState(14);
  const [draftThreshold, setDraftThreshold] = useState(500);
  const [draftWater, setDraftWater] = useState(500);
  const [draftTariff, setDraftTariff] = useState(8.0);
  const [draftCost, setDraftCost] = useState(500);

  // Committed states (triggers backend fetch)
  const [committedInterval, setCommittedInterval] = useState(14);
  const [committedThreshold, setCommittedThreshold] = useState(500);
  const [committedWater, setCommittedWater] = useState(500);
  const [committedTariff, setCommittedTariff] = useState(8.0);
  const [committedCost, setCommittedCost] = useState(500);

  // Simulation results state
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [simData, setSimData] = useState(null);
  const [error, setError] = useState(null);

  // Request sequencing and animation refs
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);

  // Debounce committed states by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setCommittedInterval(draftInterval);
      setCommittedThreshold(draftThreshold);
      setCommittedWater(draftWater);
      setCommittedTariff(draftTariff);
      setCommittedCost(draftCost);
    }, 350);
    return () => clearTimeout(timer);
  }, [draftInterval, draftThreshold, draftWater, draftTariff, draftCost]);

  // Immediate commit on pointer release
  const handlePointerUp = useCallback(() => {
    setCommittedInterval(draftInterval);
    setCommittedThreshold(draftThreshold);
    setCommittedWater(draftWater);
    setCommittedTariff(draftTariff);
    setCommittedCost(draftCost);
  }, [draftInterval, draftThreshold, draftWater, draftTariff, draftCost]);

  // Handler callbacks
  const handleIntervalChange = useCallback((e) => setDraftInterval(Number(e.target.value)), []);
  const handleThresholdChange = useCallback((e) => setDraftThreshold(Number(e.target.value)), []);
  const handleWaterChange = useCallback((e) => setDraftWater(Number(e.target.value)), []);
  const handleTariffChange = useCallback((e) => setDraftTariff(Number(e.target.value)), []);
  const handleCostChange = useCallback((e) => setDraftCost(Number(e.target.value)), []);

  // Fetch simulation with AbortController and request ID sequencing
  useEffect(() => {
    if (!isBackendConnected) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentReqId = ++requestIdRef.current;

    const runSim = async () => {
      if (!simData) {
        setLoading(true);
      } else {
        setIsUpdating(true);
      }
      setError(null);

      try {
        const payload = {
          site: siteId,
          interval_days: Number(committedInterval),
          threshold_rs: Number(committedThreshold),
          cleaning_cost: Number(committedCost),
          water_per_wash_L: Number(committedWater),
          tariff_per_kwh: Number(committedTariff),
        };
        const res = await fetchSimulate(payload, { signal: abortController.signal });
        if (currentReqId !== requestIdRef.current) return;
        setSimData(res);
      } catch (err) {
        if (err.isCanceled) return;
        if (currentReqId === requestIdRef.current) {
          setError(err.message || 'Simulation execution failed');
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
          setIsUpdating(false);
        }
      }
    };

    runSim();

    return () => {
      abortController.abort();
    };
  }, [siteId, committedInterval, committedThreshold, committedCost, committedWater, committedTariff, isBackendConnected]);

  // Grouped comparison bar data
  const fixed = simData?.fixed_policy;
  const smart = simData?.smart_policy;
  const comparison = simData?.comparison;

  const groupedComparisonData = useMemo(() => {
    if (!fixed || !smart) return [];
    return [
      {
        metric: 'Wash Cycles',
        [`Fixed ${committedInterval}-Day Schedule`]: fixed.cleanings_count,
        'Smart Condition-Based': smart.cleanings_count,
        unit: 'washes',
      },
      {
        metric: 'Assumed Water (kL)',
        [`Fixed ${committedInterval}-Day Schedule`]: Number((fixed.water_used_L / 1000).toFixed(1)),
        'Smart Condition-Based': Number((smart.water_used_L / 1000).toFixed(1)),
        unit: 'kL',
      },
      {
        metric: 'Energy Lost (MWh)',
        [`Fixed ${committedInterval}-Day Schedule`]: Number((fixed.energy_lost_kWh / 1000).toFixed(2)),
        'Smart Condition-Based': Number((smart.energy_lost_kWh / 1000).toFixed(2)),
        unit: 'MWh',
      },
    ];
  }, [fixed, smart, committedInterval]);

  const timeseries = Array.isArray(simData?.timeseries) ? simData.timeseries : [];

  return (
    <div className="simulation-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <div className="title-row-with-site">
          <div>
            <h1 className="page-main-title">Cleaning Policy Simulation</h1>
            <p className="page-caption">Simulation comparing condition-based cleaning against fixed schedules to evaluate water and cost savings.</p>
          </div>

          <div className="context-site-pill">
            <span className="context-label">Site:</span>
            <select
              className="context-select"
              value={siteId}
              onChange={(e) => {
                const s = sites.find((x) => x.id === e.target.value);
                if (s) setSelectedSite(s);
              }}
            >
              {sites.map((s) => {
                const label = s.name.includes('kWp') ? s.name : `${s.name} (${s.capacity} kWp)`;
                return (
                  <option key={s.id} value={s.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Scenario KPI Strip */}
      <SimulationKPIs
        comparison={comparison}
        waterPerWash={draftWater}
        intervalDays={draftInterval}
        simulatedDays={simData?.simulation_parameters?.simulated_days}
      />

      {/* What-If Interactive Sliders Panel */}
      <SimulationSliders
        interval={draftInterval}
        threshold={draftThreshold}
        water={draftWater}
        tariff={draftTariff}
        cost={draftCost}
        onIntervalChange={handleIntervalChange}
        onThresholdChange={handleThresholdChange}
        onWaterChange={handleWaterChange}
        onTariffChange={handleTariffChange}
        onCostChange={handleCostChange}
        onPointerUp={handlePointerUp}
        isUpdating={isUpdating}
      />

      {/* Grouped Comparison Bar Chart & Timeseries Replay Line */}
      <div className="planner-policy-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Resource Consumption Comparison</h2>
              <p className="chart-caption">Comparing wash counts, assumed water usage, and generation losses.</p>
            </div>
          </div>
          <div className={`chart-body ${isUpdating ? 'is-updating' : ''}`} style={{ height: 340, minHeight: 340 }}>
            {loading && !groupedComparisonData.length ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : error ? (
              <div className="chart-error-state"><p>{error}</p></div>
            ) : groupedComparisonData.length === 0 ? (
              <div className="chart-empty-state"><p>No comparison data available.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: `Fixed ${committedInterval}-day schedule`, color: '#64748B', type: 'bar' },
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
                      formatter={(val, name, item) => [`${val} ${item.payload.unit}`, name]}
                    />

                    <Bar
                      dataKey={`Fixed ${committedInterval}-Day Schedule`}
                      fill="#64748B"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="Smart Condition-Based"
                      fill="#2F8F5B"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Cumulative Energy Shortfall Over Time</h2>
              <p className="chart-caption">Replay tracking cumulative lost kilowatt-hours under both maintenance strategies.</p>
            </div>
          </div>
          <div className={`chart-body ${isUpdating ? 'is-updating' : ''}`} style={{ height: 340, minHeight: 340 }}>
            {loading && !timeseries.length ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : error ? (
              <div className="chart-error-state"><p>{error}</p></div>
            ) : timeseries.length === 0 ? (
              <div className="chart-empty-state"><p>No timeseries replay available.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: `Fixed ${committedInterval}-day schedule`, color: '#64748B', type: 'line' },
                    { label: 'Condition-based smart rule', color: '#2F8F5B', type: 'line' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      interval={Math.ceil(timeseries.length / 7)}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Cumulative Lost (kWh)', width: 66 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name) => [`${Number(val).toFixed(1)} kWh`, name]}
                    />

                    <Line
                      type="monotone"
                      dataKey="fixed_cum_lost_kWh"
                      stroke="#64748B"
                      strokeWidth={2}
                      dot={false}
                      name={`Fixed ${committedInterval}-Day Schedule`}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="smart_cum_lost_kWh"
                      stroke="#2F8F5B"
                      strokeWidth={2}
                      dot={false}
                      name="Condition-based smart rule"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimers & Assumptions Footnote */}
      <div className="page-footnote-strip">
        <p className="footer-disclaimer-text">
          {simData?.disclaimer || 'Simulation based on historical data and stated assumptions. The dataset contains no real cleaning events, so this is an empirical scenario model.'}
        </p>
      </div>
    </div>
  );
}
