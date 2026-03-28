# Observability Patterns

Read this when investigating system issues, building dashboards, writing alerting rules, or working with metrics and logs. Covers PromQL, LogQL, Grafana, alerting, and SLO/SLI patterns.

## Why This Matters

Observability is how you answer "what's happening in production?" without reading source code. Good observability turns a 3-hour debugging session into a 10-minute investigation. Bad observability means guessing, restarting pods, and hoping for the best.

## PromQL Query Patterns

**Rate and increase — the two most important functions:**
- `rate(metric[5m])` — per-second average rate over 5 minutes. Use for gauging throughput.
- `increase(metric[1h])` — total increase over 1 hour. Use for counting events.
- Always use `rate()` inside `sum()`, never outside: `sum(rate(requests_total[5m]))` not `rate(sum(requests_total)[5m])` [strong]

**Common query patterns:**

| What You Want | PromQL |
|---------------|--------|
| Request rate | `sum(rate(http_requests_total[5m])) by (service)` |
| Error rate (%) | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100` |
| p99 latency | `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` |
| Memory usage (%) | `container_memory_working_set_bytes / container_spec_memory_limit_bytes * 100` |
| CPU throttling | `rate(container_cpu_cfs_throttled_seconds_total[5m])` |

**Common PromQL mistakes:**
- Missing `by (le)` in `histogram_quantile` — aggregates all histograms together, producing garbage
- Using `avg` for latency — hides the tail. Use percentiles (p95, p99).
- Rate window too small — `rate(x[1m])` is noisy. Use 4x the scrape interval minimum.
- Comparing `container_memory_usage_bytes` vs `container_memory_working_set_bytes` — use `working_set` for OOM prediction (it's what the OOM killer looks at)

## LogQL Query Patterns

**Label filtering** (fast — indexed):
```
{namespace="production", app="api-gateway"}
```

**Line filtering** (slower — full text scan):
```
{app="api-gateway"} |= "error" != "health_check"
```

**Parsing** (extract fields from log lines):
```
{app="api-gateway"} | json | status >= 500 | line_format "{{.method}} {{.path}} {{.status}}"
```

**Common patterns:**
- Error investigation: `{app="X"} |= "error" | json | duration > 5s`
- Request tracing: `{app=~".+"} |= "trace-id-123"`
- Counting errors over time: `sum(count_over_time({app="X"} |= "error" [5m]))`

**Label cardinality warning:** Don't add high-cardinality labels (user IDs, request IDs) as indexed labels. They explode storage. Use line content for high-cardinality filtering.

## Grafana Dashboard Conventions

**Dashboard organization:**
- One dashboard per service (not per team or per feature)
- Row 1: Golden signals (rate, errors, latency, saturation)
- Row 2: Service-specific business metrics
- Row 3: Resource usage (CPU, memory, disk, network)

**Variable usage:**
- `$namespace` and `$service` as dashboard variables — makes dashboards reusable
- Use `All` option for multi-service overview
- Link variables to other dashboards for drill-down

**Panel best practices:**
- Time series for trends, stat panels for current values, tables for lists
- Set meaningful thresholds (green/yellow/red) based on SLOs, not gut feeling
- Use `$__rate_interval` instead of hardcoded rate windows — adapts to the dashboard's time range

**Alerting annotations:** Every alert panel should link to a runbook. The alert fires at 2 AM — the on-call engineer needs "what to do" not "what this metric means."

## Alerting Rules

**Severity levels:**

| Severity | Response | Example |
|----------|----------|---------|
| **Critical** | Page on-call immediately | Service down, data loss risk, all requests failing |
| **Warning** | Investigate within hours | Error rate elevated, disk filling, latency degraded |
| **Info** | Review next business day | Unusual traffic pattern, dependency slow |

**Alert structure:**
```yaml
alert: HighErrorRate
expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
for: 5m  # Avoid flapping — sustain for 5 minutes before firing
labels:
  severity: warning
annotations:
  summary: "Error rate above 5% for {{ $labels.service }}"
  runbook: "https://docs.example.com/runbooks/high-error-rate"
```

**Alert anti-patterns:**
- `for: 0m` — fires on every spike, causes alert fatigue
- No `for` clause at all — same problem
- Missing runbook link — alert is useless without action guidance
- Alerting on symptoms AND causes — pick one. Alert on "error rate high," investigate the cause.

## SLO/SLI Patterns

**Define SLIs first, then SLOs** [consensus]:

| Signal | SLI | SLO |
|--------|-----|-----|
| **Availability** | Successful requests / total requests | 99.9% over 30 days |
| **Latency** | Requests < 500ms / total requests | 95% of requests under 500ms |
| **Throughput** | Successful operations per second | Sustain 1000 req/s at peak |
| **Correctness** | Correct responses / total responses | 99.99% correct |

**Error budget:** If SLO is 99.9%, error budget is 0.1% = ~43 minutes of downtime per 30 days. When the budget is spent, freeze deployments and focus on reliability.

**Burn rate alerts:** Instead of alerting on SLO breach (too late), alert on burn rate — "at this rate, you'll exhaust the error budget in 6 hours."

## Incident Investigation Workflow

1. **What changed?** Check recent deployments, config changes, infrastructure updates
2. **What's the blast radius?** One service, one region, or everything?
3. **Golden signals:** Rate, errors, latency, saturation — which signal is abnormal?
4. **Correlation:** Do the metrics timeline match a deployment or external event?
5. **Drill down:** From dashboard → logs → traces → specific request/pod

## Anti-patterns

- **Dashboard overload.** 50 panels on one dashboard helps nobody. Focus on the golden signals + service-specific metrics.
- **Alerting on everything.** Alert fatigue = alerts ignored. Only alert on actionable conditions.
- **Missing context in alerts.** "CPU high" is useless. "CPU at 95% on pod api-gateway-abc for 10m, runbook: [link]" is actionable.
- **Percentile averaging.** Average of p99 across instances is NOT the system p99. Aggregate the histograms first, then compute the percentile.
- **Ignoring cardinality.** Adding `user_id` as a Prometheus label creates millions of time series. Use logs for high-cardinality dimensions.
