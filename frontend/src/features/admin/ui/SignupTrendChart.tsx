import { responsiveStyles } from "../../../components/responsiveStyles";

type SignupTrendChartProps = {
  series: { date: string; count: number }[];
};

// Zero-filled 14-day signup bars. Heights scale to the window's peak; empty days
// keep a faint sliver so the axis reads continuously.
const SignupTrendChart = ({ series }: SignupTrendChartProps) => {
  const max = Math.max(1, ...series.map((point) => point.count));
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const first = series[0]?.date ?? "";
  const last = series[series.length - 1]?.date ?? "";

  return (
    <section className={responsiveStyles.adminCard}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={responsiveStyles.adminSectionTitle}>New signups</h2>
        <span className={responsiveStyles.cardDescription}>{total} in the last 14 days</span>
      </div>

      <div
        className={responsiveStyles.adminChartRow}
        role="img"
        aria-label={`Signups per day over the last 14 days, ${total} total`}
      >
        {series.map((point) => (
          <div
            key={point.date}
            className={responsiveStyles.adminChartBar}
            style={{ height: point.count === 0 ? "3px" : `${(point.count / max) * 100}%` }}
            title={`${point.date}: ${point.count}`}
          />
        ))}
      </div>
      <div className={responsiveStyles.adminChartAxis}>
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </section>
  );
};

export default SignupTrendChart;
