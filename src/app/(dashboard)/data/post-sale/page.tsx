"use client";

import { useApi } from "@/lib/hooks/use-api";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/skeleton";

interface MetricItem {
  name: string;
  value: number;
}

interface PostSaleData {
  postSale: {
    avgDeliveryDays: number;
    avgActivationDays: number;
    onboardingCompletionRate: number;
    avgDelayDays: number;
  };
  churn: {
    totalChurned: number;
    byReason: MetricItem[];
    bySegment: MetricItem[];
    byPersona: MetricItem[];
    byRep: MetricItem[];
    bySource: MetricItem[];
  };
}

export default function PostSaleChurnPage() {
  const { data, loading, error } = useApi<PostSaleData>("/api/data/post-sale");

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted">
        Failed to load configuration or historical data.
      </div>
    );
  }

  const { postSale, churn } = data;

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Post-Sale & Churn Intelligence" 
        description="Diagnose implementation velocity and precisely attribute churn to operational failures."
      />

      {/* Post-Sale Analytics */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          Customer Onboarding & Delivery
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-surface p-5 hover:border-primary/50 transition-colors">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Avg Time to Delivery</p>
            <p className="text-3xl font-bold mt-2 text-foreground">{postSale.avgDeliveryDays} <span className="text-base font-normal text-muted lowercase">days</span></p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 hover:border-primary/50 transition-colors">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Avg Time to Activation</p>
            <p className="text-3xl font-bold mt-2 text-foreground">{postSale.avgActivationDays} <span className="text-base font-normal text-muted lowercase">days</span></p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 hover:border-primary/50 transition-colors">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Onboarding Completion</p>
            <p className="text-3xl font-bold mt-2 text-foreground">{postSale.onboardingCompletionRate}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 hover:border-danger/50 transition-colors">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Implementation Delay</p>
            <p className="text-3xl font-bold mt-2 text-danger">+{postSale.avgDelayDays} <span className="text-base font-normal text-muted lowercase">days</span></p>
          </div>
        </div>
        <p className="text-xs text-muted mt-3 pl-1 border-l-2 border-border ml-1">
          <strong>Note:</strong> Data is extrapolated based on current <code>Account</code> model realities. Missing lifecycle dates are ignored from averages.
        </p>
      </div>

      {/* Churn Analytics */}
      <div className="pt-6 border-t border-border">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          Churn Cohort Analysis
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DataCard title="Churn by Reason" data={churn.byReason} total={churn.totalChurned} />
          <DataCard title="Churn by Segment" data={churn.bySegment} total={churn.totalChurned} />
          <DataCard title="Churn by Sales Rep" data={churn.byRep} total={churn.totalChurned} />
          <DataCard title="Churn by Buyer Persona" data={churn.byPersona} total={churn.totalChurned} />
          <DataCard title="Churn by Source" data={churn.bySource} total={churn.totalChurned} />
        </div>
      </div>

      {/* Operational Breakdown */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4 border-b border-border pb-3">Consulting Explanatory Breakdowns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-warning">
              Delivery vs. Activation Chasm
            </h4>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              If Mean Time to Activation greatly exceeds Mean Time to Delivery, the product is being shipped but the user base lacks enablement. This indicates a failure in Customer Success onboarding collateral rather than technical deployment. Operational Action: Institute mid-onboarding touchpoints.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 text-danger">
              High Implementation Delays & Early Churn
            </h4>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              The top segments contributing to implementation delay often correlate directly with the "LACK_OF_USAGE" churn reason. Reps overselling to mismatched segments causes operational strain downstream. Management must evaluate the segment breakdown and adjust lead qualification metrics upstream.
            </p>
          </div>
        </div>
      </div>
      
    </div>
  );
}

function DataCard({ title, data, total }: { title: string; data: MetricItem[], total: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-semibold text-sm mb-4">{title}</h3>
        <p className="text-xs text-muted text-center py-6">Insufficient data for cohort</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-sm">
              <span className="truncate max-w-[150px]" title={item.name}>{item.name}</span>
              <span className="font-medium">{item.value} <span className="text-xs text-muted">({total > 0 ? Math.round((item.value/total)*100) : 0}%)</span></span>
            </div>
            <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all" 
                style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
