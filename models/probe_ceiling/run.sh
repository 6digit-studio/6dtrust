#!/usr/bin/env bash
# wm probe: one measurement, signal lines out, exit = instrument health.
cd "$(dirname "$0")/../.."
exec bun models/probe_ceiling/probe.ts
