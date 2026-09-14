// src/lib/reportPdf.tsx
//
// Builds the downloadable Stock Health Report as a real vector PDF via
// @react-pdf/renderer (not a screenshot/print of the live UI) — dynamically
// imported only when a report is actually requested, so it never adds to the
// main bundle. Every release gets the same rich, self-explanatory treatment
// as the interactive detail panel (status, plain-language recommendation and
// reasoning, Proper/AMPED breakdown), because the reader may never open the
// tool itself.
import { Circle, Document, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { CatalogueView, ConsolidatedRow, StockStatus, Thresholds } from "../types";
import { explainRow } from "./explain";
import { formatMoney, formatNumber } from "./format";

// Keep in sync with tailwind.config.js's theme.extend.colors — react-pdf has
// no CSS/Tailwind pipeline, so these are duplicated as plain hex here.
const COLOR = {
  proper: "#2a78d6",
  properSoft: "#e8f0fc",
  amped: "#eb6834",
  ampedSoft: "#fdece3",
  good: "#0ca30c",
  goodSoft: "#e6f6e6",
  warning: "#fab219",
  warningSoft: "#fef3da",
  serious: "#ec835a",
  seriousSoft: "#fce6dd",
  critical: "#d03b3b",
  criticalSoft: "#fbe6e6",
  ink: "#0f172a",
  inkSecondary: "#475569",
  inkMuted: "#94a3b8",
  border: "#e2e8f0",
  panel: "#f8fafc",
};

const STATUS_META: Record<StockStatus, { label: string; color: string; bg: string }> = {
  stockout: { label: "Out of stock", color: COLOR.critical, bg: COLOR.criticalSoft },
  critical: { label: "Needs repress", color: COLOR.serious, bg: COLOR.seriousSoft },
  healthy: { label: "Healthy", color: COLOR.good, bg: COLOR.goodSoft },
  overstocked: { label: "Overstocked", color: COLOR.warning, bg: COLOR.warningSoft },
  dormant: { label: "Dormant", color: COLOR.inkMuted, bg: "#f1f5f9" },
};

const VIEW_LABEL: Record<CatalogueView, string> = {
  combined: "Combined",
  frontline: "Frontline",
  catalogue: "Catalogue",
};

const STATUS_ORDER: StockStatus[] = ["stockout", "critical", "overstocked", "dormant", "healthy"];

// A4 width (595.28pt) minus the page's horizontal padding (32pt each side).
// Colored bars use absolute point widths throughout this file rather than
// percentages — percentage widths on a bare inline style object (not routed
// through StyleSheet.create) were silently failing to render in testing.
const PAGE_CONTENT_WIDTH = 531;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: COLOR.ink },
  h1: { fontSize: 20, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: COLOR.proper, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 10 },
  metaItem: { fontSize: 8, color: COLOR.inkSecondary },
  metaLabel: { fontWeight: 700, color: COLOR.inkSecondary },
  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingBottom: 14, marginBottom: 16 },

  panel: { backgroundColor: COLOR.panel, borderRadius: 6, padding: 12, marginBottom: 16 },
  panelText: { fontSize: 8.5, lineHeight: 1.5, color: COLOR.inkSecondary },

  summaryText: { fontSize: 9.5, lineHeight: 1.5, color: COLOR.ink, marginBottom: 16 },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiBox: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: COLOR.border, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 7.5, color: COLOR.inkSecondary },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  kpiSub: { fontSize: 7, color: COLOR.inkMuted, marginTop: 2 },

  healthLegendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20, marginTop: 6 },
  healthLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  healthLegendText: { fontSize: 7.5, color: COLOR.inkSecondary },

  sectionHeader: {
    fontSize: 12,
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ink,
    paddingBottom: 3,
    marginBottom: 3,
    marginTop: 6,
  },
  sectionNote: { fontSize: 8, color: COLOR.inkMuted, marginBottom: 8 },
  emptyNote: { fontSize: 8.5, color: COLOR.inkMuted, fontStyle: "italic", marginBottom: 16 },

  card: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 5,
    padding: 8,
    marginBottom: 6,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  chip: { fontSize: 7, fontWeight: 700, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 },
  cardTitle: { fontSize: 9.5, fontWeight: 700, flexGrow: 1 },
  cardMeta: { fontSize: 7.5, color: COLOR.inkMuted },
  cardRecommendation: { fontSize: 8.5, fontWeight: 700, marginBottom: 2 },
  cardReasoning: { fontSize: 8, lineHeight: 1.4, color: COLOR.inkSecondary, marginBottom: 6 },

  regionRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  regionBox: { flexGrow: 1, flexBasis: 0, borderRadius: 4, padding: 6 },
  regionLabel: { fontSize: 7, fontWeight: 700, marginBottom: 2 },
  regionStock: { fontSize: 10, fontWeight: 700 },
  regionCoverText: { fontSize: 7, color: COLOR.inkSecondary, marginTop: 2 },
  regionNote: { fontSize: 7, color: COLOR.inkMuted, marginTop: 2 },

  cardFooterRow: { flexDirection: "row", gap: 16 },
  cardFooterItem: { fontSize: 7.5, color: COLOR.inkSecondary },
  cardFooterLabel: { color: COLOR.inkMuted },

  pageFooter: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 7,
    color: COLOR.inkMuted,
    textAlign: "center",
  },
});

function Chip({ status }: { status: StockStatus }) {
  const meta = STATUS_META[status];
  return <Text style={[styles.chip, { color: meta.color, backgroundColor: meta.bg }]}>{meta.label}</Text>;
}

const COVER_BAR_WIDTH = 140;
const COVER_BAR_HEIGHT = 5;

function CoverBar({ months, status, thresholds }: { months: number | null; status: StockStatus; thresholds: Thresholds }) {
  const meta = STATUS_META[status];
  if (months === null) {
    return <Text style={styles.regionCoverText}>no sales</Text>;
  }
  const domainMax = thresholds.highMonths * 2;
  const fillWidth = Math.max(4, Math.round(Math.min(1, months / domainMax) * COVER_BAR_WIDTH));
  return (
    <View>
      {/* Drawn as SVG shapes, not styled Views — plain colored Views with no
          text content were silently failing to paint in this renderer. */}
      <Svg width={COVER_BAR_WIDTH} height={COVER_BAR_HEIGHT} style={{ marginTop: 3 }}>
        <Rect x={0} y={0} width={COVER_BAR_WIDTH} height={COVER_BAR_HEIGHT} rx={2} fill="#e2e8f0" />
        <Rect x={0} y={0} width={fillWidth} height={COVER_BAR_HEIGHT} rx={2} fill={meta.color} />
      </Svg>
      <Text style={styles.regionCoverText}>
        {months > domainMax ? `${Math.round(months)}mo+` : `${months.toFixed(1)}mo`}
      </Text>
    </View>
  );
}

function ReleaseCard({ row, thresholds }: { row: ConsolidatedRow; thresholds: Thresholds }) {
  const { recommendation, reasoning } = explainRow(row, thresholds);
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardTopRow}>
        <Chip status={row.status} />
        <Text style={styles.cardTitle}>
          {row.artist} — {row.title}
        </Text>
        <Text style={styles.cardMeta}>
          {row.format} · {row.catalogNo} · {row.barcode || "—"}
        </Text>
      </View>

      <Text style={styles.cardRecommendation}>{recommendation}</Text>
      <Text style={styles.cardReasoning}>{reasoning}</Text>

      <View style={styles.regionRow}>
        <View style={[styles.regionBox, { backgroundColor: COLOR.properSoft }]}>
          <Text style={[styles.regionLabel, { color: COLOR.proper }]}>PROPER</Text>
          <Text style={styles.regionStock}>{formatNumber(row.properStock)} units</Text>
          <CoverBar months={row.properMonthsOfCover} status={row.properStatus} thresholds={thresholds} />
          {row.properOnOrder > 0 && <Text style={styles.regionNote}>+{formatNumber(row.properOnOrder)} on order</Text>}
          {row.properBackorder > 0 && (
            <Text style={styles.regionNote}>{formatNumber(row.properBackorder)} on backorder</Text>
          )}
        </View>
        <View style={[styles.regionBox, { backgroundColor: COLOR.ampedSoft }]}>
          <Text style={[styles.regionLabel, { color: COLOR.amped }]}>AMPED</Text>
          {row.ampedMatched ? (
            <>
              <Text style={styles.regionStock}>{formatNumber(row.ampedStock)} units</Text>
              <CoverBar months={row.ampedMonthsOfCover} status={row.ampedStatus} thresholds={thresholds} />
              {row.ampedOnOrder > 0 && (
                <Text style={styles.regionNote}>+{formatNumber(row.ampedOnOrder)} on order</Text>
              )}
            </>
          ) : (
            <Text style={styles.regionNote}>No AMPED match found — likely not distributed via AMPED.</Text>
          )}
        </View>
      </View>

      <View style={styles.cardFooterRow}>
        <Text style={styles.cardFooterItem}>
          <Text style={styles.cardFooterLabel}>Unit price: </Text>
          {row.unitPrice ? formatMoney(row.unitPrice) : "—"}
        </Text>
        <Text style={styles.cardFooterItem}>
          <Text style={styles.cardFooterLabel}>Stock value: </Text>
          {row.stockValue ? formatMoney(row.stockValue) : "—"}
        </Text>
      </View>
    </View>
  );
}

function ReportSection({
  title,
  note,
  rows,
  thresholds,
}: {
  title: string;
  note: string;
  rows: ConsolidatedRow[];
  thresholds: Thresholds;
}) {
  return (
    <View>
      <Text style={styles.sectionHeader}>
        {title} ({formatNumber(rows.length)})
      </Text>
      <Text style={styles.sectionNote}>{note}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyNote}>None — nothing to report in this section.</Text>
      ) : (
        rows.map((r, i) => <ReleaseCard key={`${r.barcode}-${i}`} row={r} thresholds={thresholds} />)
      )}
    </View>
  );
}

interface ReportPdfProps {
  view: CatalogueView;
  generatedAt: Date;
  thresholds: Thresholds;
  allRows: ConsolidatedRow[];
  repressRows: ConsolidatedRow[];
  rebalanceRows: ConsolidatedRow[];
  overstockRows: ConsolidatedRow[];
  dormantRows: ConsolidatedRow[];
  properFileName: string | null;
  properRowCount: number;
  ampedRowCount: number;
}

export function ReportPdfDocument({
  view,
  generatedAt,
  thresholds,
  allRows,
  repressRows,
  rebalanceRows,
  overstockRows,
  dormantRows,
  properFileName,
  properRowCount,
  ampedRowCount,
}: ReportPdfProps) {
  const totalUnits = allRows.reduce((sum, r) => sum + r.combinedStock, 0);
  const excessValueTotal = overstockRows.reduce((sum, r) => sum + (r.excessValue || 0), 0);
  const holdingCostTotal = overstockRows.reduce((sum, r) => sum + (r.excessHoldingCostPerMonth || 0), 0);
  const total = allRows.length || 1;
  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: allRows.filter((r) => r.status === status).length,
  }));

  const holdingCostNote =
    holdingCostTotal > 0 ? `an estimated ${formatMoney(holdingCostTotal)}/month to hold` : `${formatMoney(excessValueTotal)} tied up`;
  const summary = `This ${VIEW_LABEL[view].toLowerCase()} snapshot covers ${formatNumber(
    allRows.length
  )} titles holding ${formatNumber(totalUnits)} combined units. ${formatNumber(
    repressRows.length
  )} need repressing, ${formatNumber(
    rebalanceRows.length
  )} could be resolved faster by moving stock between Proper and AMPED, and ${formatNumber(
    overstockRows.length
  )} are overstocked, currently ${holdingCostNote}.`;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerDivider}>
          <Text style={styles.h1}>Stock Health Report</Text>
          <Text style={styles.subtitle}>Reservoir — combined Proper &amp; AMPED sell-through</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>View: </Text>
              {VIEW_LABEL[view]} ({formatNumber(allRows.length)} titles)
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated: </Text>
              {generatedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Proper file: </Text>
              {properFileName || "—"} ({formatNumber(properRowCount)} rows)
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>AMPED file: </Text>
              {formatNumber(ampedRowCount)} rows
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.h2}>How to read this report</Text>
          <Text style={styles.panelText}>
            Every release is tracked at two distributors: Proper and AMPED.
            "Months of cover" is stock ÷ average monthly sales — how long the current stock would last at the
            recent sell-through rate. Titles below {thresholds.lowMonths} months are flagged to repress; above{" "}
            {thresholds.highMonths} months they're flagged as overstocked (stock that costs money to hold); the
            range in between is this business's target window. A rebalance flag means one region is running low
            while the other has surplus — moving existing stock between them may resolve it faster than a repress,
            though it doesn't reduce the total repress need on its own. Combined sales below{" "}
            {thresholds.minMonthlyVelocity} units/month are treated as too thin to trust for an urgent call, and
            show as dormant instead.
          </Text>
        </View>

        <Text style={styles.h2}>Overview</Text>
        <Text style={styles.summaryText}>{summary}</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Titles tracked</Text>
            <Text style={styles.kpiValue}>{formatNumber(allRows.length)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Combined units in stock</Text>
            <Text style={styles.kpiValue}>{formatNumber(totalUnits)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Needs repress</Text>
            <Text style={[styles.kpiValue, { color: COLOR.critical }]}>{formatNumber(repressRows.length)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Overstocked</Text>
            <Text style={[styles.kpiValue, { color: COLOR.warning }]}>{formatNumber(overstockRows.length)}</Text>
            <Text style={styles.kpiSub}>{holdingCostNote}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Portfolio health</Text>
        <Svg width={PAGE_CONTENT_WIDTH} height={12}>
          {(() => {
            let x = 0;
            const gap = 2;
            return statusCounts.map(({ status, count }) => {
              if (count <= 0) return null;
              const raw = (count / total) * PAGE_CONTENT_WIDTH;
              const w = Math.max(0, raw - gap);
              const rect = <Rect key={status} x={x} y={0} width={w} height={12} rx={3} fill={STATUS_META[status].color} />;
              x += raw;
              return rect;
            });
          })()}
        </Svg>
        <View style={styles.healthLegendRow}>
          {statusCounts.map(({ status, count }) => (
            <View key={status} style={styles.healthLegendItem}>
              <Svg width={8} height={8}>
                <Circle cx={4} cy={4} r={3} fill={STATUS_META[status].color} />
              </Svg>
              <Text style={styles.healthLegendText}>
                {STATUS_META[status].label}: {formatNumber(count)} ({Math.round((count / total) * 100)}%)
              </Text>
            </View>
          ))}
        </View>

        <ReportSection
          title="Needs repress"
          note="Combined cover is below the repress threshold, sorted soonest-to-sell-out first — includes titles already out of stock."
          rows={repressRows}
          thresholds={thresholds}
        />
        <ReportSection
          title="Rebalance opportunities"
          note="One region is low or out while the other has confirmed surplus, sorted by transfer quantity."
          rows={rebalanceRows}
          thresholds={thresholds}
        />
        <ReportSection
          title="Overstocked — review holding"
          note="Combined cover is above the target window, sorted by value tied up."
          rows={overstockRows}
          thresholds={thresholds}
        />
        <ReportSection
          title="Dormant — no recent sales"
          note="No sales velocity to project a repress or rebalance from, sorted by stock held."
          rows={dormantRows}
          thresholds={thresholds}
        />

        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) =>
            `Generated by the Reservoir Stock Health Dashboard · Snapshot as of the files above, not updated automatically · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
