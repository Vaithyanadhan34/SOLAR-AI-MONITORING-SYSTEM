import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StatusPill from '../components/StatusPill.jsx';

test('StatusPill - State: connected renders readable text and green dot', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatusPill, {
      state: 'connected',
      lastUpdated: '14:20 IST',
      dataSource: 'Open-Meteo Live API',
    })
  );

  assert.ok(html.includes('Live weather - updated 14:20 IST'), 'Must render full text for connected');
  assert.ok(html.includes('Live - 14:20'), 'Must render responsive short text');
  assert.ok(html.includes('status-pill-dot connected'), 'Must render connected dot class');
  assert.ok(html.includes('aria-label="Live weather - updated 14:20 IST'), 'Must have accessible aria-label');
  assert.ok(html.includes('title="Live weather connected • Source: Open-Meteo Live API • Updated: 14:20 IST"'), 'Must have descriptive title tooltip');
  assert.ok(!html.includes('undefined'), 'Must not render undefined');
});

test('StatusPill - State: loading renders readable text and blue pulsing dot', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatusPill, {
      state: 'loading',
      dataSource: 'Open-Meteo Live API',
    })
  );

  assert.ok(html.includes('Checking live weather...'), 'Must render full text for loading');
  assert.ok(html.includes('Checking...'), 'Must render responsive short text');
  assert.ok(html.includes('status-pill-dot loading'), 'Must render loading dot class');
  assert.ok(html.includes('aria-label="Checking live weather...'), 'Must have aria-label');
  assert.ok(!html.includes('undefined'), 'Must not render undefined');
});

test('StatusPill - State: unavailable renders readable text and amber dot', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatusPill, {
      state: 'unavailable',
      dataSource: 'Open-Meteo Live API',
    })
  );

  assert.ok(html.includes('Live weather unavailable'), 'Must render full text for unavailable');
  assert.ok(html.includes('Unavailable'), 'Must render responsive short text');
  assert.ok(html.includes('status-pill-dot unavailable'), 'Must render unavailable dot class');
  assert.ok(html.includes('aria-label="Live weather unavailable'), 'Must have aria-label');
  assert.ok(!html.includes('undefined'), 'Must not render undefined');
});

test('StatusPill - State: replay renders readable text and grey dot', () => {
  const html = renderToStaticMarkup(
    React.createElement(StatusPill, {
      state: 'replay',
    })
  );

  assert.ok(html.includes('Historical replay (2020-2022)'), 'Must render full text for replay');
  assert.ok(html.includes('Replay (20-22)'), 'Must render responsive short text');
  assert.ok(html.includes('status-pill-dot replay'), 'Must render replay dot class');
  assert.ok(html.includes('aria-label="Historical replay (2020-2022)'), 'Must have aria-label');
  assert.ok(!html.includes('undefined'), 'Must not render undefined');
});

test('StatusPill - Robustness: never renders empty text even with missing or undefined props', () => {
  const html = renderToStaticMarkup(React.createElement(StatusPill, {}));

  assert.ok(html.includes('status-pill-text-full'), 'Has full text wrapper');
  assert.ok(html.includes('status-pill-text-short'), 'Has short text wrapper');
  // Verify that the text node inside is non-empty
  const match = html.match(/class="status-pill-text-full">([^<]+)<\/span>/);
  assert.ok(match && match[1].trim().length > 0, 'Text must be non-empty string');
  assert.ok(!html.includes('undefined'), 'Must not contain undefined');
  assert.ok(!html.includes('null'), 'Must not contain null');
});
