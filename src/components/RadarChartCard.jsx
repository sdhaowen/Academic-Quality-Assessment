import ReactECharts from "echarts-for-react";

function formatTooltip(params, indicators) {
  const items = Array.isArray(params) ? params : [params];
  if (!items.length) {
    return "";
  }
  const currentAxis = params?.name;
  const lines = [`<strong>${currentAxis ?? "指标详情"}</strong>`];
  items.forEach((item) => {
    if (Array.isArray(item.value)) {
      const formatted = item.value
        .map((score, idx) => `${indicators[idx]?.label ?? `轴${idx + 1}`}: ${Number(score).toFixed(2)}`)
        .join("<br/>");
      lines.push(`<span style="color:${item.color}">●</span> ${item.seriesName}<br/>${formatted}`);
    } else {
      lines.push(
        `<span style="color:${item.color}">●</span> ${item.seriesName}: ${Number(item.value).toFixed(2)}`,
      );
    }
  });
  return lines.join("<br/>");
}

export default function RadarChartCard({
  title,
  subtitle,
  indicators,
  series,
  footerNote,
  height = 360,
  autoPlay = false,
  animationDuration = 1600,
  animationDelayStep = 700,
}) {
  const normalizedSeries = series.map((item) => ({
    ...item,
    value: Array.isArray(item.value) ? item.value : item.values,
  }));

  const option = {
    tooltip: {
      trigger: "item",
      formatter: (params) => formatTooltip(params, indicators),
    },
    animation: true,
    animationDuration: autoPlay ? animationDuration : 600,
    legend: {
      bottom: 0,
      textStyle: { color: "#445272" },
    },
    radar: {
      indicator: indicators.map((item) => ({ name: item.label, max: 5 })),
      center: ["50%", "48%"],
      radius: "60%",
      splitNumber: 5,
      axisName: { color: "#2c3b57", fontSize: 12 },
      splitArea: { areaStyle: { color: ["#fbfcff", "#f6f8fe"] } },
      splitLine: { lineStyle: { color: "#dbe4f6" } },
      axisLine: { lineStyle: { color: "#c9d6ef" } },
    },
    series: [
      {
        type: "radar",
        emphasis: { lineStyle: { width: 3 } },
        data: normalizedSeries.map((item, index) => ({
          ...item,
          animationDelay: autoPlay ? index * animationDelayStep : 0,
        })),
      },
    ],
  };

  return (
    <section className="chart-card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle ? <span className="subtitle">{subtitle}</span> : null}
      </div>
      <ReactECharts option={option} style={{ height }} />
      {footerNote ? <p className="chart-note">{footerNote}</p> : null}
    </section>
  );
}

